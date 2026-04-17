import ratesheet from './vista-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';

export type VistaProgram = 'Second OO' | 'Second NOO';
export type VistaProduct = '10yr Fixed' | '15yr Fixed' | '20yr Fixed' | '30yr Fixed';
export type VistaDocType = 'Full Doc' | 'Bank Statement';

export interface VistaPricingInput {
  product: VistaProduct;
  docType: VistaDocType;
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
}

export interface VistaAdjustmentLine {
  label: string;
  value: number;
}

export interface VistaQuote {
  program: VistaProgram;
  maxAvailable: number;
  maxLtv: number;
  rate: number;
  noteRate: number;
  rateType: string;
  monthlyPayment: number;
  basePrice: number;
  llpaAdjustment: number;
  purchasePrice: number;
  adjustments: VistaAdjustmentLine[];
  product: VistaProduct;
}

export interface VistaTargetRateQuote extends VistaQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
  withinToleranceAllowOverage: boolean;
}

export interface VistaEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type ProgramKey = 'secondOO' | 'secondNOO';
type JsonAdjustmentItem = { label: string; lookupKey: string; value: number | null };
type JsonPricingRow = { noteRate: number; basePrice: number };
type JsonCltvRow = { creditScore: string; values: Array<number | null> };
type JsonProgram = {
  inputCode: string;
  inputName: VistaProgram;
  sections: {
    pricing30Day: {
      rows: number[];
      rowsData: JsonPricingRow[];
      maxPrice: Record<string, number | null>;
      minPrice: Record<string, number | null>;
    };
    cltvFullDoc: {
      rowRange: number[];
      cltvBuckets: string[];
      rows: JsonCltvRow[];
    };
    cltvBankStatement?: {
      rowRange: number[];
      cltvBuckets: string[];
      rows: JsonCltvRow[];
    };
    adjustments: Record<string, { rows: number[]; items: JsonAdjustmentItem[] }>;
  };
};

const VISTA_PRODUCTS: VistaProduct[] = ['10yr Fixed', '15yr Fixed', '20yr Fixed', '30yr Fixed'];
const PROGRAMS = (ratesheet as unknown as { programs: Record<ProgramKey, JsonProgram> }).programs;

export function buildVistaStage1PricingInput(stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType }): VistaPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    product: normalizeVistaProduct(stage1.vistaProduct),
    docType: normalizeVistaDocType(stage1.vistaDocType),
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
  };
}

export function calculateVistaStage1Quote(
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): VistaQuote {
  return calculateVistaQuote(buildVistaStage1PricingInput(stage1), options);
}

export function calculateVistaQuote(
  input: VistaPricingInput,
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): VistaQuote {
  const programKey = getProgramKey(input);
  const program = PROGRAMS[programKey];
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const targetPrice = Math.min(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), getMaxPrice(program));
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = options?.rateOverride !== undefined
    ? pickRateClosestToRequested(program, llpaAdjustment, options.rateOverride)
    : pickRateAtOrBelowTarget(program, llpaAdjustment, targetPrice);

  return {
    program: program.inputName,
    maxAvailable,
    maxLtv: calculateMaxLtv(input),
    rate: selected.noteRate,
    noteRate: selected.noteRate,
    rateType: 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input.product, selected.noteRate, selectedLoanAmount),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    adjustments,
    product: input.product,
  };
}

export function evaluateVistaStage1Eligibility(
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType },
  selectedLoanAmount?: number
): VistaEligibilityResult {
  const input = buildVistaStage1PricingInput(stage1);
  const reasons: string[] = [];
  const maxAvailable = calculateMaxAvailable(input);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const program = PROGRAMS[getProgramKey(input)];

  const docMatrix = getCltvMatrix(program, input.docType);

  if (!docMatrix) reasons.push(`Vista ${input.docType} pricing is not available in the workbook.`);
  if (docMatrix && !findCltvRow(program, input.creditScore, input.docType)) reasons.push(`Credit score is outside the Vista ${input.docType} matrix.`);
  if (docMatrix && findCltvBucketIndex(program, input.resultingCltv, input.docType) === null) reasons.push(`Resulting CLTV is outside the Vista ${input.docType} matrix.`);
  if (!findAdjustment(program, 'term', input.product)) reasons.push('Selected term is not available in the Vista ratesheet.');
  if (!findAdjustment(program, 'loanAmount', loanAmountLabel(requested))) reasons.push('Desired loan amount is outside the Vista loan amount table.');
  if (requested > maxAvailable) reasons.push('Desired loan amount exceeds the current max available amount.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
    resultingCltv: input.resultingCltv,
  };
}

export function solveVistaStage1TargetRate(
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): VistaTargetRateQuote {
  const input = buildVistaStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const program = PROGRAMS[getProgramKey(input)];
  const targetPrice = Math.min(options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), getMaxPrice(program));
  const tolerance = options.tolerance ?? 0.125;
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickRateAtOrBelowTarget(program, llpaAdjustment, targetPrice);
  const deltaFromTarget = roundToThree(targetPrice - selected.purchasePrice);

  return {
    program: program.inputName,
    maxAvailable: calculateMaxAvailable(input),
    maxLtv: calculateMaxLtv(input),
    rate: selected.noteRate,
    noteRate: selected.noteRate,
    rateType: 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input.product, selected.noteRate, selectedLoanAmount),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    adjustments,
    product: input.product,
    targetPrice,
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
    withinToleranceAllowOverage: deltaFromTarget >= -tolerance && deltaFromTarget <= tolerance,
  };
}

function getProgramKey(input: VistaPricingInput): ProgramKey {
  return input.occupancy === 'Investment' ? 'secondNOO' : 'secondOO';
}

function calculateMaxAvailable(input: VistaPricingInput): number {
  return Math.max(0, input.propertyValue * calculateMaxLtv(input) - input.loanBalance);
}

function calculateMaxLtv(input: VistaPricingInput): number {
  const program = PROGRAMS[getProgramKey(input)];
  const matrix = getCltvMatrix(program, input.docType);
  if (!matrix) return 0;
  const row = findCltvRow(program, input.creditScore, input.docType);
  if (!row) return 0;

  const lastEligibleIndex = row.values.reduce<number>((best, value, index) => value !== null ? index : best, -1);
  if (lastEligibleIndex < 0) return 0;
  return upperBoundForCltvLabel(matrix.cltvBuckets[lastEligibleIndex]) / 100;
}

function buildAdjustmentLines(input: VistaPricingInput, selectedLoanAmount: number): VistaAdjustmentLine[] {
  const program = PROGRAMS[getProgramKey(input)];
  const adjustments: VistaAdjustmentLine[] = [];
  const cltv = buildCltvAdjustment(program, input.creditScore, input.resultingCltv, input.docType);
  if (cltv) adjustments.push(cltv);

  const term = findAdjustment(program, 'term', input.product);
  if (term) adjustments.push({ label: `Term: ${term.label}`, value: term.value ?? 0 });

  const lockTerm = findAdjustment(program, 'lockTerm', '45 Day');
  if (lockTerm) adjustments.push({ label: `Lock Period: ${lockTerm.label}`, value: lockTerm.value ?? 0 });

  const amountLabel = loanAmountLabel(selectedLoanAmount);
  const loanAmount = findAdjustment(program, 'loanAmount', amountLabel);
  if (loanAmount) adjustments.push({ label: `Loan Amount: ${loanAmount.label}`, value: loanAmount.value ?? 0 });

  const occupancyLabel = occupancyAdjustmentLabel(input.occupancy);
  const occupancy = findAdjustment(program, 'occupancy', occupancyLabel);
  if (occupancy) adjustments.push({ label: `Occupancy: ${occupancy.label}`, value: occupancy.value ?? 0 });

  if (input.cashOut) {
    const purpose = findAdjustment(program, 'purpose', 'Cash-Out');
    if (purpose) adjustments.push({ label: `Purpose: ${purpose.label}`, value: purpose.value ?? 0 });
  }

  const propertyType = findAdjustment(program, 'propertyType', propertyTypeLabel(input));
  if (propertyType) adjustments.push({ label: `Property Type: ${propertyType.label}`, value: propertyType.value ?? 0 });

  return adjustments;
}

function buildCltvAdjustment(program: JsonProgram, creditScore: number, cltv: number, docType: VistaDocType): VistaAdjustmentLine | null {
  const matrix = getCltvMatrix(program, docType);
  const row = findCltvRow(program, creditScore, docType);
  const bucketIndex = findCltvBucketIndex(program, cltv, docType);
  if (!matrix || !row || bucketIndex === null) return null;

  const label = `${row.creditScore} / CLTV ${matrix.cltvBuckets[bucketIndex]}`;
  return { label: `${docType} CLTV: ${label}`, value: row.values[bucketIndex] ?? 0 };
}

function getCltvMatrix(program: JsonProgram, docType: VistaDocType): JsonProgram['sections']['cltvFullDoc'] | NonNullable<JsonProgram['sections']['cltvBankStatement']> | null {
  return docType === 'Bank Statement' ? program.sections.cltvBankStatement ?? null : program.sections.cltvFullDoc;
}

function findCltvRow(program: JsonProgram, creditScore: number, docType: VistaDocType): JsonCltvRow | null {
  return getCltvMatrix(program, docType)?.rows.find(row => matchesCreditScoreLabel(row.creditScore, creditScore)) ?? null;
}

function findCltvBucketIndex(program: JsonProgram, cltv: number, docType: VistaDocType): number | null {
  const cltvPct = cltv * 100;
  const buckets = getCltvMatrix(program, docType)?.cltvBuckets;
  if (!buckets) return null;
  for (let i = 0; i < buckets.length; i += 1) {
    if (cltvPct <= upperBoundForCltvLabel(buckets[i])) return i;
  }
  return null;
}

function findAdjustment(program: JsonProgram, category: string, label: string): JsonAdjustmentItem | null {
  const items = program.sections.adjustments[category]?.items ?? [];
  return items.find(item => item.label === label) ?? null;
}

function getMaxPrice(program: JsonProgram): number {
  const values = Object.values(program.sections.pricing30Day.maxPrice).filter((value): value is number => typeof value === 'number');
  return values.length ? Math.max(...values) : 105;
}

function pickRateClosestToRequested(
  program: JsonProgram,
  llpaAdjustment: number,
  requestedRate: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let best = { noteRate: program.sections.pricing30Day.rowsData[0].noteRate, basePrice: program.sections.pricing30Day.rowsData[0].basePrice, purchasePrice: 0 };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of program.sections.pricing30Day.rowsData) {
    const purchasePrice = roundToThree(row.basePrice + llpaAdjustment);
    const delta = Math.abs(row.noteRate - requestedRate);
    if (delta < bestDelta || (delta === bestDelta && row.noteRate > best.noteRate)) {
      best = { noteRate: row.noteRate, basePrice: row.basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickRateAtOrBelowTarget(
  program: JsonProgram,
  llpaAdjustment: number,
  targetPrice: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let bestUnder: { noteRate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { noteRate: program.sections.pricing30Day.rowsData[0].noteRate, basePrice: program.sections.pricing30Day.rowsData[0].basePrice, purchasePrice: 0 };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of program.sections.pricing30Day.rowsData) {
    const purchasePrice = roundToThree(row.basePrice + llpaAdjustment);
    if (purchasePrice <= targetPrice && (!bestUnder || purchasePrice > bestUnder.purchasePrice)) {
      bestUnder = { noteRate: row.noteRate, basePrice: row.basePrice, purchasePrice };
    }
    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < fallbackDelta || (delta === fallbackDelta && purchasePrice > fallback.purchasePrice)) {
      fallback = { noteRate: row.noteRate, basePrice: row.basePrice, purchasePrice };
      fallbackDelta = delta;
    }
  }

  return bestUnder ?? fallback;
}

function calculateMonthlyPayment(product: VistaProduct, noteRate: number, loanAmount: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = noteRate / 100 / 12;
  const amortYears = product === '10yr Fixed' ? 10 : product === '15yr Fixed' ? 15 : product === '20yr Fixed' ? 20 : 30;
  const payments = amortYears * 12;
  return roundToNearestDollar(loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1));
}

function occupancyAdjustmentLabel(occupancy: string): string {
  if (occupancy === 'Second Home') return 'Second Home';
  if (occupancy === 'Investment') return 'Non Owner Occupied';
  return 'Owner Occupied';
}

function propertyTypeLabel(input: VistaPricingInput): string {
  if (input.unitCount === 2) return '2-Unit';
  if (input.unitCount === 3) return '3-Unit';
  if (input.unitCount >= 4) return '4-Unit';
  if (input.structureType === 'Condo') return 'Condo-Warrantable';
  if (input.structureType === 'Townhome') return 'Townhouse';
  if (input.structureType === 'PUD') return 'PUD';
  return 'SFR';
}

function loanAmountLabel(amount: number): string {
  if (amount <= 50000) return '000,000-050k';
  if (amount <= 75000) return '050,001-075k';
  if (amount <= 100000) return '075,001-100k';
  if (amount <= 125000) return '100,001-125k';
  if (amount <= 150000) return '125,001-150k';
  if (amount <= 175000) return '150,001-175k';
  if (amount <= 200000) return '175,001-200k';
  if (amount <= 300000) return '200,001-300k';
  if (amount <= 400000) return '300,001-400k';
  if (amount <= 600000) return '400,001-600k';
  if (amount <= 750000) return '600,001-750k';
  if (amount <= 1000000) return '750,001-850k';
  if (amount <= 1500000) return '1,000,001-1.5m';
  if (amount <= 2000000) return '1,500,001-2.0m';
  if (amount <= 2500000) return '2,000,001-2.5m';
  if (amount <= 3000000) return '2,500,001-3.0m';
  if (amount <= 3500000) return '3,000,001-3.5m';
  if (amount <= 4000000) return '3,500,001-4.0m';
  if (amount <= 4500000) return '4,000,001-4.5m';
  if (amount <= 5000000) return '4,500,001-5.0m';
  return '5,000,001+';
}

function matchesCreditScoreLabel(label: string, creditScore: number): boolean {
  const text = label.replace('≥', '>=').trim();
  if (text.startsWith('>=')) return creditScore >= Number(text.replace('>=', '').trim());
  const parts = text.split('-').map(part => Number(part.trim()));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return creditScore >= parts[0] && creditScore <= parts[1];
  }
  return false;
}

function upperBoundForCltvLabel(label: string): number {
  const right = label.split('-')[1] ?? label;
  return Number(String(right).replace('%', '').trim());
}

function normalizeVistaProduct(product?: string): VistaProduct {
  if (VISTA_PRODUCTS.includes(product as VistaProduct)) return product as VistaProduct;
  return '30yr Fixed';
}

function normalizeVistaDocType(docType?: string): VistaDocType {
  return String(docType || '').toLowerCase().includes('bank') ? 'Bank Statement' : 'Full Doc';
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
  if (value.includes('multi')) return '2-4 Unit';
  return 'SFR';
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToNearestDollar(value: number): number {
  return Math.round(value);
}
