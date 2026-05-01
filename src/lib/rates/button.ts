import ratesheet from './button-ratesheet.json';
import {
  calculateAmortizingMonthlyPayment,
  calculateInterestOnlyMonthlyPayment,
  calculateMaxAvailableFromMaxLtv,
  type Stage1AdjustmentLine,
} from './shared';

export type ButtonProduct = 'HELOC' | 'CES';
export type ButtonDocType = 'Full Doc' | '12 Month Bank Statement' | '24 Month Bank Statement' | 'Asset Depletion';

const BUTTON_12_MONTH_BANK_STATEMENT = 12;
const BUTTON_24_MONTH_BANK_STATEMENT = 24;

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
type ButtonRatesheetGuideMaxPrice = {
  default: number;
  over500k?: { CES?: number | null; HELOC?: number | null };
};
type CltvTable = {
  fullDocRows: string[];
  altDocRows: string[];
  fullDocColumns: string[];
  altDocColumns: string[];
  fullDoc: Matrix;
  altDoc: Matrix;
};
type LookupTable = { rows: string[]; columns: Array<string | number | null>; values: Matrix };

const NOTE_RATE_ROWS = ratesheet.noteRates as unknown as RateRow[];
const CLTV_MATRIX = ratesheet.tables.cltv as CltvTable;
const CASH_OUT_TABLE = ratesheet.tables.cashOut as { rows: string[]; columns: Array<string | null>; values: Matrix };
const DTI_TABLE = ratesheet.tables.dti as LookupTable;
const OCCUPANCY_TABLE = ratesheet.tables.occupancy as LookupTable;
const UNIT_COUNT_TABLE = ratesheet.tables.unitCount as LookupTable;
const MATURITY_TABLE = ratesheet.tables.maturity as LookupTable;
const BALANCE_TABLE = ratesheet.tables.balance as LookupTable;
const BANK_STATEMENT_TABLE = ratesheet.tables.bankStatements as LookupTable;
const DRAW_TABLE = ratesheet.tables.draw as {
  heloc: LookupTable;
  nonHeloc: LookupTable;
};
const BUTTON_GUIDE_MAX_PRICE = (ratesheet as { guideMaxPrice?: ButtonRatesheetGuideMaxPrice }).guideMaxPrice;

const BUTTON_LOCK_EXTENSION_PER_15_DAYS = -0.125;
const BUTTON_LOCK_BASELINE_DAYS = 30;

const SECOND_LIEN_MARGIN_TARGETS = [
  { min: 0, max: 99999, backendFee: 0.06 },
  { min: 100000, max: 149999, backendFee: 0.06 },
  { min: 150000, max: 199999, backendFee: 0.05 },
  { min: 200000, max: 249999, backendFee: 0.045 },
  { min: 250000, max: 299999, backendFee: 0.04 },
  { min: 300000, max: 349999, backendFee: 0.035 },
  { min: 350000, max: 399999, backendFee: 0.0325 },
  { min: 400000, max: 449999, backendFee: 0.03 },
  { min: 450000, max: 499999, backendFee: 0.0275 },
  { min: 500000, max: 599999, backendFee: 0.025 },
  { min: 600000, max: 699999, backendFee: 0.02 },
  { min: 700000, max: 799999, backendFee: 0.02 },
  { min: 800000, max: 899999, backendFee: 0.02 },
  { min: 900000, max: 1000000, backendFee: 0.02 },
] as const;

export function buildButtonStage1PricingInput(stage1: ButtonStage1Input): ButtonPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  const docType = stage1.buttonDocType ?? 'Full Doc';

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
    docType,
    selfEmployed: docType === '12 Month Bank Statement' || docType === '24 Month Bank Statement' || docType === 'Asset Depletion',
    bankStatementMonths: docType === '12 Month Bank Statement'
      ? BUTTON_12_MONTH_BANK_STATEMENT
      : docType === '24 Month Bank Statement'
        ? BUTTON_24_MONTH_BANK_STATEMENT
        : null,
  };
}

export function getButtonStage1Assumptions(): ButtonPricingAssumptions {
  return {
    dti: 'Not collected in stage 1 yet. Defaulting outside LLPA logic for version 1.',
    docType: 'Uses the selected Button doc type. HELOC is full doc only, CES can use alt doc.',
    selfEmployed: 'Derived from doc type for Button alt-doc scenarios.',
    bankStatementMonths: '12 Month Bank Statement applies the extra bank statement hit. 24 Month Bank Statement uses the shared alt-doc grid without that extra hit. Asset Depletion also uses the shared alt-doc grid without the bank statement hit.',
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
    lockPeriodDays?: number;
  }
): ButtonQuote {
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? maxAvailable);
  const targetPrice = Math.min(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), getButtonGuideMaxPrice(input.product, selectedLoanAmount));
  const docKey = input.docType === 'Full Doc' ? 'fullDoc' : 'altDoc';

  const ficoIndex = getFicoBucketIndex(docKey, input.creditScore);
  const cltvIndex = getCltvBucketIndex(docKey, input.resultingCltv);
  const cltvAdj = getMatrixValue(CLTV_MATRIX[docKey], ficoIndex, cltvIndex);

  const adjustments = buildAdjustmentLines(input, cltvIndex, options, cltvAdj);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
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
    lockPeriodDays?: number;
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

  if (input.product === 'HELOC' && input.docType !== 'Full Doc') {
    reasons.push(`Button ${input.docType} pricing is not available for HELOC.`);
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

export function getButtonGuideMaxPrice(product: ButtonProduct, desiredLoanAmount: number): number {
  if (BUTTON_GUIDE_MAX_PRICE?.over500k && desiredLoanAmount > 500000) {
    const over500k = BUTTON_GUIDE_MAX_PRICE.over500k[product];
    if (typeof over500k === 'number') return over500k;
  }
  if (typeof BUTTON_GUIDE_MAX_PRICE?.default === 'number') return BUTTON_GUIDE_MAX_PRICE.default;
  throw new Error('Button guide max price is missing from button-ratesheet.json');
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
    lockPeriodDays?: number;
  }
): ButtonTargetRateQuote {
  const input = buildButtonStage1PricingInput(stage1);
  const docKey = input.docType === 'Full Doc' ? 'fullDoc' : 'altDoc';
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = Math.min(options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), getButtonGuideMaxPrice(input.product, selectedLoanAmount));
  const tolerance = options.tolerance ?? 0.125;

  const ficoIndex = getFicoBucketIndex(docKey, input.creditScore);
  const cltvIndex = getCltvBucketIndex(docKey, input.resultingCltv);
  const cltvAdj = getMatrixValue(CLTV_MATRIX[docKey], ficoIndex, cltvIndex);
  const adjustments = buildAdjustmentLines(input, cltvIndex, options, cltvAdj);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));

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
  return calculateMaxAvailableFromMaxLtv(input.propertyValue, input.loanBalance, calculateMaxLtv(input));
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
  if (docKey === 'altDoc') {
    const altDocPrice = row.prices.altDoc.CES ?? row.prices.altDoc.HELOC;
    return altDocPrice ?? 0;
  }

  if (product === 'HELOC') {
    return row.prices.fullDoc.HELOC;
  }
  return row.prices.fullDoc.CES ?? 0;
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
  if (product === 'CES') {
    const termYears = options?.cesTermYears ?? 20;
    return roundToNearestDollar(calculateAmortizingMonthlyPayment(selectedLoanAmount, noteRate, termYears));
  }

  return roundToNearestDollar(calculateInterestOnlyMonthlyPayment(selectedLoanAmount, noteRate));
}

function buildAdjustmentLines(
  input: ButtonPricingInput,
  cltvIndex: number,
  options?: {
    selectedLoanAmount?: number;
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
    lockPeriodDays?: number;
  },
  cltvAdj?: number
): Stage1AdjustmentLine[] {
  const adjustments: Stage1AdjustmentLine[] = [];
  const occupancy = normalizeOccupancy(input.occupancy);
  const normalizedStructure = normalizeStructureType(input.structureType);
  const lockPeriodDays = Math.max(0, Math.round(options?.lockPeriodDays ?? 60));
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? 0);

  const docKey = input.docType === 'Full Doc' ? 'fullDoc' : 'altDoc';
  adjustments.push({ label: `Doc Type: ${input.docType}`, value: 0 });
  if (cltvAdj !== undefined) {
    const ficoLabel = getFicoBucketLabels(docKey)[ficoIndexForLabel(docKey, input.creditScore)] ?? 'Unknown FICO';
    const cltvLabel = getCltvBucketLabels(docKey)[cltvIndex] ?? 'Unknown CLTV';
    adjustments.push({
      label: `${input.docType} CLTV: ${ficoLabel} / ${cltvLabel}`,
      value: cltvAdj,
    });
  }
  const altDocAdjustment = getAltDocAdjustment(input, cltvIndex);
  if (altDocAdjustment) {
    adjustments.push(altDocAdjustment);
  }
  const lockExtensionCount = (lockPeriodDays - BUTTON_LOCK_BASELINE_DAYS) / 15;
  if (Number.isFinite(lockExtensionCount) && Math.abs(lockExtensionCount - Math.round(lockExtensionCount)) < 1e-9) {
    adjustments.push({ label: `Lock Period: ${lockPeriodDays} Day`, value: roundToThree(lockExtensionCount * BUTTON_LOCK_EXTENSION_PER_15_DAYS) });
  }

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

  const dtiAdjustment = getDtiAdjustment(input, cltvIndex);
  if (dtiAdjustment) {
    adjustments.push(dtiAdjustment);
  }

  const termAdjustment = getTermAdjustment(input, cltvIndex, options);
  if (termAdjustment) {
    adjustments.push(termAdjustment);
  }

  const loanAmountAdjustment = getLoanAmountAdjustment(input.product, selectedLoanAmount, cltvIndex);
  if (loanAmountAdjustment) {
    adjustments.push(loanAmountAdjustment);
  }

  return adjustments.filter(row => row.value !== 0);
}

function getLoanAmountAdjustment(
  product: ButtonProduct,
  selectedLoanAmount: number,
  cltvIndex: number
): Stage1AdjustmentLine | null {
  const bucketLabel = getButtonLoanAmountBucketLabel(product, selectedLoanAmount);
  if (!bucketLabel) return null;

  const value = getLookupValue(BALANCE_TABLE, bucketLabel, cltvIndex);
  if (value === 0) return null;

  return {
    label: `Loan Amount: ${stripProductPrefix(bucketLabel)}`,
    value: roundToThree(value),
  };
}

function getButtonLoanAmountBucketLabel(product: ButtonProduct, selectedLoanAmount: number): string | null {
  const prefix = product === 'CES' ? 'HELOAN' : 'HELOC';
  const match = BALANCE_TABLE.rows.find(row => {
    const label = String(row).trim();
    if (!label.startsWith(prefix)) return false;
    const range = parseBalanceRange(label);
    return range ? selectedLoanAmount > range.minExclusive && selectedLoanAmount <= range.maxInclusive : false;
  });
  return match ? String(match).trim() : null;
}

function getAltDocAdjustment(
  input: ButtonPricingInput,
  cltvIndex: number
): Stage1AdjustmentLine | null {
  if (input.docType !== '12 Month Bank Statement') return null;
  const rowLabel = BANK_STATEMENT_TABLE.rows.find(row => String(row).toLowerCase().includes('12 month'));
  if (!rowLabel) return null;
  const value = getLookupValue(BANK_STATEMENT_TABLE, rowLabel, cltvIndex);
  if (value === 0) return null;
  return {
    label: String(rowLabel).trim(),
    value: roundToThree(value),
  };
}

function getDtiAdjustment(
  input: ButtonPricingInput,
  cltvIndex: number
): Stage1AdjustmentLine | null {
  const dtiLabel = getButtonDtiLabel(input.dti);
  if (!dtiLabel) return null;
  const value = getLookupValue(DTI_TABLE, dtiLabel, cltvIndex);
  return { label: `DTI: ${dtiLabel}`, value };
}

function getButtonDtiLabel(dti: number | null): string | null {
  if (dti === null) return null;
  const match = DTI_TABLE.rows.find(row => matchesDtiLabel(String(row), dti));
  return match ? String(match).trim() : null;
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

    if (drawYears === 10) {
      return {
        label: '10 Year Draw',
        value: getLookupValue(DRAW_TABLE.heloc, '10yr HELOC Draw', cltvIndex),
      };
    }

    if (drawYears === 3 || drawYears === 5) {
      const label = `${drawYears}yr IO (non-HELOC)`;
      return {
        label: `${drawYears} Year Draw`,
        value: getLookupValue(DRAW_TABLE.nonHeloc, label, cltvIndex),
      };
    }

    return null;
  }

  const cesTerm = options?.cesTermYears ?? 30;
  const label = `${cesTerm} Year Term`;
  return {
    label,
    value: getLookupValue(MATURITY_TABLE, label, cltvIndex),
  };
}

function getFicoBucketIndex(docKey: 'fullDoc' | 'altDoc', score: number): number {
  return ficoIndexForLabel(docKey, score);
}

function ficoIndexForLabel(docKey: 'fullDoc' | 'altDoc', score: number): number {
  const labels = getFicoBucketLabels(docKey);
  for (let i = 0; i < labels.length; i += 1) {
    if (matchesFicoLabel(labels[i], score)) return i;
  }
  return Math.max(0, labels.length - 1);
}

function getCltvBucketIndex(docKey: 'fullDoc' | 'altDoc', cltv: number): number {
  const labels = getCltvBucketLabels(docKey);
  const cltvPct = cltv * 100;
  for (let i = 0; i < labels.length; i += 1) {
    if (matchesCltvLabel(labels[i], cltvPct)) return i;
  }
  return Math.max(0, labels.length - 1);
}

function getFicoBucketLabels(docKey: 'fullDoc' | 'altDoc'): string[] {
  return docKey === 'fullDoc' ? CLTV_MATRIX.fullDocRows : CLTV_MATRIX.altDocRows;
}

function getCltvBucketLabels(docKey: 'fullDoc' | 'altDoc'): string[] {
  return docKey === 'fullDoc' ? CLTV_MATRIX.fullDocColumns : CLTV_MATRIX.altDocColumns;
}

function matchesFicoLabel(label: string, score: number): boolean {
  const normalized = String(label).replace(/\s+/g, ' ').trim();
  const atLeast = normalized.match(/>=\s*(\d+)/i);
  if (atLeast) return score >= Number(atLeast[1]);
  const range = normalized.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return score >= Number(range[1]) && score <= Number(range[2]);
  return false;
}

function matchesCltvLabel(label: string, cltvPct: number): boolean {
  const normalized = String(label).replace(/\s+/g, ' ').trim();
  const maxOnly = normalized.match(/^<=\s*(\d+(?:\.\d+)?)%$/);
  if (maxOnly) return cltvPct <= Number(maxOnly[1]);
  const range = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%$/);
  if (range) return cltvPct >= Number(range[1]) && cltvPct <= Number(range[2]);
  return false;
}

function matchesDtiLabel(label: string, dti: number): boolean {
  const normalized = String(label).replace(/\s+/g, ' ').trim();
  const maxOnly = normalized.match(/^<=\s*(\d+(?:\.\d+)?)%$/);
  if (maxOnly) return dti <= Number(maxOnly[1]);
  const range = normalized.match(/(\d+(?:\.\d+)?)%?\s*<\s*DTI\s*[≤<=]+\s*(\d+(?:\.\d+)?)%/i);
  if (range) return dti > Number(range[1]) && dti <= Number(range[2]);
  return false;
}

function parseBalanceRange(label: string): { minExclusive: number; maxInclusive: number } | null {
  const normalized = String(label).replace(/,/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)(k|mm)?\s*<\s*balance\s*<=\s*(\d+(?:\.\d+)?)(k|mm)/i);
  if (!match) return null;
  return {
    minExclusive: normalizeMagnitude(Number(match[1]), match[2] ?? ''),
    maxInclusive: normalizeMagnitude(Number(match[3]), match[4] ?? ''),
  };
}

function normalizeMagnitude(value: number, suffix: string): number {
  const normalized = suffix.toLowerCase();
  if (normalized === 'mm') return value * 1_000_000;
  if (normalized === 'k') return value * 1_000;
  return value;
}

function stripProductPrefix(label: string): string {
  return String(label).replace(/^HELOAN\s+/i, '').replace(/^HELOC\s+/i, '').trim();
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

function getLookupValue(table: LookupTable, rowLabel: string, colIndex: number): number {
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
