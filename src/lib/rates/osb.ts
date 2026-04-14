import ratesheet from './osb-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';

export type OsbProgram = '2nd Liens' | 'HELOC';
export type OsbSecondLienProduct = 'Fixed 10' | 'Fixed 15' | 'Fixed 20' | 'Fixed 30';
export type OsbHelocProduct = '20 Year Maturity' | '30 Year Maturity';
export type OsbProduct = OsbSecondLienProduct | OsbHelocProduct;
export type OsbLockPeriod = 15 | 45 | 60;

export interface OsbPricingInput {
  program: OsbProgram;
  product: OsbProduct;
  propertyState: string;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  occupancy: string;
  structureType: string;
  unitCount: number;
  cashOut: boolean;
  helocDrawTermYears: 3 | 5 | 10;
  lockPeriodDays: OsbLockPeriod;
}

export interface OsbAdjustmentLine {
  label: string;
  value: number;
}

export interface OsbQuote {
  program: OsbProgram;
  product: OsbProduct;
  maxAvailable: number;
  maxLtv: number;
  rate: number;
  noteRate: number;
  rateType: string;
  monthlyPayment: number;
  basePrice: number;
  llpaAdjustment: number;
  purchasePrice: number;
  targetPrice: number;
  adjustments: OsbAdjustmentLine[];
}

export interface OsbTargetRateQuote extends OsbQuote {
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
}

export interface OsbEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type JsonBucketRow = { creditScore?: string; label?: string; values: Array<number | null> };
type JsonProgramKey = 'secondLiens' | 'heloc';
type JsonProgram = {
  sheet: string;
  pricing: {
    rateType: 'fixed-note-rate' | 'margin';
    products: Array<{ key: string; label: string }>;
    rowsData: Array<{ rate: number; prices: Record<string, number | null> }>;
  };
  constraints: {
    minPrice: number | null;
    maxPrice30Year: number | null;
    maxPriceShorterTerm: number | null;
  };
  cltvBuckets: string[];
  creditMatrix: JsonBucketRow[];
  adjustments: Record<string, JsonBucketRow[]>;
  lockAdjustments: Array<{ label: string; value: number | null }>;
};

const PROGRAMS = (ratesheet as { programs: Record<JsonProgramKey, JsonProgram> }).programs;
const TIER_1_STATES = new Set(['NV', 'LA', 'FL', 'GA', 'SC', 'CO', 'AZ', 'NC']);

export function buildOsbStage1PricingInput(stage1: ButtonStage1Input & {
  osbProgram?: OsbProgram;
  osbProduct?: OsbProduct;
  osbLockPeriodDays?: OsbLockPeriod;
  helocDrawTermYears?: 3 | 5 | 10;
}): OsbPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;
  const program = normalizeProgram(stage1.osbProgram, stage1.product);

  return {
    program,
    product: normalizeProduct(program, stage1.osbProduct),
    propertyState: String(stage1.propertyState || '').toUpperCase(),
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    occupancy: normalizeOccupancy(stage1.occupancy),
    structureType: normalizeStructureType(stage1.structureType),
    unitCount: Number(stage1.numberOfUnits || 1),
    cashOut: Boolean(stage1.cashOut),
    helocDrawTermYears: stage1.helocDrawTermYears ?? 5,
    lockPeriodDays: stage1.osbLockPeriodDays ?? 45,
  };
}

export function calculateOsbStage1Quote(
  stage1: ButtonStage1Input & {
    osbProgram?: OsbProgram;
    osbProduct?: OsbProduct;
    osbLockPeriodDays?: OsbLockPeriod;
    helocDrawTermYears?: 3 | 5 | 10;
  },
  options?: { selectedLoanAmount?: number; targetPrice?: number }
): OsbQuote {
  return calculateOsbQuote(buildOsbStage1PricingInput(stage1), options);
}

export function evaluateOsbStage1Eligibility(
  stage1: ButtonStage1Input & {
    osbProgram?: OsbProgram;
    osbProduct?: OsbProduct;
    osbLockPeriodDays?: OsbLockPeriod;
    helocDrawTermYears?: 3 | 5 | 10;
  },
  selectedLoanAmount?: number
): OsbEligibilityResult {
  const input = buildOsbStage1PricingInput(stage1);
  return evaluateOsbEligibility(input, selectedLoanAmount);
}

export function solveOsbStage1TargetRate(
  stage1: ButtonStage1Input & {
    osbProgram?: OsbProgram;
    osbProduct?: OsbProduct;
    osbLockPeriodDays?: OsbLockPeriod;
    helocDrawTermYears?: 3 | 5 | 10;
  },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): OsbTargetRateQuote {
  const input = buildOsbStage1PricingInput(stage1);
  const program = getProgramData(input.program);
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const targetPrice = clampTargetPrice(program, input.product, options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount));
  const tolerance = options.tolerance ?? 0.125;
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickRateAtOrBelowTarget(input, llpaAdjustment, targetPrice);
  const deltaFromTarget = roundToThree(targetPrice - selected.purchasePrice);

  return {
    program: input.program,
    product: input.product,
    maxAvailable,
    maxLtv: calculateMaxLtv(input),
    rate: selected.rate,
    noteRate: selected.rate,
    rateType: input.program === 'HELOC' ? 'Variable' : 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input, selectedLoanAmount, selected.rate),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    targetPrice,
    adjustments,
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
  };
}

export function calculateOsbQuote(input: OsbPricingInput, options?: { selectedLoanAmount?: number; targetPrice?: number }): OsbQuote {
  const program = getProgramData(input.program);
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const targetPrice = clampTargetPrice(program, input.product, options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount));
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickRateAtOrBelowTarget(input, llpaAdjustment, targetPrice);

  return {
    program: input.program,
    product: input.product,
    maxAvailable,
    maxLtv: calculateMaxLtv(input),
    rate: selected.rate,
    noteRate: selected.rate,
    rateType: input.program === 'HELOC' ? 'Variable' : 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input, selectedLoanAmount, selected.rate),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    targetPrice,
    adjustments,
  };
}

export function evaluateOsbEligibility(input: OsbPricingInput, selectedLoanAmount?: number): OsbEligibilityResult {
  const reasons: string[] = [];
  const program = getProgramData(input.program);
  const maxAvailable = calculateMaxAvailable(input);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);

  if (!findMatrixRow(program.creditMatrix, input.creditScore)) reasons.push('Credit score is outside the OSB matrix.');
  if (findCltvBucketIndex(program.cltvBuckets, input.resultingCltv) === null) reasons.push('Resulting CLTV is outside the OSB matrix.');
  if (!program.pricing.products.some(item => item.label === input.product)) reasons.push('Selected OSB product is not available in the workbook.');
  if (input.program === 'HELOC' && !findAdjustment(program.adjustments.drawTerm, drawTermLabel(input.helocDrawTermYears))) reasons.push('Selected HELOC draw term is not available in the workbook.');
  if (findAdjustment(program.adjustments.loanAmount, loanAmountLabel(input.program, requested)) === null) reasons.push('Desired loan amount is outside the OSB loan amount grid.');
  if (findLockAdjustment(program.lockAdjustments, lockPeriodLabel(input.lockPeriodDays)) === null) reasons.push('Selected lock period is not available in the workbook.');
  if (requested > maxAvailable) reasons.push('Desired loan amount exceeds the current max available amount.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
    resultingCltv: input.resultingCltv,
  };
}

function buildAdjustmentLines(input: OsbPricingInput, selectedLoanAmount: number): OsbAdjustmentLine[] {
  const program = getProgramData(input.program);
  const adjustments: OsbAdjustmentLine[] = [];
  const cltv = buildCltvAdjustment(program, input.creditScore, input.resultingCltv);
  if (cltv) adjustments.push(cltv);

  if (input.program === 'HELOC') {
    const draw = findAdjustment(program.adjustments.drawTerm, drawTermLabel(input.helocDrawTermYears));
    if (draw) adjustments.push({ label: `Draw Term: ${draw.label}`, value: lookupAdjustmentValue(draw, program.cltvBuckets, input.resultingCltv) });
  }

  const amount = findAdjustment(program.adjustments.loanAmount, loanAmountLabel(input.program, selectedLoanAmount));
  if (amount) adjustments.push({ label: `Loan Amount: ${amount.label}`, value: lookupAdjustmentValue(amount, program.cltvBuckets, input.resultingCltv) });

  const occupancy = findAdjustment(program.adjustments.loanType, occupancyLoanTypeLabel(input));
  if (occupancy) adjustments.push({ label: `Loan Type: ${occupancy.label}`, value: lookupAdjustmentValue(occupancy, program.cltvBuckets, input.resultingCltv) });

  const property = findAdjustment(program.adjustments.property, propertyLabel(input));
  if (property) adjustments.push({ label: `Property: ${property.label}`, value: lookupAdjustmentValue(property, program.cltvBuckets, input.resultingCltv) });

  const state = findAdjustment(program.adjustments.property, 'Tier 2 States: Other*');
  if (state && !TIER_1_STATES.has(input.propertyState)) {
    adjustments.push({ label: 'State: Tier 2 States: Other*', value: lookupAdjustmentValue(state, program.cltvBuckets, input.resultingCltv) });
  }

  const lock = findLockAdjustment(program.lockAdjustments, lockPeriodLabel(input.lockPeriodDays));
  if (lock?.value) adjustments.push({ label: `Lock Period: ${lock.label}`, value: lock.value });

  return adjustments.filter(row => Number.isFinite(row.value));
}

function buildCltvAdjustment(program: JsonProgram, creditScore: number, cltv: number): OsbAdjustmentLine | null {
  const row = findMatrixRow(program.creditMatrix, creditScore);
  const bucketIndex = findCltvBucketIndex(program.cltvBuckets, cltv);
  if (!row || bucketIndex === null) return null;
  const value = row.values[bucketIndex];
  return { label: `Credit / CLTV: ${row.creditScore} @ ${program.cltvBuckets[bucketIndex]}`, value: value ?? 0 };
}

function calculateMaxAvailable(input: OsbPricingInput): number {
  return Math.max(0, input.propertyValue * calculateMaxLtv(input) - input.loanBalance);
}

function calculateMaxLtv(input: OsbPricingInput): number {
  const program = getProgramData(input.program);
  const row = findMatrixRow(program.creditMatrix, input.creditScore);
  if (!row) return 0;
  const lastEligibleIndex = row.values.reduce<number>((best, value, index) => value !== null ? index : best, -1);
  if (lastEligibleIndex < 0) return 0;
  return upperBoundForCltvLabel(program.cltvBuckets[lastEligibleIndex]) / 100;
}

function pickRateAtOrBelowTarget(input: OsbPricingInput, llpaAdjustment: number, targetPrice: number): { rate: number; basePrice: number; purchasePrice: number } {
  const program = getProgramData(input.program);
  const key = productKey(input.product);
  let bestUnder: { rate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { rate: program.pricing.rowsData[0].rate, basePrice: program.pricing.rowsData[0].prices[key] ?? 0, purchasePrice: 0 };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of program.pricing.rowsData) {
    const basePrice = row.prices[key];
    if (basePrice == null) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    if (purchasePrice <= targetPrice && (!bestUnder || purchasePrice > bestUnder.purchasePrice)) {
      bestUnder = { rate: row.rate, basePrice, purchasePrice };
    }
    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < fallbackDelta || (delta === fallbackDelta && purchasePrice > fallback.purchasePrice)) {
      fallback = { rate: row.rate, basePrice, purchasePrice };
      fallbackDelta = delta;
    }
  }

  return bestUnder ?? fallback;
}

function calculateMonthlyPayment(input: OsbPricingInput, loanAmount: number, noteRate: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = noteRate / 100 / 12;
  if (input.program === 'HELOC') return Math.round(loanAmount * monthlyRate);
  const years = input.product === 'Fixed 10' ? 10 : input.product === 'Fixed 15' ? 15 : input.product === 'Fixed 20' ? 20 : 30;
  const payments = years * 12;
  return Math.round(loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1));
}

function clampTargetPrice(program: JsonProgram, product: OsbProduct, targetPrice: number): number {
  const maxPrice = product === '30 Year Maturity' || product === 'Fixed 30' ? program.constraints.maxPrice30Year : program.constraints.maxPriceShorterTerm;
  const capped = maxPrice ? Math.min(targetPrice, maxPrice) : targetPrice;
  return program.constraints.minPrice ? Math.max(capped, program.constraints.minPrice) : capped;
}

function getProgramData(program: OsbProgram): JsonProgram {
  return PROGRAMS[program === 'HELOC' ? 'heloc' : 'secondLiens'];
}

function findMatrixRow(rows: JsonBucketRow[], creditScore: number): JsonBucketRow | null {
  return rows.find(row => matchesCreditScoreLabel(String(row.creditScore || row.label || ''), creditScore)) ?? null;
}

function findCltvBucketIndex(buckets: string[], cltv: number): number | null {
  const cltvPct = cltv * 100;
  for (let i = 0; i < buckets.length; i += 1) {
    if (cltvPct <= upperBoundForCltvLabel(buckets[i])) return i;
  }
  return null;
}

function findAdjustment(rows: JsonBucketRow[], label: string): JsonBucketRow | null {
  return rows.find(row => String(row.label ?? row.creditScore ?? '') === label) ?? null;
}

function findLockAdjustment(rows: Array<{ label: string; value: number | null }>, label: string) {
  return rows.find(row => row.label === label) ?? null;
}

function lookupAdjustmentValue(row: JsonBucketRow, buckets: string[], cltv: number): number {
  const bucketIndex = findCltvBucketIndex(buckets, cltv);
  if (bucketIndex === null) return 0;
  return row.values[bucketIndex] ?? 0;
}

function loanAmountLabel(program: OsbProgram, amount: number): string {
  if (program === 'HELOC') {
    if (amount <= 50000) return '$20,000 - $50,000';
    if (amount <= 100000) return '$50,001 - $100,000';
    if (amount <= 200000) return '$100,001 - $200,000';
    if (amount <= 300000) return '$200,001 - $300,000';
    return '>$300,000';
  }
  if (amount <= 100000) return '$50,000 - $100,000 (UPB)';
  if (amount <= 150000) return '$100,001 - $150,000 (UPB)';
  if (amount <= 250000) return '$150,001 - $250,000 (UPB)';
  if (amount <= 350000) return '$250,001 - $350,000 (UPB)';
  return '$350,001 - $500,000 (UPB)';
}

function drawTermLabel(years: 3 | 5 | 10): string {
  return years === 10 ? '10 Year Draw' : years === 5 ? '5 Year Draw' : '3 Year Draw';
}

function occupancyLoanTypeLabel(input: OsbPricingInput): string {
  if (input.occupancy === 'Investment') return 'Investor';
  if (input.occupancy === 'Second Home') return 'Second Home';
  if (input.program === 'HELOC' && input.loanBalance > 0) return '1st Lien';
  return input.program === 'HELOC' ? 'DTI > 43%' : '<=35.0% DTI';
}

function propertyLabel(input: OsbPricingInput): string {
  if (input.unitCount > 1) return input.program === 'HELOC' ? '2 - 4 Unit Property' : 'Multi Unit';
  if (input.structureType === 'Condo') return input.propertyState === 'FL' ? 'Florida Condo' : 'Condo (Warrantable)';
  return 'Full Appraisal';
}

function productKey(product: OsbProduct): string {
  switch (product) {
    case 'Fixed 10': return 'fixed10';
    case 'Fixed 15': return 'fixed15';
    case 'Fixed 20': return 'fixed20';
    case 'Fixed 30': return 'fixed30';
    case '20 Year Maturity': return 'heloc20';
    default: return 'heloc30';
  }
}

function lockPeriodLabel(days: OsbLockPeriod): string {
  return `${days} day`;
}

function normalizeProgram(program?: OsbProgram, product?: string): OsbProgram {
  if (program) return program;
  return String(product || '').toUpperCase().includes('HELOC') ? 'HELOC' : '2nd Liens';
}

function normalizeProduct(program: OsbProgram, product?: OsbProduct): OsbProduct {
  if (program === 'HELOC') return product === '20 Year Maturity' ? product : '30 Year Maturity';
  if (product === 'Fixed 10' || product === 'Fixed 15' || product === 'Fixed 20' || product === 'Fixed 30') return product;
  return 'Fixed 30';
}

function normalizeOccupancy(occupancy?: string): string {
  const value = String(occupancy || '').toLowerCase();
  if (value.includes('rental') || value.includes('investment') || value.includes('investor')) return 'Investment';
  if (value.includes('second')) return 'Second Home';
  return 'Owner Occupied';
}

function normalizeStructureType(structureType?: string): string {
  const value = String(structureType || '').toLowerCase();
  if (value.includes('condo')) return 'Condo';
  if (value.includes('town')) return 'Townhome';
  if (value.includes('pud')) return 'PUD';
  if (value.includes('multi') || value.includes('2-4')) return '2-4 Unit';
  return 'SFR';
}

function matchesCreditScoreLabel(label: string, creditScore: number): boolean {
  const text = label.replace('≥', '>=').trim();
  if (text.startsWith('>=')) return creditScore >= Number(text.replace('>=', '').trim());
  const parts = text.split('-').map(part => Number(part.trim()));
  return parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])
    ? creditScore >= parts[0] && creditScore <= parts[1]
    : false;
}

function upperBoundForCltvLabel(label: string): number {
  const right = label.split('-')[1] ?? label;
  return Number(String(right).replace('%', '').trim());
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}
