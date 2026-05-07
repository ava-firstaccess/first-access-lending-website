import ratesheet from './osb-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import type { SharedDocType } from '@/lib/stage1-pricing/types';
import { STAGE1_INVESTOR_OVERLAYS } from '../stage1-pricing/config';
import {
  calculateAmortizingMonthlyPayment,
  calculateInterestOnlyMonthlyPayment,
  calculateMaxAvailableFromMaxLtv,
} from './shared';

export type OsbProgram = '2nd Liens' | 'HELOC';
export type OsbSecondLienProduct = 'Fixed 10' | 'Fixed 15' | 'Fixed 20' | 'Fixed 30';
export type OsbHelocProduct = '20 Year Maturity' | '30 Year Maturity';
export type OsbProduct = OsbSecondLienProduct | OsbHelocProduct;
export type OsbLockPeriod = 30 | 45 | 60;

export interface OsbPricingInput {
  program: OsbProgram;
  product: OsbProduct;
  docType: SharedDocType;
  propertyState: string;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  dti: number | null;
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
  withinToleranceAllowOverage: boolean;
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
  guideMaxPrice?: {
    default: number | null;
  };
  cltvBuckets: string[];
  creditMatrix: JsonBucketRow[];
  adjustments: Record<string, JsonBucketRow[]>;
  documentationAdjustments?: Array<{ label: string; value: number | null }>;
  lockAdjustments: Array<{ label: string; value: number | null }>;
  tier1States?: string[];
  armFeatures?: {
    'Index-PRIME'?: number;
  };
};

const PROGRAMS = (ratesheet as { programs: Record<JsonProgramKey, JsonProgram> }).programs;
const OSB_OVERLAY = STAGE1_INVESTOR_OVERLAYS.OSB;

export function getOsbGuideMaxPrice(program: OsbProgram, product: OsbProduct): number {
  const source = program === 'HELOC' ? PROGRAMS.heloc : PROGRAMS.secondLiens;
  const value = source.guideMaxPrice?.default;
  if (value === null || value === undefined) {
    throw new Error(`OSB guide max price is missing from osb-ratesheet.json for ${program}`);
  }
  return value;
}

export function buildOsbStage1PricingInput(stage1: ButtonStage1Input & {
  osbProgram?: OsbProgram;
  osbProduct?: OsbProduct;
  osbDocType?: SharedDocType;
  osbLockPeriodDays?: OsbLockPeriod;
  helocDrawTermYears?: 3 | 5 | 10;
}): OsbPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;
  const program = normalizeProgram(stage1.osbProgram, stage1.osbProduct);

  return {
    program,
    product: requireOsbProduct(program, stage1.osbProduct),
    propertyState: String(stage1.propertyState || '').toUpperCase(),
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    dti: Number.isFinite(Number(stage1.dti)) ? Number(stage1.dti) : null,
    occupancy: normalizeOccupancy(stage1.occupancy),
    structureType: normalizeStructureType(stage1.structureType),
    unitCount: Number(stage1.numberOfUnits || 1),
    cashOut: Boolean(stage1.cashOut),
    docType: (stage1 as ButtonStage1Input & { osbDocType?: SharedDocType }).osbDocType ?? 'Full Doc',
    helocDrawTermYears: requireHelocDrawTermYears(stage1.helocDrawTermYears),
    lockPeriodDays: requireOsbLockPeriodDays(stage1.osbLockPeriodDays),
  };
}

export function calculateOsbStage1Quote(
  stage1: ButtonStage1Input & {
    osbProgram?: OsbProgram;
    osbProduct?: OsbProduct;
    osbDocType?: SharedDocType;
    osbLockPeriodDays?: OsbLockPeriod;
    helocDrawTermYears?: 3 | 5 | 10;
  },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): OsbQuote {
  return calculateOsbQuote(buildOsbStage1PricingInput(stage1), options);
}

export function evaluateOsbStage1Eligibility(
  stage1: ButtonStage1Input & {
    osbProgram?: OsbProgram;
    osbProduct?: OsbProduct;
    osbDocType?: SharedDocType;
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
    osbDocType?: SharedDocType;
    osbLockPeriodDays?: OsbLockPeriod;
    helocDrawTermYears?: 3 | 5 | 10;
  },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): OsbTargetRateQuote {
  const input = buildOsbStage1PricingInput(stage1);
  const program = getProgramData(input.program);
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const tolerance = options.tolerance ?? 0.125;
  if (!isOsbScenarioSupported(input, selectedLoanAmount) || selectedLoanAmount > maxAvailable || input.resultingCltv > calculateMaxLtv(input)) {
    return {
      program: input.program,
      product: input.product,
      maxAvailable,
      maxLtv: calculateMaxLtv(input),
      rate: 0,
      noteRate: 0,
      rateType: input.program === 'HELOC' ? 'Variable' : 'Fixed',
      monthlyPayment: 0,
      basePrice: 0,
      llpaAdjustment: 0,
      purchasePrice: 0,
      targetPrice: roundToThree(options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount)),
      adjustments: [],
      tolerance,
      deltaFromTarget: 0,
      withinTolerance: false,
      withinToleranceAllowOverage: false,
    };
  }
  const targetPrice = clampTargetPrice(program, input.product, options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount));
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickRateAtOrBelowTarget(input, llpaAdjustment, targetPrice);
  const deltaFromTarget = roundToThree(targetPrice - selected.purchasePrice);

  const displayedRate = calculateDisplayedRate(input, selected.rate);

  return {
    program: input.program,
    product: input.product,
    maxAvailable,
    maxLtv: calculateMaxLtv(input),
    rate: displayedRate,
    noteRate: displayedRate,
    rateType: input.program === 'HELOC' ? 'Variable' : 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input, selectedLoanAmount, displayedRate),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    targetPrice,
    adjustments,
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
    withinToleranceAllowOverage: deltaFromTarget >= -tolerance && deltaFromTarget <= tolerance,
  };
}

export function calculateOsbQuote(input: OsbPricingInput, options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }): OsbQuote {
  const program = getProgramData(input.program);
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  if (!isOsbScenarioSupported(input, selectedLoanAmount) || selectedLoanAmount > maxAvailable || input.resultingCltv > calculateMaxLtv(input)) {
    return {
      program: input.program,
      product: input.product,
      maxAvailable,
      maxLtv: calculateMaxLtv(input),
      rate: 0,
      noteRate: 0,
      rateType: input.program === 'HELOC' ? 'Variable' : 'Fixed',
      monthlyPayment: 0,
      basePrice: 0,
      llpaAdjustment: 0,
      purchasePrice: 0,
      targetPrice: roundToThree(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount)),
      adjustments: [],
    };
  }
  const targetPrice = clampTargetPrice(program, input.product, options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount));
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = options?.rateOverride !== undefined
    ? pickRateClosestToRequested(input, llpaAdjustment, options.rateOverride)
    : pickRateAtOrBelowTarget(input, llpaAdjustment, targetPrice);

  const displayedRate = calculateDisplayedRate(input, selected.rate);

  return {
    program: input.program,
    product: input.product,
    maxAvailable,
    maxLtv: calculateMaxLtv(input),
    rate: displayedRate,
    noteRate: displayedRate,
    rateType: input.program === 'HELOC' ? 'Variable' : 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input, selectedLoanAmount, displayedRate),
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
  const cltvBucketIndex = findCltvBucketIndex(program.cltvBuckets, input.resultingCltv);

  if (!findMatrixRow(program.creditMatrix, input.creditScore)) reasons.push('Credit score is outside the OSB matrix.');
  if (cltvBucketIndex === null) reasons.push('Resulting CLTV is outside the OSB matrix.');
  if (!program.pricing.products.some(item => item.label === input.product)) reasons.push('Selected OSB product is not available in the workbook.');
  if (input.docType !== 'Full Doc') reasons.push('OSB does not support alt-doc pricing.');

  if (input.program === 'HELOC') {
    const draw = findAdjustment(program.adjustments.drawTerm, drawTermLabel(input.helocDrawTermYears));
    if (!draw) reasons.push('Selected HELOC draw term is not available in the workbook.');
    else if (cltvBucketIndex !== null && adjustmentBucketValue(draw, cltvBucketIndex) === null) reasons.push('Selected HELOC draw term is not eligible at this CLTV in the workbook.');
  }

  const amount = findLoanAmountAdjustment(input, requested);
  if (amount === null) reasons.push('Desired loan amount is outside the OSB loan amount grid.');
  else if (cltvBucketIndex !== null && adjustmentBucketValue(amount, cltvBucketIndex) === null) reasons.push('Desired loan amount is not eligible at this CLTV in the workbook.');

  const occupancy = findAdjustment(program.adjustments.loanType, occupancyLoanTypeLabel(input));
  if (occupancy && cltvBucketIndex !== null && adjustmentBucketValue(occupancy, cltvBucketIndex) === null) reasons.push(`Loan type ${occupancy.label} is not eligible at this CLTV in the workbook.`);

  const dti = findDtiAdjustment(input);
  if (dti && cltvBucketIndex !== null && adjustmentBucketValue(dti, cltvBucketIndex) === null) reasons.push(`DTI bucket ${dti.label} is not eligible at this CLTV in the workbook.`);

  const property = findAdjustment(program.adjustments.property, propertyLabel(input));
  if (property && cltvBucketIndex !== null && adjustmentBucketValue(property, cltvBucketIndex) === null) reasons.push(`Property type ${property.label} is not eligible at this CLTV in the workbook.`);

  const state = findAdjustment(program.adjustments.property, 'Tier 2 States: Other*');
  if (state && isTier2State(input) && cltvBucketIndex !== null && adjustmentBucketValue(state, cltvBucketIndex) === null) reasons.push('Tier 2 state pricing is not eligible at this CLTV in the workbook.');

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

  if (input.program === '2nd Liens' && input.docType !== 'Full Doc') {
    const doc = findDocumentationAdjustment(program.documentationAdjustments, input.docType);
    if (doc) adjustments.push({ label: `Doc Type: ${doc.label}`, value: doc.value });
  }

  if (input.program === 'HELOC') {
    const draw = findAdjustment(program.adjustments.drawTerm, drawTermLabel(input.helocDrawTermYears));
    if (draw) adjustments.push({ label: `Draw Term: ${draw.label}`, value: lookupAdjustmentValue(draw, program.cltvBuckets, input.resultingCltv) });
  }

  const amount = findLoanAmountAdjustment(input, selectedLoanAmount);
  if (amount) adjustments.push({ label: `Loan Amount: ${amount.label}`, value: lookupAdjustmentValue(amount, program.cltvBuckets, input.resultingCltv) });

  const occupancy = findAdjustment(program.adjustments.loanType, occupancyLoanTypeLabel(input));
  if (occupancy) adjustments.push({ label: `Loan Type: ${occupancy.label}`, value: lookupAdjustmentValue(occupancy, program.cltvBuckets, input.resultingCltv) });

  const dti = findDtiAdjustment(input);
  if (dti) adjustments.push({ label: `DTI: ${dti.label}`, value: lookupAdjustmentValue(dti, program.cltvBuckets, input.resultingCltv) });

  const property = findAdjustment(program.adjustments.property, propertyLabel(input));
  if (property) adjustments.push({ label: `Property: ${property.label}`, value: lookupAdjustmentValue(property, program.cltvBuckets, input.resultingCltv) });

  const state = findAdjustment(program.adjustments.property, 'Tier 2 States: Other*');
  if (state && isTier2State(input)) {
    adjustments.push({ label: 'State: Tier 2 States: Other*', value: lookupAdjustmentValue(state, program.cltvBuckets, input.resultingCltv) });
  }

  const lock = getLockAdjustment(program.lockAdjustments, lockPeriodLabel(input.lockPeriodDays));
  adjustments.push({ label: `Lock Period: ${lock.label}`, value: lock.value });

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
  const cltvConstrained = calculateMaxAvailableFromMaxLtv(input.propertyValue, input.loanBalance, calculateMaxLtv(input));
  const loanAmountCap = getOsbLoanAmountCap(input);
  if (loanAmountCap === null) return 0;
  return Math.max(0, Math.min(cltvConstrained, loanAmountCap));
}

function calculateMaxLtv(input: OsbPricingInput): number {
  const program = getProgramData(input.program);
  const row = findMatrixRow(program.creditMatrix, input.creditScore);
  if (!row) return 0;
  const lastEligibleIndex = row.values.reduce<number>((best, value, index) => value !== null ? index : best, -1);
  if (lastEligibleIndex < 0) return 0;
  return upperBoundForCltvLabel(program.cltvBuckets[lastEligibleIndex]) / 100;
}

function pickRateClosestToRequested(input: OsbPricingInput, llpaAdjustment: number, requestedRate: number): { rate: number; basePrice: number; purchasePrice: number } {
  const program = getProgramData(input.program);
  const key = productKey(input.product);
  const workbookRequestedRate = toWorkbookRate(input, requestedRate);
  let best = { rate: program.pricing.rowsData[0].rate, basePrice: program.pricing.rowsData[0].prices[key] ?? 0, purchasePrice: 0 };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of program.pricing.rowsData) {
    const basePrice = row.prices[key];
    if (basePrice == null) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = Math.abs(row.rate - workbookRequestedRate);
    if (delta < bestDelta || (delta === bestDelta && row.rate > best.rate)) {
      best = { rate: row.rate, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
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

function calculateDisplayedRate(input: OsbPricingInput, workbookRate: number): number {
  if (input.program !== 'HELOC') return workbookRate;
  const program = getProgramData(input.program);
  const primeRate = Number(program.armFeatures?.['Index-PRIME'] ?? 0) * 100;
  return roundToThree(primeRate + workbookRate);
}

function toWorkbookRate(input: OsbPricingInput, displayedRate: number): number {
  if (input.program !== 'HELOC') return displayedRate;
  const program = getProgramData(input.program);
  const primeRate = Number(program.armFeatures?.['Index-PRIME'] ?? 0) * 100;
  return roundToThree(displayedRate - primeRate);
}

function calculateMonthlyPayment(input: OsbPricingInput, loanAmount: number, noteRate: number): number {
  if (loanAmount <= 0) return 0;
  if (input.program === 'HELOC') return Math.round(calculateInterestOnlyMonthlyPayment(loanAmount, noteRate));
  return Math.round(calculateAmortizingMonthlyPayment(loanAmount, noteRate, getFixedTermYears(input.product)));
}

function clampTargetPrice(program: JsonProgram, product: OsbProduct, targetPrice: number): number {
  const guideMaxPrice = getOsbProgramGuideMaxPrice(program);
  const capped = Math.min(targetPrice, guideMaxPrice);
  return program.constraints.minPrice ? Math.max(capped, program.constraints.minPrice) : capped;
}

function getOsbProgramGuideMaxPrice(program: JsonProgram): number {
  const value = program.guideMaxPrice?.default;
  if (value === null || value === undefined) {
    throw new Error(`OSB guide max price is missing from osb-ratesheet.json for ${program.sheet}`);
  }
  return value;
}

function getProgramData(program: OsbProgram): JsonProgram {
  return PROGRAMS[program === 'HELOC' ? 'heloc' : 'secondLiens'];
}

function isTier2State(input: OsbPricingInput): boolean {
  const tier1States = new Set(getProgramData(input.program).tier1States ?? []);
  return !tier1States.has(input.propertyState);
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

function findDocumentationAdjustment(rows: Array<{ label: string; value: number | null }> | undefined, label: SharedDocType): { label: string; value: number } | null {
  if (!rows) return null;
  const row = rows.find(item => item.label === label);
  return row ? { label, value: row.value ?? 0 } : null;
}

function isWorkbookEligibleCell(values: Array<number | null>, index: number | null): boolean {
  return index !== null && index >= 0 && index < values.length && values[index] !== null;
}

function getLockAdjustment(rows: Array<{ label: string; value: number | null }>, label: string): { label: string; value: number } {
  const row = rows.find(item => item.label === label);
  return { label, value: row?.value ?? 0 };
}

function lookupAdjustmentValue(row: JsonBucketRow, buckets: string[], cltv: number): number {
  const bucketIndex = findCltvBucketIndex(buckets, cltv);
  if (bucketIndex === null) return 0;
  return adjustmentBucketValue(row, bucketIndex) ?? 0;
}

function adjustmentBucketValue(row: JsonBucketRow, bucketIndex: number): number | null {
  const value = row.values[bucketIndex];
  return value == null ? null : value;
}

function findLoanAmountAdjustment(input: OsbPricingInput, amount: number): JsonBucketRow | null {
  const rows = getProgramData(input.program).adjustments.loanAmount;
  const cltvBucketIndex = findCltvBucketIndex(getProgramData(input.program).cltvBuckets, input.resultingCltv);
  return rows.find(row => amountMatchesLabel(amount, String(row.label ?? '')) && (input.program === 'HELOC' || isWorkbookEligibleCell(row.values, cltvBucketIndex))) ?? null;
}

function getOsbLoanAmountCap(input: OsbPricingInput): number | null {
  if (input.program === 'HELOC') return OSB_OVERLAY.heloc.maxLoanAmount;
  const rows = getProgramData(input.program).adjustments.loanAmount;
  const cltvBucketIndex = findCltvBucketIndex(getProgramData(input.program).cltvBuckets, input.resultingCltv);
  if (cltvBucketIndex === null) return null;
  let best: number | null = null;
  for (const row of rows) {
    if (!isWorkbookEligibleCell(row.values, cltvBucketIndex)) continue;
    const upper = upperBoundForAmountLabel(String(row.label ?? ''));
    if (upper === null) continue;
    best = best === null ? upper : Math.max(best, upper);
  }
  return best;
}

function drawTermLabel(years: 3 | 5 | 10): string {
  const labels = PROGRAMS.heloc.adjustments.drawTerm.map(row => String(row.label ?? ''));
  return labels.find(label => label.includes(String(years))) ?? `${years} Year Draw`;
}

function occupancyLoanTypeLabel(input: OsbPricingInput): string {
  if (input.occupancy === 'Investment') return 'Investor';
  if (input.occupancy === 'Second Home') return 'Second Home';
  return '';
}

function findDtiAdjustment(input: OsbPricingInput): JsonBucketRow | null {
  const dti = input.dti ?? 0;
  const rows = getProgramData(input.program).adjustments.loanType;
  return rows.find(row => String(row.label ?? '').includes('DTI') && valueMatchesLabel(dti, String(row.label ?? ''))) ?? null;
}

function isOsbScenarioSupported(input: OsbPricingInput, selectedLoanAmount: number): boolean {
  const program = getProgramData(input.program);
  const cltvBucketIndex = findCltvBucketIndex(program.cltvBuckets, input.resultingCltv);
  if (cltvBucketIndex === null) return false;

  const amount = findLoanAmountAdjustment(input, selectedLoanAmount);
  if (!amount) return false;
  if (input.program !== 'HELOC' && !isWorkbookEligibleCell(amount.values, cltvBucketIndex)) return false;

  const dti = findDtiAdjustment(input);
  if (input.program === 'HELOC') return (input.dti ?? 0) <= OSB_OVERLAY.heloc.maxDti && dti !== null;
  return dti !== null && isWorkbookEligibleCell(dti.values, cltvBucketIndex);
}

function propertyLabel(input: OsbPricingInput): string {
  if (input.unitCount > 1) return input.program === 'HELOC' ? '2 - 4 Unit Property' : 'Multi Unit';
  if (input.structureType === 'Condo') return input.propertyState === 'FL' ? 'Florida Condo' : 'Condo (Warrantable)';
  return 'Full Appraisal';
}

function productKey(product: OsbProduct): string {
  return PROGRAMS.secondLiens.pricing.products.find(item => item.label === product)?.key
    ?? PROGRAMS.heloc.pricing.products.find(item => item.label === product)?.key
    ?? '';
}

function lockPeriodLabel(days: OsbLockPeriod): string {
  const label = PROGRAMS.secondLiens.lockAdjustments.find(item => String(item.label).includes(String(days)))?.label
    ?? PROGRAMS.heloc.lockAdjustments.find(item => String(item.label).includes(String(days)))?.label;
  if (!label) throw new Error(`OSB lock period label is missing for ${days} days.`);
  return label;
}

function normalizeProgram(program?: OsbProgram, product?: string): OsbProgram {
  if (program) return program;
  return String(product || '').toUpperCase().includes('HELOC') ? 'HELOC' : '2nd Liens';
}

function requireOsbProduct(program: OsbProgram, product?: OsbProduct): OsbProduct {
  if (program === 'HELOC' && (product === '20 Year Maturity' || product === '30 Year Maturity')) return product;
  if (program === '2nd Liens' && (product === 'Fixed 10' || product === 'Fixed 15' || product === 'Fixed 20' || product === 'Fixed 30')) return product;
  throw new Error(`OSB product is missing or invalid for ${program}.`);
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

function amountMatchesLabel(amount: number, label: string): boolean {
  const text = label.replace(/,/g, '').trim();
  const gtMatch = text.match(/^>\$?(\d+(?:\.\d+)?)/);
  if (gtMatch) return amount > Number(gtMatch[1]);
  const rangeMatch = text.match(/^\$?(\d+(?:\.\d+)?)\s*-\s*\$?(\d+(?:\.\d+)?)/);
  if (rangeMatch) return amount >= Number(rangeMatch[1]) && amount <= Number(rangeMatch[2]);
  return false;
}

function valueMatchesLabel(value: number, label: string): boolean {
  const text = label.replace(/%/g, '').trim();
  const lteMatch = text.match(/^<=\s*(\d+(?:\.\d+)?)/);
  if (lteMatch) return value <= Number(lteMatch[1]);
  const gteMatch = text.match(/^>=\s*(\d+(?:\.\d+)?)/);
  if (gteMatch) return value >= Number(gteMatch[1]);
  const gtMatch = text.match(/^>\s*(\d+(?:\.\d+)?)/);
  if (gtMatch) return value > Number(gtMatch[1]);
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) return value > Number(rangeMatch[1]) && value <= Number(rangeMatch[2]);
  return false;
}

function getFixedTermYears(product: OsbProduct): number {
  const match = String(product).match(/(\d+)/);
  if (!match) throw new Error(`OSB fixed term years are missing for ${product}.`);
  return Number(match[1]);
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function upperBoundForAmountLabel(label: string): number | null {
  const text = label.replace(/,/g, '').replace(/\(UPB\)/gi, '').trim();
  const rangeMatch = text.match(/^\$?(\d+(?:\.\d+)?)\s*-\s*\$?(\d+(?:\.\d+)?)/);
  if (rangeMatch) return Number(rangeMatch[2]);
  return null;
}

function requireOsbLockPeriodDays(lockPeriodDays?: OsbLockPeriod): OsbLockPeriod {
  if (lockPeriodDays === 30 || lockPeriodDays === 45 || lockPeriodDays === 60) return lockPeriodDays;
  throw new Error('OSB lock period is missing or invalid.');
}

function requireHelocDrawTermYears(years?: 3 | 5 | 10): 3 | 5 | 10 {
  if (years === 3 || years === 5 || years === 10) return years;
  throw new Error('OSB HELOC draw term is missing or invalid.');
}
