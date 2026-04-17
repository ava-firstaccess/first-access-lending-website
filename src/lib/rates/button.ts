import ratesheet from './button-ratesheet.json';
import type { Stage1AdjustmentLine } from './shared';

export type ButtonProduct = 'HELOC' | 'CES';
export type ButtonDocType = 'Full Doc' | 'Bank Statement' | 'Asset Depletion';

export interface ButtonPricingInput {
  product: ButtonProduct;
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
  dti: number | null;
  docType: ButtonDocType;
  selfEmployed: boolean;
  bankStatementMonths: number | null;
}

export interface ButtonPricingAssumptions {
  dti: string;
  docType: string;
  selfEmployed: string;
  bankStatementMonths: string;
}

export interface ButtonStage1Input {
  buttonProduct?: string;
  product?: string;
  propertyState?: string;
  propertyValue?: number;
  loanBalance?: number;
  desiredLoanAmount?: number;
  creditScore?: number;
  dti?: number;
  occupancy?: string;
  structureType?: string;
  numberOfUnits?: number;
  cashOut?: boolean;
  buttonTermYears?: 10 | 15 | 20 | 25 | 30;
  buttonDocType?: ButtonDocType;
}

export interface ButtonQuote {
  maxAvailable: number;
  rate: number;
  monthlyPayment: number;
  maxLtv: number;
  rateType: string;
  noteRate: number;
  purchasePrice: number;
  llpaAdjustment: number;
  basePrice: number;
  adjustments: Stage1AdjustmentLine[];
}

export interface ButtonTargetRateQuote extends ButtonQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
  withinToleranceAllowOverage: boolean;
}

export interface ButtonEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type RateRow = {
  noteRate: number;
  prices: {
    fullDoc: { HELOC: number; CES: number };
    altDoc: { HELOC: number; CES: number | null };
  };
};

type Matrix = Array<Array<number | string | null>>;

const NOTE_RATE_ROWS = ratesheet.noteRates as unknown as RateRow[];
const CLTV_MATRIX = ratesheet.tables.cltv as { rows: string[]; columns: string[]; fullDoc: Matrix; altDoc: Matrix };
const CASH_OUT_TABLE = ratesheet.tables.cashOut as { rows: string[]; columns: Array<string | null>; values: Matrix };
const DTI_TABLE = ratesheet.tables.dti as { rows: string[]; columns: Array<string | number | null>; values: Matrix };
const OCCUPANCY_TABLE = ratesheet.tables.occupancy as { rows: string[]; columns: Array<string | number | null>; values: Matrix };
const UNIT_COUNT_TABLE = ratesheet.tables.unitCount as { rows: string[]; columns: Array<string | number | null>; values: Matrix };
const MATURITY_TABLE = ratesheet.tables.maturity as { rows: string[]; columns: Array<string | number | null>; values: Matrix };
const DRAW_TABLE = ratesheet.tables.draw as {
  heloc: { rows: string[]; columns: Array<string | number | null>; values: Matrix };
  nonHeloc: { rows: string[]; columns: Array<string | number | null>; values: Matrix };
};

const BUTTON_MAX_PURCHASE_PRICE = 105;
const BUTTON_45_DAY_LOCK_ADJUSTMENT = 0.125;

const SECOND_LIEN_MARGIN_TARGETS = [
  { min: 0, max: 100000, backendFee: 0.06 },
  { min: 100000, max: 150000, backendFee: 0.06 },
  { min: 150000, max: 200000, backendFee: 0.05 },
  { min: 200000, max: 250000, backendFee: 0.045 },
  { min: 250000, max: 300000, backendFee: 0.04 },
  { min: 300000, max: 350000, backendFee: 0.035 },
  { min: 350000, max: 400000, backendFee: 0.0325 },
  { min: 400000, max: 450000, backendFee: 0.03 },
  { min: 450000, max: 500000, backendFee: 0.0275 },
  { min: 500000, max: 600000, backendFee: 0.025 },
  { min: 600000, max: 700000, backendFee: 0.02 },
  { min: 700000, max: 800000, backendFee: 0.02 },
  { min: 800000, max: 900000, backendFee: 0.02 },
  { min: 900000, max: 1000000, backendFee: 0.02 },
] as const;

const FICO_BUCKETS = [
  { max: 639, label: 'FICO 620 - 639' },
  { max: 659, label: 'FICO 640 - 659' },
  { max: 679, label: 'FICO 660 - 679' },
  { max: 699, label: 'FICO 680 - 699' },
  { max: 719, label: 'FICO 700 - 719' },
  { max: 739, label: 'FICO 720 - 739' },
  { max: 759, label: 'FICO 740 - 759' },
  { max: 779, label: 'FICO 760 - 779' },
  { max: Number.POSITIVE_INFINITY, label: 'FICO 780+' },
];

const CLTV_BUCKETS = [
  { max: 0.60, label: '<= 60%' },
  { max: 0.65, label: '60.01 - 65%' },
  { max: 0.70, label: '65.01 - 70%' },
  { max: 0.75, label: '70.01 - 75%' },
  { max: 0.80, label: '75.01 - 80%' },
  { max: 0.85, label: '80.01 - 85%' },
  { max: 0.90, label: '85.01 - 90%' },
];

export function buildButtonStage1PricingInput(stage1: ButtonStage1Input): ButtonPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    product: normalizeProduct(stage1.buttonProduct ?? stage1.product),
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
    docType: stage1.buttonDocType ?? 'Full Doc',
    selfEmployed: false,
    bankStatementMonths: null,
  };
}

export function getButtonStage1Assumptions(): ButtonPricingAssumptions {
  return {
    dti: 'Not collected in stage 1 yet. Defaulting outside LLPA logic for version 1.',
    docType: 'Defaulting to Full Doc for version 1.',
    selfEmployed: 'Defaulting to false for version 1.',
    bankStatementMonths: 'Not collected in stage 1 yet. Not used in version 1.',
  };
}

export function calculateButtonQuote(
  input: ButtonPricingInput,
  options?: {
    selectedLoanAmount?: number;
    targetPrice?: number;
    rateOverride?: number;
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): ButtonQuote {
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? maxAvailable);
  const targetPrice = Math.min(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), BUTTON_MAX_PURCHASE_PRICE);
  const docKey = input.docType === 'Full Doc' ? 'fullDoc' : 'altDoc';

  const ficoIndex = getFicoBucketIndex(input.creditScore);
  const cltvIndex = getCltvBucketIndex(input.resultingCltv);
  const cltvAdj = getMatrixValue(CLTV_MATRIX[docKey], ficoIndex, cltvIndex);

  const adjustments = buildAdjustmentLines(input, cltvIndex, options);
  const llpaAdjustment = roundToThree(cltvAdj + adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = options?.rateOverride !== undefined
    ? pickNoteRateClosestToRequested(input.product, docKey, llpaAdjustment, options.rateOverride)
    : pickNoteRateAtOrBelowTarget(input.product, docKey, llpaAdjustment, targetPrice);

  const monthlyPayment = calculateMonthlyPayment(input.product, selected.noteRate, selected.purchasePrice, selectedLoanAmount, options);

  return {
    maxAvailable,
    rate: selected.noteRate,
    monthlyPayment,
    maxLtv: calculateMaxLtv(input),
    rateType: input.product === 'HELOC' ? 'Variable' : 'Fixed',
    noteRate: selected.noteRate,
    purchasePrice: roundToThree(selected.purchasePrice),
    llpaAdjustment,
    basePrice: selected.basePrice,
    adjustments,
  };
}

export function calculateButtonStage1Quote(
  stage1: ButtonStage1Input,
  options?: {
    selectedLoanAmount?: number;
    targetPrice?: number;
    rateOverride?: number;
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): ButtonQuote {
  return calculateButtonQuote(buildButtonStage1PricingInput(stage1), options);
}

export function evaluateButtonEligibility(input: ButtonPricingInput, selectedLoanAmount?: number): ButtonEligibilityResult {
  const reasons: string[] = [];
  const maxAvailable = calculateMaxAvailable(input);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);

  if (input.creditScore < 620) {
    reasons.push('Credit score is below the current supported Button pricing range.');
  }

  const maxLtv = calculateMaxLtv(input);

  if (maxLtv <= 0) {
    reasons.push('This occupancy and property configuration is not eligible with the current Button guide.');
  } else if (input.resultingCltv > maxLtv) {
    reasons.push(`Resulting CLTV exceeds the current Button max of ${(maxLtv * 100).toFixed(0)}%.`);
  }

  if (requested > maxAvailable) {
    reasons.push('Desired loan amount exceeds the current max available amount.');
  }

  if (input.dti !== null && input.dti > 60) {
    reasons.push('Button DTI adjustments are only workbook-backed through 60.00%.');
  }

  if (input.product === 'CES' && input.docType !== 'Full Doc') {
    reasons.push(`Button ${input.docType} pricing is not available for CES in the current workbook.`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
    resultingCltv: input.resultingCltv,
  };
}

export function getBackendFeeForLoanAmount(loanAmount: number): number {
  const amount = Math.max(0, loanAmount);
  const match = SECOND_LIEN_MARGIN_TARGETS.find(row => amount >= row.min && amount <= row.max);
  return match?.backendFee ?? SECOND_LIEN_MARGIN_TARGETS[SECOND_LIEN_MARGIN_TARGETS.length - 1].backendFee;
}

export function getTargetPurchasePriceForLoanAmount(loanAmount: number): number {
  return roundToThree(100 + getBackendFeeForLoanAmount(loanAmount) * 100);
}

export function evaluateButtonStage1Eligibility(stage1: ButtonStage1Input, selectedLoanAmount?: number): ButtonEligibilityResult {
  return evaluateButtonEligibility(buildButtonStage1PricingInput(stage1), selectedLoanAmount);
}

export function solveButtonStage1TargetRate(
  stage1: ButtonStage1Input,
  options: {
    targetPrice: number;
    tolerance?: number;
    selectedLoanAmount?: number;
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): ButtonTargetRateQuote {
  const input = buildButtonStage1PricingInput(stage1);
  const docKey = input.docType === 'Full Doc' ? 'fullDoc' : 'altDoc';
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = Math.min(options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), BUTTON_MAX_PURCHASE_PRICE);
  const tolerance = options.tolerance ?? 0.125;

  const ficoIndex = getFicoBucketIndex(input.creditScore);
  const cltvIndex = getCltvBucketIndex(input.resultingCltv);
  const cltvAdj = getMatrixValue(CLTV_MATRIX[docKey], ficoIndex, cltvIndex);
  const adjustments = buildAdjustmentLines(input, cltvIndex, options);
  const llpaAdjustment = roundToThree(cltvAdj + adjustments.reduce((sum, row) => sum + row.value, 0));

  const selected = pickNoteRateAtOrBelowTarget(input.product, docKey, llpaAdjustment, targetPrice);
  const monthlyPayment = calculateMonthlyPayment(input.product, selected.noteRate, selected.purchasePrice, selectedLoanAmount, options);
  const deltaFromTarget = roundToThree(targetPrice - selected.purchasePrice);

  return {
    maxAvailable: calculateMaxAvailable(input),
    rate: selected.noteRate,
    monthlyPayment,
    maxLtv: calculateMaxLtv(input),
    rateType: input.product === 'HELOC' ? 'Variable' : 'Fixed',
    noteRate: selected.noteRate,
    purchasePrice: roundToThree(selected.purchasePrice),
    llpaAdjustment,
    basePrice: selected.basePrice,
    adjustments,
    targetPrice,
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
    withinToleranceAllowOverage: deltaFromTarget >= -tolerance && deltaFromTarget <= tolerance,
  };
}

function calculateMaxAvailable(input: ButtonPricingInput): number {
  const maxLtv = calculateMaxLtv(input);
  const maxLoan = input.propertyValue * maxLtv;
  return Math.max(0, maxLoan - input.loanBalance);
}

function calculateMaxLtv(input: ButtonPricingInput): number {
  const occupancyValue = normalizeOccupancy(input.occupancy);
  const unitCount = Math.max(1, input.unitCount || 1);
  const creditScore = input.creditScore;

  if (occupancyValue === 'Investor') {
    if (creditScore >= 740) return 0.75;
    if (creditScore >= 720) return 0.70;
    if (creditScore >= 700) return 0.65;
    if (creditScore >= 680) return 0.65;
    if (creditScore >= 660) return 0.60;
    return 0;
  }

  if (occupancyValue === 'Second Home') {
    if (unitCount > 1) return 0;
    if (creditScore >= 740) return 0.85;
    if (creditScore >= 680) return 0.80;
    if (creditScore >= 660) return 0.75;
    if (creditScore >= 620) return 0.65;
    return 0;
  }

  if (creditScore >= 700) return 0.85;
  if (creditScore >= 680) return 0.80;
  if (creditScore >= 660) return 0.75;
  if (creditScore >= 620) return 0.65;
  return 0;
}

function pickNoteRate(
  product: ButtonProduct,
  docKey: 'fullDoc' | 'altDoc',
  llpaAdjustment: number,
  targetPrice: number,
  matchByRate = false
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let best = { noteRate: NOTE_RATE_ROWS[0].noteRate, basePrice: basePriceFor(NOTE_RATE_ROWS[0], product, docKey), purchasePrice: 0 };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of NOTE_RATE_ROWS) {
    const basePrice = basePriceFor(row, product, docKey);
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = matchByRate ? Math.abs(row.noteRate - targetPrice) : Math.abs(purchasePrice - targetPrice);
    if (delta < bestDelta || (delta === bestDelta && purchasePrice > best.purchasePrice)) {
      best = { noteRate: row.noteRate, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickNoteRateClosestToRequested(
  product: ButtonProduct,
  docKey: 'fullDoc' | 'altDoc',
  llpaAdjustment: number,
  requestedRate: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  return pickNoteRate(product, docKey, llpaAdjustment, requestedRate, true);
}

function pickNoteRateAtOrBelowTarget(
  product: ButtonProduct,
  docKey: 'fullDoc' | 'altDoc',
  llpaAdjustment: number,
  targetPrice: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let bestUnder: { noteRate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { noteRate: NOTE_RATE_ROWS[0].noteRate, basePrice: basePriceFor(NOTE_RATE_ROWS[0], product, docKey), purchasePrice: 0 };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of NOTE_RATE_ROWS) {
    const basePrice = basePriceFor(row, product, docKey);
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);

    if (purchasePrice <= targetPrice) {
      if (!bestUnder || purchasePrice > bestUnder.purchasePrice) {
        bestUnder = { noteRate: row.noteRate, basePrice, purchasePrice };
      }
    }

    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < fallbackDelta || (delta === fallbackDelta && purchasePrice > fallback.purchasePrice)) {
      fallback = { noteRate: row.noteRate, basePrice, purchasePrice };
      fallbackDelta = delta;
    }
  }

  return bestUnder ?? fallback;
}

function basePriceFor(row: RateRow, product: ButtonProduct, docKey: 'fullDoc' | 'altDoc'): number {
  if (product === 'HELOC') {
    return row.prices[docKey].HELOC;
  }
  return row.prices[docKey].CES ?? 0;
}

function calculateMonthlyPayment(
  product: ButtonProduct,
  noteRate: number,
  _purchasePrice: number,
  selectedLoanAmount: number,
  options?: {
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): number {
  const monthlyRate = noteRate / 100 / 12;
  if (selectedLoanAmount <= 0) return 0;

  if (product === 'CES') {
    const termYears = options?.cesTermYears ?? 20;
    const n = termYears * 12;
    return roundToNearestDollar(selectedLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
  }

  return roundToNearestDollar(selectedLoanAmount * monthlyRate);
}

function buildAdjustmentLines(
  input: ButtonPricingInput,
  cltvIndex: number,
  options?: {
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): Stage1AdjustmentLine[] {
  const adjustments: Stage1AdjustmentLine[] = [];
  const occupancy = normalizeOccupancy(input.occupancy);
  const normalizedStructure = normalizeStructureType(input.structureType);

  adjustments.push({ label: `Doc Type: ${input.docType}`, value: 0 });
  adjustments.push({ label: 'Lock Period: 45 Day', value: BUTTON_45_DAY_LOCK_ADJUSTMENT });

  if (occupancy === 'Second Home') {
    adjustments.push({ label: 'Second Home', value: getLookupValue(OCCUPANCY_TABLE, 'Second Home', cltvIndex) });
  } else if (occupancy === 'Investor') {
    adjustments.push({ label: 'Investor', value: getLookupValue(OCCUPANCY_TABLE, 'Investor', cltvIndex) });
  }

  if (normalizedStructure === '2-4 Unit' || input.unitCount > 1) {
    adjustments.push({ label: '2-4 Unit', value: getLookupValue(UNIT_COUNT_TABLE, '2-4 Unit', cltvIndex) });
  }

  if (input.cashOut) {
    adjustments.push({ label: 'Cash Out', value: getMatrixValue(CASH_OUT_TABLE.values, 0, cltvIndex) });
  }

  const dtiAdjustment = getDtiAdjustment(input, cltvIndex, options);
  if (dtiAdjustment) {
    adjustments.push(dtiAdjustment);
  }

  const termAdjustment = getTermAdjustment(input, cltvIndex, options);
  if (termAdjustment) {
    adjustments.push(termAdjustment);
  }

  return adjustments.filter(row => row.value !== 0);
}

function getDtiAdjustment(
  input: ButtonPricingInput,
  cltvIndex: number,
  _options?: {
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): Stage1AdjustmentLine | null {
  const dtiLabel = getButtonDtiLabel(input.dti);
  if (!dtiLabel) return null;
  const value = getLookupValue(DTI_TABLE, dtiLabel, cltvIndex);
  return { label: `DTI: ${dtiLabel}`, value };
}

function getButtonDtiLabel(dti: number | null): string | null {
  if (dti === null || dti <= 43) return null;
  if (dti <= 50) return '43% < DTI ≤ 50%';
  if (dti <= 55) return '50% < DTI ≤ 55%';
  if (dti <= 60) return '55% < DTI ≤ 60%';
  return null;
}

function getTermAdjustment(
  input: ButtonPricingInput,
  cltvIndex: number,
  options?: {
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): Stage1AdjustmentLine | null {
  if (input.product === 'HELOC') {
    const drawYears = options?.helocDrawTermYears ?? 5;
    const label = `${drawYears}yr IO (non-HELOC)`;
    return {
      label: `${drawYears} Year Draw`,
      value: getLookupValue(DRAW_TABLE.nonHeloc, label, cltvIndex),
    };
  }

  const cesTerm = options?.cesTermYears ?? 30;
  const label = `${cesTerm} Year Term`;
  return {
    label,
    value: getLookupValue(MATURITY_TABLE, label, cltvIndex),
  };
}

function getFicoBucketIndex(score: number): number {
  for (let i = 0; i < FICO_BUCKETS.length; i += 1) {
    if (score <= FICO_BUCKETS[i].max) return i;
  }
  return FICO_BUCKETS.length - 1;
}

function getCltvBucketIndex(cltv: number): number {
  for (let i = 0; i < CLTV_BUCKETS.length; i += 1) {
    if (cltv <= CLTV_BUCKETS[i].max) return i;
  }
  return CLTV_BUCKETS.length - 1;
}

function getMatrixValue(matrix: Matrix, rowIndex: number, colIndex: number): number {
  const row = matrix[rowIndex] || [];
  const value = row[colIndex];
  if (value === null || value === undefined || value === 'n/a') return 0;
  return Number(value) || 0;
}

function normalizeProduct(product?: string): ButtonProduct {
  const value = String(product || '').toUpperCase();
  if (value.includes('HELOC')) return 'HELOC';
  return 'CES';
}

function normalizeOccupancy(occupancy?: string): string {
  const value = String(occupancy || '').toLowerCase();
  if (value.includes('rental') || value.includes('investment') || value.includes('investor')) return 'Investor';
  if (value.includes('second')) return 'Second Home';
  return 'Primary';
}

function normalizeStructureType(structureType?: string): string {
  const value = String(structureType || '').toLowerCase();
  if (value.includes('condo')) return 'Condo';
  if (value.includes('town')) return 'Townhome';
  if (value.includes('pud')) return 'PUD';
  if (value.includes('multi') || value.includes('2-4') || value.includes('2 to 4')) return '2-4 Unit';
  return 'SFR';
}

function getLookupValue(table: { rows: string[]; values: Matrix }, rowLabel: string, colIndex: number): number {
  const rowIndex = table.rows.findIndex(row => String(row).trim().toLowerCase() === rowLabel.trim().toLowerCase());
  if (rowIndex === -1) return 0;
  return getMatrixValue(table.values, rowIndex, colIndex);
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToNearestDollar(value: number): number {
  return Math.round(value);
}
