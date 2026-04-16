import ratesheet from './newrez-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';

export type NewRezProduct = '15 Year Fixed' | '20 Year Fixed' | '30 Year Fixed';
export type NewRezEndSeconds = 'BE15' | 'BE30' | 'BE45' | 'BE60' | 'BE75' | 'BE90';

export interface NewRezPricingInput {
  product: NewRezProduct;
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
  selfEmployed: boolean;
  dti: number | null;
}

export interface NewRezAdjustmentLine {
  label: string;
  value: number;
}

export interface NewRezQuote {
  program: 'NewRez';
  product: NewRezProduct;
  endSeconds: NewRezEndSeconds;
  maxAvailable: number;
  maxLtv: number;
  rate: number;
  noteRate: number;
  rateType: string;
  monthlyPayment: number;
  basePrice: number;
  llpaAdjustment: number;
  purchasePrice: number;
  adjustments: NewRezAdjustmentLine[];
}

export interface NewRezTargetRateQuote extends NewRezQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
  withinToleranceAllowOverage: boolean;
}

export interface NewRezEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type JsonBucketRow = { label: string; values: Array<number | null> };
type JsonPricingRow = { noteRate: number; prices: Record<NewRezEndSeconds, number | null> };
type JsonProductSheet = { columns: NewRezEndSeconds[]; rows: JsonPricingRow[] };
type JsonMatrix = { cltvBuckets: string[]; rows: JsonBucketRow[] };
type JsonRatesheet = {
  pricing: Record<NewRezProduct, JsonProductSheet>;
  cltv30: JsonMatrix;
  cltv1520: JsonMatrix;
  additional: JsonMatrix;
  loanAmount: JsonMatrix;
};

type SelectedExecution = {
  noteRate: number;
  endSeconds: NewRezEndSeconds;
  basePrice: number;
  purchasePrice: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
};

const DATA = ratesheet as JsonRatesheet;
const DEFAULT_NEWREZ_END_SECONDS: NewRezEndSeconds = 'BE45';

export function buildNewRezStage1PricingInput(stage1: ButtonStage1Input & { newrezProduct?: NewRezProduct }): NewRezPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    product: normalizeProduct(stage1.newrezProduct),
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
    selfEmployed: false,
    dti: null,
  };
}

export function calculateNewRezStage1Quote(
  stage1: ButtonStage1Input & { newrezProduct?: NewRezProduct },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): NewRezQuote {
  return calculateNewRezQuote(buildNewRezStage1PricingInput(stage1), options);
}

export function calculateNewRezQuote(input: NewRezPricingInput, options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }): NewRezQuote {
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const targetPrice = options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickExecution(input.product, llpaAdjustment, targetPrice, undefined, options?.rateOverride);

  return {
    program: 'NewRez',
    product: input.product,
    endSeconds: selected.endSeconds,
    maxAvailable,
    maxLtv: calculateMaxLtv(input),
    rate: selected.noteRate,
    noteRate: selected.noteRate,
    rateType: 'Fixed',
    monthlyPayment: calculateMonthlyPayment(selectedLoanAmount, selected.noteRate, termYears(input.product)),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    adjustments: [...adjustments, { label: `End Seconds: ${selected.endSeconds}`, value: 0 }],
  };
}

export function evaluateNewRezStage1Eligibility(
  stage1: ButtonStage1Input & { newrezProduct?: NewRezProduct },
  selectedLoanAmount?: number
): NewRezEligibilityResult {
  return evaluateNewRezEligibility(buildNewRezStage1PricingInput(stage1), selectedLoanAmount);
}

export function evaluateNewRezEligibility(input: NewRezPricingInput, selectedLoanAmount?: number): NewRezEligibilityResult {
  const reasons: string[] = [];
  const maxAvailable = calculateMaxAvailable(input);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const matrix = getCltvMatrix(input.product);

  if (!findCreditRow(matrix, input.creditScore)) reasons.push('Credit score is outside the NewRez matrix.');
  if (findCltvBucketIndex(matrix.cltvBuckets, input.resultingCltv) === null) reasons.push('Resulting CLTV is outside the NewRez matrix.');
  if (findLoanAmountRow(requested) === null) reasons.push('Desired loan amount is outside the NewRez loan amount table.');
  if (requested > maxAvailable) reasons.push('Desired loan amount exceeds the current max available amount.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
    resultingCltv: input.resultingCltv,
  };
}

export function solveNewRezStage1TargetRate(
  stage1: ButtonStage1Input & { newrezProduct?: NewRezProduct },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): NewRezTargetRateQuote {
  const input = buildNewRezStage1PricingInput(stage1);
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const targetPrice = options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);
  const tolerance = options.tolerance ?? 0.125;
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickExecution(input.product, llpaAdjustment, targetPrice, tolerance);

  return {
    program: 'NewRez',
    product: input.product,
    endSeconds: selected.endSeconds,
    maxAvailable,
    maxLtv: calculateMaxLtv(input),
    rate: selected.noteRate,
    noteRate: selected.noteRate,
    rateType: 'Fixed',
    monthlyPayment: calculateMonthlyPayment(selectedLoanAmount, selected.noteRate, termYears(input.product)),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    adjustments: [...adjustments, { label: `End Seconds: ${selected.endSeconds}`, value: 0 }],
    targetPrice: roundToThree(targetPrice),
    tolerance,
    deltaFromTarget: selected.deltaFromTarget,
    withinTolerance: selected.withinTolerance,
    withinToleranceAllowOverage: selected.deltaFromTarget >= -tolerance && selected.deltaFromTarget <= tolerance,
  };
}

function getCltvMatrix(product: NewRezProduct): JsonMatrix {
  return product === '30 Year Fixed' ? DATA.cltv30 : DATA.cltv1520;
}

function calculateMaxAvailable(input: NewRezPricingInput): number {
  return Math.max(0, input.propertyValue * calculateMaxLtv(input) - input.loanBalance);
}

function calculateMaxLtv(input: NewRezPricingInput): number {
  const matrix = getCltvMatrix(input.product);
  const row = findCreditRow(matrix, input.creditScore);
  if (!row) return 0;

  const lastEligibleIndex = row.values.reduce<number>((best, value, index) => value !== null ? index : best, -1);
  if (lastEligibleIndex < 0) return 0;
  return upperBoundForCltvLabel(matrix.cltvBuckets[lastEligibleIndex]) / 100;
}

function buildAdjustmentLines(input: NewRezPricingInput, selectedLoanAmount: number): NewRezAdjustmentLine[] {
  const matrix = getCltvMatrix(input.product);
  const cltvIndex = findCltvBucketIndex(matrix.cltvBuckets, input.resultingCltv);
  const adjustments: NewRezAdjustmentLine[] = [];
  if (cltvIndex === null) return adjustments;

  const creditRow = findCreditRow(matrix, input.creditScore);
  if (creditRow) {
    adjustments.push({
      label: `FICO / CLTV: ${creditRow.label} @ ${matrix.cltvBuckets[cltvIndex]}`,
      value: creditRow.values[cltvIndex] ?? 0,
    });
  }

  const occupancy = findAdditionalRow(occupancyLabel(input.occupancy));
  if (occupancy) adjustments.push({ label: `Occupancy: ${occupancy.label}`, value: occupancy.values[cltvIndex] ?? 0 });

  if (isCondo(input.structureType)) {
    const condo = findAdditionalRow('Condo');
    if (condo) adjustments.push({ label: 'Property Type: Condo', value: condo.values[cltvIndex] ?? 0 });
  }

  if (input.selfEmployed) {
    const selfEmployed = findAdditionalRow('Self Employeed');
    if (selfEmployed) adjustments.push({ label: 'Borrower: Self Employed', value: selfEmployed.values[cltvIndex] ?? 0 });
  }

  if (input.dti !== null && input.dti > 43) {
    const dti = findAdditionalRow('DTI >43%');
    if (dti) adjustments.push({ label: 'DTI: > 43%', value: dti.values[cltvIndex] ?? 0 });
  }

  const amount = findLoanAmountRow(selectedLoanAmount);
  if (amount) adjustments.push({ label: `Loan Amount: ${amount.label}`, value: amount.values[cltvIndex] ?? 0 });

  return adjustments.filter(row => Number.isFinite(row.value));
}

function pickExecution(product: NewRezProduct, llpaAdjustment: number, targetPrice: number, tolerance?: number, rateOverride?: number): SelectedExecution {
  const sheet = DATA.pricing[product];
  const executionColumn = sheet.columns.includes(DEFAULT_NEWREZ_END_SECONDS) ? DEFAULT_NEWREZ_END_SECONDS : sheet.columns[0];
  const executions: SelectedExecution[] = [];

  for (const row of sheet.rows) {
    const basePrice = row.prices[executionColumn];
    if (basePrice === null) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const deltaFromTarget = roundToThree(roundToThree(targetPrice) - purchasePrice);
    executions.push({
      noteRate: row.noteRate,
      endSeconds: executionColumn,
      basePrice,
      purchasePrice,
      deltaFromTarget,
      withinTolerance: tolerance === undefined ? false : deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
    });
  }

  if (rateOverride !== undefined) {
    return executions.sort((a, b) => Math.abs(a.noteRate - rateOverride) - Math.abs(b.noteRate - rateOverride) || (b.purchasePrice - a.purchasePrice))[0];
  }

  const belowOrEqual = executions
    .filter(item => item.purchasePrice <= targetPrice)
    .sort((a, b) => (b.purchasePrice - a.purchasePrice) || (a.noteRate - b.noteRate));
  if (belowOrEqual.length > 0) return belowOrEqual[0];

  return executions.sort((a, b) => Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || (b.purchasePrice - a.purchasePrice) || (a.noteRate - b.noteRate))[0];
}

function findCreditRow(matrix: JsonMatrix, creditScore: number): JsonBucketRow | null {
  return matrix.rows.find(row => matchesCreditScoreLabel(row.label, creditScore)) ?? null;
}

function findCltvBucketIndex(labels: string[], cltv: number): number | null {
  const pct = cltv * 100;
  for (let i = 0; i < labels.length; i += 1) {
    const upper = upperBoundForCltvLabel(labels[i]);
    if (pct <= upper) return i;
  }
  return null;
}

function findAdditionalRow(label: string): JsonBucketRow | null {
  return DATA.additional.rows.find(row => row.label === label) ?? null;
}

function findLoanAmountRow(loanAmount: number): JsonBucketRow | null {
  return DATA.loanAmount.rows.find(row => matchesLoanAmountLabel(row.label, loanAmount)) ?? null;
}

function matchesCreditScoreLabel(label: string, score: number): boolean {
  const clean = label.replace(/\s+/g, '');
  if (clean.startsWith('>=')) return score >= Number(clean.slice(2));
  const match = clean.match(/^(\d+)-(\d+)$/);
  if (match) return score >= Number(match[1]) && score <= Number(match[2]);
  return false;
}

function upperBoundForCltvLabel(label: string): number {
  const trimmed = label.trim();
  if (trimmed.startsWith('>')) return 100;
  if (trimmed.startsWith('<=')) {
    const match = trimmed.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }
  const range = trimmed.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return Number(range[2].replace('%', ''));
  const single = trimmed.match(/(\d+(?:\.\d+)?)/);
  return single ? Number(single[1]) : 0;
}

function matchesLoanAmountLabel(label: string, amount: number): boolean {
  const normalized = label.replace(/\s+/g, '');
  if (normalized === '50000') return amount <= 50000;
  if (normalized.includes('>$250,000')) return amount > 250000;
  if (normalized.includes('>$100,000<=$250,000')) return amount > 100000 && amount <= 250000;
  if (normalized.includes('>$50,000<=$100,000')) return amount > 50000 && amount <= 100000;
  return false;
}

function calculateMonthlyPayment(loanAmount: number, noteRate: number, years: number): number {
  const monthlyRate = noteRate / 100 / 12;
  const payments = years * 12;
  if (monthlyRate === 0) return loanAmount / Math.max(payments, 1);
  const factor = Math.pow(1 + monthlyRate, payments);
  return loanAmount * ((monthlyRate * factor) / (factor - 1));
}

function normalizeProduct(product?: string): NewRezProduct {
  if (product === '15 Year Fixed' || product === '20 Year Fixed' || product === '30 Year Fixed') return product;
  return '30 Year Fixed';
}

function normalizeOccupancy(value?: string): string {
  if (value === 'Second Home' || value === 'Investment') return value;
  return 'Owner-Occupied';
}

function normalizeStructureType(value?: string): string {
  return String(value || 'SFR');
}

function occupancyLabel(occupancy: string): string {
  if (occupancy === 'Second Home') return 'Second Home';
  if (occupancy === 'Investment') return 'Investment';
  return 'Primary';
}

function isCondo(structureType: string): boolean {
  return structureType.toLowerCase().includes('condo');
}

function termYears(product: NewRezProduct): number {
  if (product === '15 Year Fixed') return 15;
  if (product === '20 Year Fixed') return 20;
  return 30;
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}
