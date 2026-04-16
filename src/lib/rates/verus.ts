import ratesheet from './verus-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import type { Stage1AdjustmentLine } from './shared';

export type VerusProgram = 'CES' | 'HELOC';
export type VerusCesProduct = '10 YR FIX' | '15 YR FIX' | '20 YR FIX' | '25 YR FIX' | '30 YR FIX';
export type VerusHelocProduct = '15 YR' | '20 YR' | '25 YR' | '30 YR';
export type VerusProduct = VerusCesProduct | VerusHelocProduct;
export type VerusDocType = 'Standard' | 'Alt Doc';
export type VerusDrawPeriodYears = 2 | 3 | 5;
export type VerusLockPeriodDays = 30 | 45 | 60;

export interface VerusPricingInput {
  program: VerusProgram;
  product: VerusProduct;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  occupancy: string;
  propertyState: string;
  structureType: string;
  unitCount: number;
}

export interface VerusQuote {
  program: VerusProgram;
  product: VerusProduct;
  maxAvailable: number;
  maxLtv: number;
  rate: number;
  noteRate: number;
  rateType: string;
  monthlyPayment: number;
  basePrice: number;
  llpaAdjustment: number;
  purchasePrice: number;
  adjustments: Stage1AdjustmentLine[];
}

export interface VerusTargetRateQuote extends VerusQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
  withinToleranceAllowOverage: boolean;
}

export interface VerusEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type CesRow = { rate: number; prices: Record<VerusCesProduct, number | null> };
type HelocRow = { margin: number; prices: Record<VerusHelocProduct, number | null> };
type MatrixCell = number | string | null;
type Matrix = MatrixCell[][];

type VerusData = {
  programs: {
    CES: { minPrice: number; maxPrice: number; pricing: { standard: CesRow[]; alt: CesRow[] } };
    HELOC: { primeRate: number; pricing: HelocRow[] };
  };
};

type VerusSecondPriceMatrixTable = {
  rows: string[];
  columns: string[];
  values: Matrix;
};

const DATA = ratesheet as VerusData;
const VERUS_CES_LOAN_AMOUNT_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['< $75,000', '$75,000 - $100,000', '$100,001 - $150,000', '$150,001 - $200,000', '$200,001 - $350,000', '$350,001 - $500,000', '$500,001 - $750,000'],
  columns: ['CES | <=50', 'CES | 50.01 - 55', 'CES | 55.01 - 60', 'CES | 60.01 - 65', 'CES | 65.01 - 70', 'CES | 70.01 - 75', 'CES | 75.01 - 80', 'CES | 80.01 - 85', 'CES | 85.01 - 90', 'CES | 90.01 - 95'],
  values: [
    [-0.25, -0.25, -0.25, -0.25, -0.25, -0.25, -0.25, -0.375, -0.375, 'NA'],
    [-0.25, -0.25, -0.25, -0.25, -0.25, -0.25, -0.25, -0.375, -0.375, 'NA'],
    [-0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.25, -0.25, 'NA'],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 'NA'],
    [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0, 0, 'NA'],
    [0.375, 0.375, 0.375, 0.375, 0.375, 0.375, 0.375, 0, 'NA', 'NA'],
    [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 'NA', 'NA', 'NA'],
  ],
};
const VERUS_CES_DTI_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['<= 40%', '40.01 - 45%', '45.01 - 50%'],
  columns: ['CES | <=50', 'CES | 50.01 - 55', 'CES | 55.01 - 60', 'CES | 60.01 - 65', 'CES | 65.01 - 70', 'CES | 70.01 - 75', 'CES | 75.01 - 80', 'CES | 80.01 - 85', 'CES | 85.01 - 90', 'CES | 90.01 - 95'],
  values: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 'NA'],
    [-0.375, -0.375, -0.375, -0.375, -0.375, -0.375, -0.5, -0.75, -1, 'NA'],
    [-0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.75, 'NA', 'NA', 'NA'],
  ],
};
const VERUS_CES_STANDARD_DOC_2YR_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['800+', '780-799', '760-779', '740-759', '720-739', '700-719', '680-699'],
  columns: ['CES | <=50', 'CES | 50.01 - 55', 'CES | 55.01 - 60', 'CES | 60.01 - 65', 'CES | 65.01 - 70', 'CES | 70.01 - 75', 'CES | 75.01 - 80', 'CES | 80.01 - 85'],
  values: [
    [3, 2.875, 2.875, 2.75, 2.5, 2, 0.875, -2],
    [3, 2.875, 2.875, 2.625, 2.25, 1.375, 0.5, -2.875],
    [2, 1.875, 1.875, 1.375, 1, 0.75, -0.5, -4],
    [1.25, 1.25, 1.25, 1, 0.625, 0.25, -1.75, -5.5],
    [0.875, 0.875, 0.875, 0.5, 0.125, -0.5, -2.75, -7],
    [0.375, 0.375, 0.375, -0.125, -1, -2, -5, -8],
    [-0.25, -0.5, -0.75, -1, -3, -4, 'NA', 'NA'],
  ],
};
const VERUS_CES_ALT_DOC_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['800+', '780-799', '760-779', '740-759', '720-739', '700-719', '680-699'],
  columns: ['CES | <=50', 'CES | 50.01 - 55', 'CES | 55.01 - 60', 'CES | 60.01 - 65', 'CES | 65.01 - 70', 'CES | 70.01 - 75', 'CES | 75.01 - 80', 'CES | 80.01 - 85'],
  values: [
    [3, 2.875, 2.875, 2.75, 2.5, 2, 0.875, -2.25],
    [3, 2.875, 2.875, 2.625, 2.25, 1.375, 0.5, -3.125],
    [2, 1.875, 1.875, 1.375, 1, 0.75, -0.5, -4.25],
    [1.25, 1.25, 1.25, 1, 0.625, 0.25, -1.75, -6],
    [0.875, 0.875, 0.875, 0.5, 0.125, -0.5, -2.75, 'NA'],
    [0.125, 0.125, 0.125, -0.375, -1.25, -2.25, -5.5, 'NA'],
    [-0.5, -0.75, -1, -1.25, -3.25, -4.5, 'NA', 'NA'],
  ],
};
const VERUS_CES_OCCUPANCY_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['2nd Home', 'Investor'],
  columns: ['CES | <=50', 'CES | 50.01 - 55', 'CES | 55.01 - 60', 'CES | 60.01 - 65', 'CES | 65.01 - 70', 'CES | 70.01 - 75', 'CES | 75.01 - 80', 'CES | 80.01 - 85', 'CES | 85.01 - 90', 'CES | 90.01 - 95'],
  values: [
    [-1, -1, -1, -1, -1, -1, -1, 'NA', 'NA', 'NA'],
    [-1.875, -1.875, -2.375, -2.875, -3.375, -4, 'NA', 'NA', 'NA', 'NA'],
  ],
};
const VERUS_CES_PROPERTY_TYPE_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['Condo', '2-4 Unit'],
  columns: ['CES | <=50', 'CES | 50.01 - 55', 'CES | 55.01 - 60', 'CES | 60.01 - 65', 'CES | 65.01 - 70', 'CES | 70.01 - 75', 'CES | 75.01 - 80', 'CES | 80.01 - 85', 'CES | 85.01 - 90', 'CES | 90.01 - 95'],
  values: [
    [-0.25, -0.25, -0.25, -0.25, -0.375, -0.375, -0.5, 'NA', 'NA', 'NA'],
    [-0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 'NA', 'NA', 'NA', 'NA'],
  ],
};
const VERUS_CES_STATE_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['CT, IL, NJ, NY'],
  columns: ['CES | <=50', 'CES | 50.01 - 55', 'CES | 55.01 - 60', 'CES | 60.01 - 65', 'CES | 65.01 - 70', 'CES | 70.01 - 75', 'CES | 75.01 - 80', 'CES | 80.01 - 85', 'CES | 85.01 - 90', 'CES | 90.01 - 95'],
  values: [[-1, -1, -1.25, -1.25, -1.5, -1.5, -2, 'NA', 'NA', 'NA']],
};
const VERUS_CES_LOCK_ADJUSTMENTS: Record<VerusLockPeriodDays, number> = { 30: 0, 45: -0.15, 60: -0.3 };
const VERUS_HELOC_STANDARD_DOC_2YR_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['780+', '760-779', '740-759', '720-739', '700-719', '680-699'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85'],
  values: [
    [2.5, 2.5, 2, 2, 1.5, 0.5, 0, -3.5],
    [1.5, 1.5, 1.5, 1.5, 1, 0, -1, -5],
    [1, 1, 1, 1, 0, 0, -2, -6],
    [0, 0, 0, 0, 0, -1, -3, -7.5],
    [-0.5, -0.5, -0.5, -1, -1.5, -2, -5.5, -8.5],
    [-0.75, -0.75, -1, -1.5, -2, -3, 'NA', 'NA'],
  ],
};
const VERUS_HELOC_ALT_DOC_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['780+', '760-779', '740-759', '720-739', '700-719', '680-699'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85'],
  values: [
    [2, 2, 1.5, 1.5, 1, 0, -0.5, 'NA'],
    [1, 1, 1, 1, 0.5, -0.5, -1.5, 'NA'],
    [0.5, 0.5, 0.5, 0.5, -0.5, -0.5, -2.5, 'NA'],
    [-0.5, -0.5, -0.5, -0.5, -0.5, -1.5, 'NA', 'NA'],
    [-1, -1, -1, -1.5, -2, -2.5, 'NA', 'NA'],
    ['NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA'],
  ],
};
const VERUS_HELOC_DRAW_TERM_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['24', '36', '60'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85', 'HELOC | 85.01 - 90'],
  values: [
    [2, 2, 2, 2, 2, 2, 2, 0, 0],
    [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
};
const VERUS_HELOC_DTI_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['<= 40%', '40.01 - 45%', '45.01 - 50%'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85', 'HELOC | 85.01 - 90'],
  values: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, -0.125, -0.125, -0.125, -0.125, -0.125, -0.125],
    [0, 0, 0, -0.125, -0.125, -0.25, -0.25, 'NA', 'NA'],
  ],
};
const VERUS_HELOC_LOAN_AMOUNT_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['$50,000 - $100,000', '$100,001 - $250,000', '$250,001 - $350,000', '$350,001 - $500,000'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85', 'HELOC | 85.01 - 90'],
  values: [
    [-0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.125, -0.125],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 'NA'],
    [0, 0, 0, 0, 0, 0, 'NA', 'NA', 'NA'],
  ],
};
const VERUS_HELOC_OCCUPANCY_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['2nd Home', 'Investor'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85', 'HELOC | 85.01 - 90'],
  values: [
    [-1, -1, -1, -1, -1, -1, 'NA', 'NA', 'NA'],
    [-2, -2, -2.5, -3, -3.5, 'NA', 'NA', 'NA', 'NA'],
  ],
};
const VERUS_HELOC_PROPERTY_TYPE_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['Condo', '2-4 Unit'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85', 'HELOC | 85.01 - 90'],
  values: [
    [0, 0, 0, -0.125, -0.125, -0.25, -0.25, 'NA', 'NA'],
    [-0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 'NA', 'NA'],
  ],
};
const VERUS_HELOC_STATE_TABLE: VerusSecondPriceMatrixTable = {
  rows: ['CT, IL, NJ, NY'],
  columns: ['HELOC | <=50', 'HELOC | 50.01 - 55', 'HELOC | 55.01 - 60', 'HELOC | 60.01 - 65', 'HELOC | 65.01 - 70', 'HELOC | 70.01 - 75', 'HELOC | 75.01 - 80', 'HELOC | 80.01 - 85', 'HELOC | 85.01 - 90'],
  values: [[0, 0, 0, -0.125, -0.125, -0.125, -0.125, 'NA', 'NA']],
};
const VERUS_HELOC_LOCK_ADJUSTMENTS: Record<VerusLockPeriodDays, number> = { 30: 0, 45: -0.125, 60: -0.3125 };
const VERUS_STATE_BUCKET = new Set(['CT', 'IL', 'NJ', 'NY']);

export function buildVerusStage1PricingInput(
  stage1: ButtonStage1Input & {
    verusProgram?: VerusProgram;
    verusProduct?: VerusProduct;
  }
): VerusPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;
  const program = normalizeProgram(stage1.verusProgram, stage1.verusProduct);

  return {
    program,
    product: normalizeProduct(program, stage1.verusProduct),
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    occupancy: normalizeOccupancy(stage1.occupancy),
    propertyState: String(stage1.propertyState || '').toUpperCase(),
    structureType: String(stage1.structureType || ''),
    unitCount: Number(stage1.numberOfUnits || 1),
  };
}

export function calculateVerusStage1Quote(
  stage1: ButtonStage1Input & {
    verusProgram?: VerusProgram;
    verusProduct?: VerusProduct;
    verusDocType?: VerusDocType;
    verusDrawPeriodYears?: VerusDrawPeriodYears;
    verusLockPeriodDays?: VerusLockPeriodDays;
  },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): VerusQuote {
  const input = buildVerusStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);
  const adjustments = buildAdjustmentLines(stage1, input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));

  if (input.program === 'HELOC') {
    const selected = options?.rateOverride !== undefined
      ? pickHelocExecutionByRate(input.product as VerusHelocProduct, options.rateOverride, llpaAdjustment)
      : pickHelocExecution(input.product as VerusHelocProduct, targetPrice, llpaAdjustment);
    const noteRate = roundToThree(DATA.programs.HELOC.primeRate + selected.margin);
    return {
      program: 'HELOC',
      product: input.product,
      maxAvailable: calculateMaxAvailable(input),
      maxLtv: calculateMaxLtv(input),
      rate: noteRate,
      noteRate,
      rateType: 'Variable',
      monthlyPayment: roundToNearestDollar(selectedLoanAmount * (noteRate / 100 / 12)),
      basePrice: selected.basePrice,
      llpaAdjustment,
      purchasePrice: selected.purchasePrice,
      adjustments,
    };
  }

  const selected = options?.rateOverride !== undefined
    ? pickCesExecutionByRate(
        input.product as VerusCesProduct,
        stage1.verusDocType ?? 'Standard',
        options.rateOverride,
        llpaAdjustment
      )
    : pickCesExecution(
        input.product as VerusCesProduct,
        stage1.verusDocType ?? 'Standard',
        clamp(targetPrice, DATA.programs.CES.minPrice, DATA.programs.CES.maxPrice),
        llpaAdjustment
      );
  return {
    program: 'CES',
    product: input.product,
    maxAvailable: calculateMaxAvailable(input),
    maxLtv: calculateMaxLtv(input),
    rate: selected.rate,
    noteRate: selected.rate,
    rateType: 'Fixed',
    monthlyPayment: amortizedPayment(selectedLoanAmount, selected.rate, termYearsForVerusCes(input.product as VerusCesProduct)),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    adjustments,
  };
}

export function evaluateVerusStage1Eligibility(
  stage1: ButtonStage1Input & {
    verusProgram?: VerusProgram;
    verusProduct?: VerusProduct;
    verusDocType?: VerusDocType;
    verusDrawPeriodYears?: VerusDrawPeriodYears;
    verusLockPeriodDays?: VerusLockPeriodDays;
  },
  selectedLoanAmount?: number
): VerusEligibilityResult {
  const input = buildVerusStage1PricingInput(stage1);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const reasons: string[] = [];

  if (input.creditScore < 660) reasons.push('Credit score is below the current supported Verus tester range.');
  if (input.resultingCltv > calculateMaxLtv(input)) reasons.push('Resulting CLTV exceeds the current supported Verus tester range.');
  if (requested > calculateMaxAvailable(input)) reasons.push('Desired loan amount exceeds the current max available amount.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable: calculateMaxAvailable(input),
    resultingCltv: input.resultingCltv,
  };
}

export function solveVerusStage1TargetRate(
  stage1: ButtonStage1Input & {
    verusProgram?: VerusProgram;
    verusProduct?: VerusProduct;
    verusDocType?: VerusDocType;
    verusDrawPeriodYears?: VerusDrawPeriodYears;
    verusLockPeriodDays?: VerusLockPeriodDays;
  },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): VerusTargetRateQuote {
  const quote = calculateVerusStage1Quote(stage1, { selectedLoanAmount: options.selectedLoanAmount, targetPrice: options.targetPrice });
  const targetPrice = quote.program === 'CES'
    ? clamp(options.targetPrice, DATA.programs.CES.minPrice, DATA.programs.CES.maxPrice)
    : options.targetPrice;
  const tolerance = options.tolerance ?? 0.125;
  const deltaFromTarget = roundToThree(targetPrice - quote.purchasePrice);

  return {
    ...quote,
    targetPrice: roundToThree(targetPrice),
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
    withinToleranceAllowOverage: deltaFromTarget >= -tolerance && deltaFromTarget <= tolerance,
  };
}

function calculateMaxAvailable(input: VerusPricingInput): number {
  return Math.max(0, input.propertyValue * calculateMaxLtv(input) - input.loanBalance);
}

function calculateMaxLtv(input: VerusPricingInput): number {
  if (input.occupancy === 'Investment') return input.creditScore >= 700 ? 0.8 : 0.75;
  if (input.occupancy === 'Second Home') return input.creditScore >= 700 ? 0.85 : 0.8;
  return input.creditScore >= 700 ? 0.9 : 0.85;
}

function pickCesExecutionByRate(product: VerusCesProduct, docType: VerusDocType, requestedRate: number, llpaAdjustment = 0) {
  const rows = docType === 'Alt Doc' ? DATA.programs.CES.pricing.alt : DATA.programs.CES.pricing.standard;
  let best = { rate: rows[0].rate, basePrice: Number(rows[0].prices[product] ?? 0), purchasePrice: Number(rows[0].prices[product] ?? 0) };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[product] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = Math.abs(row.rate - requestedRate);
    if (delta < bestDelta || (delta === bestDelta && row.rate > best.rate)) {
      best = { rate: row.rate, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickCesExecution(product: VerusCesProduct, docType: VerusDocType, targetPrice: number, llpaAdjustment = 0) {
  const rows = docType === 'Alt Doc' ? DATA.programs.CES.pricing.alt : DATA.programs.CES.pricing.standard;
  let bestUnder: { rate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { rate: rows[0].rate, basePrice: Number(rows[0].prices[product] ?? 0), purchasePrice: Number(rows[0].prices[product] ?? 0) };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[product] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
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

function pickHelocExecutionByRate(product: VerusHelocProduct, requestedRate: number, llpaAdjustment = 0) {
  const rows = DATA.programs.HELOC.pricing;
  let best = { margin: rows[0].margin, basePrice: Number(rows[0].prices[product] ?? 0), purchasePrice: Number(rows[0].prices[product] ?? 0) };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[product] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const noteRate = roundToThree(DATA.programs.HELOC.primeRate + row.margin);
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = Math.abs(noteRate - requestedRate);
    if (delta < bestDelta || (delta === bestDelta && noteRate > roundToThree(DATA.programs.HELOC.primeRate + best.margin))) {
      best = { margin: row.margin, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickHelocExecution(product: VerusHelocProduct, targetPrice: number, llpaAdjustment = 0) {
  const rows = DATA.programs.HELOC.pricing;
  let bestUnder: { margin: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { margin: rows[0].margin, basePrice: Number(rows[0].prices[product] ?? 0), purchasePrice: Number(rows[0].prices[product] ?? 0) };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[product] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    if (purchasePrice <= targetPrice && (!bestUnder || purchasePrice > bestUnder.purchasePrice)) {
      bestUnder = { margin: row.margin, basePrice, purchasePrice };
    }
    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < fallbackDelta || (delta === fallbackDelta && purchasePrice > fallback.purchasePrice)) {
      fallback = { margin: row.margin, basePrice, purchasePrice };
      fallbackDelta = delta;
    }
  }

  return bestUnder ?? fallback;
}

function buildAdjustmentLines(
  stage1: ButtonStage1Input & { verusDocType?: VerusDocType; verusDrawPeriodYears?: VerusDrawPeriodYears; verusLockPeriodDays?: VerusLockPeriodDays },
  input: VerusPricingInput,
  selectedLoanAmount: number
): Stage1AdjustmentLine[] {
  const rows: Stage1AdjustmentLine[] = [];
  const docType = stage1.verusDocType ?? 'Standard';
  const lockPeriodDays = stage1.verusLockPeriodDays ?? 45;

  if (input.program === 'CES') {
    rows.push({ label: `Doc Type: ${docType}`, value: 0 });

    const cltvColumnIndex = getVerusCesCltvColumnIndex(input.resultingCltv);
    const docCltvColumnIndex = getVerusCesDocCltvColumnIndex(input.resultingCltv);
    const ficoLabel = getVerusCesFicoLabel(input.creditScore);
    const docTable = docType === 'Alt Doc' ? VERUS_CES_ALT_DOC_TABLE : VERUS_CES_STANDARD_DOC_2YR_TABLE;
    const docValue = getVerusMatrixValue(docTable, ficoLabel, docCltvColumnIndex);
    if (docValue !== null) rows.push({ label: docType === 'Alt Doc' ? `Alt Doc: ${ficoLabel}` : `Standard Doc - 2 Years: ${ficoLabel}`, value: docValue });

    const loanAmountLabel = getVerusCesLoanAmountLabel(selectedLoanAmount);
    const loanAmountValue = getVerusMatrixValue(VERUS_CES_LOAN_AMOUNT_TABLE, loanAmountLabel, cltvColumnIndex);
    if (loanAmountValue !== null) rows.push({ label: `Loan Amount: ${loanAmountLabel}`, value: loanAmountValue });

    const dtiLabel = '<= 40%';
    const dtiValue = getVerusMatrixValue(VERUS_CES_DTI_TABLE, dtiLabel, cltvColumnIndex);
    if (dtiValue !== null) rows.push({ label: `DTI: ${dtiLabel} (default)`, value: dtiValue });

    const occupancyLabel = getVerusOccupancyLabel(input.occupancy);
    if (occupancyLabel) {
      const occupancyValue = getVerusMatrixValue(VERUS_CES_OCCUPANCY_TABLE, occupancyLabel, cltvColumnIndex);
      if (occupancyValue !== null) rows.push({ label: `Occupancy: ${occupancyLabel}`, value: occupancyValue });
    }

    const propertyTypeLabel = getVerusPropertyTypeLabel(input);
    if (propertyTypeLabel) {
      const propertyValue = getVerusMatrixValue(VERUS_CES_PROPERTY_TYPE_TABLE, propertyTypeLabel, cltvColumnIndex);
      if (propertyValue !== null) rows.push({ label: `Property Type: ${propertyTypeLabel}`, value: propertyValue });
    }

    if (VERUS_STATE_BUCKET.has(input.propertyState)) {
      const stateValue = getVerusMatrixValue(VERUS_CES_STATE_TABLE, 'CT, IL, NJ, NY', cltvColumnIndex);
      if (stateValue !== null) rows.push({ label: `State: ${input.propertyState}`, value: stateValue });
    }

    rows.push({ label: `Lock Period: ${lockPeriodDays} days`, value: VERUS_CES_LOCK_ADJUSTMENTS[lockPeriodDays] ?? 0 });
    return rows;
  }

  const drawYears = stage1.verusDrawPeriodYears ?? 5;
  rows.push({ label: `Prime Rate`, value: 0 });
  rows.push({ label: `Doc Type: ${docType}`, value: 0 });

  const cltvColumnIndex = getVerusHelocCltvColumnIndex(input.resultingCltv);
  const docCltvColumnIndex = getVerusHelocDocCltvColumnIndex(input.resultingCltv);
  const ficoLabel = getVerusHelocFicoLabel(input.creditScore);
  const docTable = docType === 'Alt Doc' ? VERUS_HELOC_ALT_DOC_TABLE : VERUS_HELOC_STANDARD_DOC_2YR_TABLE;
  const docValue = getVerusMatrixValue(docTable, ficoLabel, docCltvColumnIndex);
  if (docValue !== null) rows.push({ label: docType === 'Alt Doc' ? `Alt Doc: ${ficoLabel}` : `Standard Doc - 2 Years: ${ficoLabel}`, value: docValue });

  const drawTermValue = getVerusMatrixValue(VERUS_HELOC_DRAW_TERM_TABLE, String(drawYears * 12), cltvColumnIndex);
  if (drawTermValue !== null) rows.push({ label: `Draw Period: ${drawYears} Years`, value: drawTermValue });

  const dtiLabel = '<= 40%';
  const dtiValue = getVerusMatrixValue(VERUS_HELOC_DTI_TABLE, dtiLabel, cltvColumnIndex);
  if (dtiValue !== null) rows.push({ label: `DTI: ${dtiLabel} (default)`, value: dtiValue });

  const loanAmountLabel = getVerusHelocLoanAmountLabel(selectedLoanAmount);
  const loanAmountValue = getVerusMatrixValue(VERUS_HELOC_LOAN_AMOUNT_TABLE, loanAmountLabel, cltvColumnIndex);
  if (loanAmountValue !== null) rows.push({ label: `Loan Amount: ${loanAmountLabel}`, value: loanAmountValue });

  const occupancyLabel = getVerusOccupancyLabel(input.occupancy);
  if (occupancyLabel) {
    const occupancyValue = getVerusMatrixValue(VERUS_HELOC_OCCUPANCY_TABLE, occupancyLabel, cltvColumnIndex);
    if (occupancyValue !== null) rows.push({ label: `Occupancy: ${occupancyLabel}`, value: occupancyValue });
  }

  const propertyTypeLabel = getVerusPropertyTypeLabel(input);
  if (propertyTypeLabel) {
    const propertyValue = getVerusMatrixValue(VERUS_HELOC_PROPERTY_TYPE_TABLE, propertyTypeLabel, cltvColumnIndex);
    if (propertyValue !== null) rows.push({ label: `Property Type: ${propertyTypeLabel}`, value: propertyValue });
  }

  if (VERUS_STATE_BUCKET.has(input.propertyState)) {
    const stateValue = getVerusMatrixValue(VERUS_HELOC_STATE_TABLE, 'CT, IL, NJ, NY', cltvColumnIndex);
    if (stateValue !== null) rows.push({ label: `State: ${input.propertyState}`, value: stateValue });
  }

  rows.push({ label: `Lock Period: ${lockPeriodDays} days`, value: VERUS_HELOC_LOCK_ADJUSTMENTS[lockPeriodDays] ?? 0 });
  return rows;
}

function getVerusHelocCltvColumnIndex(resultingCltv: number): number {
  const cltvPct = resultingCltv * 100;
  const upperBounds = [50, 55, 60, 65, 70, 75, 80, 85, 90];
  for (let i = 0; i < upperBounds.length; i += 1) {
    if (cltvPct <= upperBounds[i]) return i;
  }
  return upperBounds.length - 1;
}

function getVerusHelocDocCltvColumnIndex(resultingCltv: number): number {
  const cltvPct = resultingCltv * 100;
  const upperBounds = [50, 55, 60, 65, 70, 75, 80, 85];
  for (let i = 0; i < upperBounds.length; i += 1) {
    if (cltvPct <= upperBounds[i]) return i;
  }
  return upperBounds.length - 1;
}

function getVerusHelocFicoLabel(creditScore: number): string {
  if (creditScore >= 780) return '780+';
  if (creditScore >= 760) return '760-779';
  if (creditScore >= 740) return '740-759';
  if (creditScore >= 720) return '720-739';
  if (creditScore >= 700) return '700-719';
  return '680-699';
}

function getVerusHelocLoanAmountLabel(amount: number): string {
  if (amount <= 100000) return '$50,000 - $100,000';
  if (amount <= 250000) return '$100,001 - $250,000';
  if (amount <= 350000) return '$250,001 - $350,000';
  return '$350,001 - $500,000';
}

function getVerusOccupancyLabel(occupancy: string): '2nd Home' | 'Investor' | null {
  if (occupancy === 'Second Home') return '2nd Home';
  if (occupancy === 'Investment') return 'Investor';
  return null;
}

function getVerusPropertyTypeLabel(input: VerusPricingInput): 'Condo' | '2-4 Unit' | null {
  const type = input.structureType.toLowerCase();
  if (type.includes('condo')) return 'Condo';
  if (input.unitCount >= 2) return '2-4 Unit';
  return null;
}

function getVerusCesCltvColumnIndex(resultingCltv: number): number {
  const cltvPct = resultingCltv * 100;
  const upperBounds = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
  for (let i = 0; i < upperBounds.length; i += 1) {
    if (cltvPct <= upperBounds[i]) return i;
  }
  return upperBounds.length - 1;
}

function getVerusCesDocCltvColumnIndex(resultingCltv: number): number {
  const cltvPct = resultingCltv * 100;
  const upperBounds = [50, 55, 60, 65, 70, 75, 80, 85];
  for (let i = 0; i < upperBounds.length; i += 1) {
    if (cltvPct <= upperBounds[i]) return i;
  }
  return upperBounds.length - 1;
}

function getVerusCesFicoLabel(creditScore: number): string {
  if (creditScore >= 800) return '800+';
  if (creditScore >= 780) return '780-799';
  if (creditScore >= 760) return '760-779';
  if (creditScore >= 740) return '740-759';
  if (creditScore >= 720) return '720-739';
  if (creditScore >= 700) return '700-719';
  return '680-699';
}

function getVerusCesLoanAmountLabel(amount: number): string {
  if (amount < 75000) return '< $75,000';
  if (amount <= 100000) return '$75,000 - $100,000';
  if (amount <= 150000) return '$100,001 - $150,000';
  if (amount <= 200000) return '$150,001 - $200,000';
  if (amount <= 350000) return '$200,001 - $350,000';
  if (amount <= 500000) return '$350,001 - $500,000';
  return '$500,001 - $750,000';
}

function getVerusMatrixValue(table: VerusSecondPriceMatrixTable, rowLabel: string, columnIndex: number): number | null {
  const rowIndex = table.rows.findIndex(row => row === rowLabel);
  if (rowIndex < 0) return null;
  const cell = table.values[rowIndex]?.[columnIndex];
  if (cell === null || cell === undefined || cell === 'NA') return null;
  return Number(cell);
}

function normalizeProgram(program?: string, product?: string): VerusProgram {
  const source = `${program ?? ''} ${product ?? ''}`.toUpperCase();
  return source.includes('HELOC') ? 'HELOC' : 'CES';
}

function normalizeProduct(program: VerusProgram, product?: string): VerusProduct {
  const value = String(product || '').toUpperCase();
  if (program === 'HELOC') {
    if (value.includes('15')) return '15 YR';
    if (value.includes('20')) return '20 YR';
    if (value.includes('25')) return '25 YR';
    return '30 YR';
  }
  if (value.includes('10')) return '10 YR FIX';
  if (value.includes('15')) return '15 YR FIX';
  if (value.includes('20')) return '20 YR FIX';
  if (value.includes('25')) return '25 YR FIX';
  return '30 YR FIX';
}

function normalizeOccupancy(value?: string): string {
  const text = String(value || '').toLowerCase();
  if (text.includes('investment')) return 'Investment';
  if (text.includes('second')) return 'Second Home';
  return 'Primary';
}

function termYearsForVerusCes(product: VerusCesProduct): number {
  return Number(product.slice(0, 2).trim());
}

function amortizedPayment(balance: number, rate: number, years: number): number {
  if (balance <= 0) return 0;
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  return roundToNearestDollar(balance * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToNearestDollar(value: number): number {
  return Math.round(value);
}
