import ratesheet from './verus-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import {
  calculateAmortizingMonthlyPayment,
  calculateInterestOnlyMonthlyPayment,
  calculateMaxAvailableFromMaxLtv,
  type Stage1AdjustmentLine,
} from './shared';

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
  dti: number | null;
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

type VerusSecondPriceMatrixTable = {
  rows: string[];
  columns: string[];
  values: Matrix;
};

type VerusAdjustmentTables = {
  docStandard2Year: VerusSecondPriceMatrixTable;
  docAlt: VerusSecondPriceMatrixTable;
  dti: VerusSecondPriceMatrixTable;
  loanAmount: VerusSecondPriceMatrixTable;
  occupancy: VerusSecondPriceMatrixTable;
  propertyType: VerusSecondPriceMatrixTable;
  state: VerusSecondPriceMatrixTable;
  lockAdjustments: Record<string, number>;
};

type VerusData = {
  programs: {
    CES: {
      minPrice: number;
      maxPrice: number;
      pricing: { standard: CesRow[]; alt: CesRow[] };
      adjustments: VerusAdjustmentTables;
      guideMaxPrice?: {
        default: number | null;
      };
    };
    HELOC: {
      primeRate: number;
      pricing: HelocRow[];
      adjustments: VerusAdjustmentTables & { drawTerm: VerusSecondPriceMatrixTable };
      guideMaxPrice?: Partial<Record<VerusHelocProduct, number | null>>;
    };
  };
};

const DATA = ratesheet as VerusData;

export function getVerusGuideMaxPrice(input: Pick<VerusPricingInput, 'program' | 'product'>): number {
  if (input.program === 'HELOC') {
    const maxPrice = DATA.programs.HELOC.guideMaxPrice?.[input.product as VerusHelocProduct];
    if (!Number.isFinite(maxPrice)) {
      throw new Error(`Verus HELOC guide max price is missing from verus-ratesheet.json for ${input.product}.`);
    }
    return Number(maxPrice);
  }

  const maxPrice = DATA.programs.CES.guideMaxPrice?.default;
  if (!Number.isFinite(maxPrice)) {
    throw new Error('Verus CES guide max price is missing from verus-ratesheet.json.');
  }
  return Number(maxPrice);
}

const VERUS_CES_ADJUSTMENTS = DATA.programs.CES.adjustments;
const VERUS_HELOC_ADJUSTMENTS = DATA.programs.HELOC.adjustments;

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
    dti: Number.isFinite(Number(stage1.dti)) ? Number(stage1.dti) : null,
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
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(stage1, input, input.desiredLoanAmount));
  const maxAvailable = calculateMaxAvailable(stage1, input, selectedLoanAmount);
  const maxLtv = calculateMaxLtv(stage1, input, selectedLoanAmount);
  if (selectedLoanAmount > maxAvailable || input.resultingCltv > maxLtv) {
    return {
      program: input.program,
      product: input.product,
      maxAvailable,
      maxLtv,
      rate: 0,
      noteRate: 0,
      rateType: input.program === 'HELOC' ? 'Variable' : 'Fixed',
      monthlyPayment: 0,
      basePrice: 0,
      llpaAdjustment: 0,
      purchasePrice: 0,
      adjustments: [],
    };
  }
  const rawTargetPrice = options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);
  const targetPrice = Math.min(rawTargetPrice, getVerusGuideMaxPrice(input));
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
      maxAvailable: calculateMaxAvailable(stage1, input, selectedLoanAmount),
      maxLtv: calculateMaxLtv(stage1, input, selectedLoanAmount),
      rate: noteRate,
      noteRate,
      rateType: 'Variable',
      monthlyPayment: roundToNearestDollar(calculateInterestOnlyMonthlyPayment(selectedLoanAmount, noteRate)),
      basePrice: selected.basePrice,
      llpaAdjustment,
      purchasePrice: selected.purchasePrice,
      adjustments,
    };
  }

  const selected = options?.rateOverride !== undefined
    ? pickCesExecutionByRate(
        input.product as VerusCesProduct,
        normalizeDocType(stage1.verusDocType),
        options.rateOverride,
        llpaAdjustment
      )
    : pickCesExecution(
        input.product as VerusCesProduct,
        normalizeDocType(stage1.verusDocType),
        clamp(targetPrice, DATA.programs.CES.minPrice, getVerusGuideMaxPrice(input)),
        llpaAdjustment
      );
  return {
    program: 'CES',
    product: input.product,
    maxAvailable: calculateMaxAvailable(stage1, input, selectedLoanAmount),
    maxLtv: calculateMaxLtv(stage1, input, selectedLoanAmount),
    rate: selected.rate,
    noteRate: selected.rate,
    rateType: 'Fixed',
    monthlyPayment: roundToNearestDollar(calculateAmortizingMonthlyPayment(selectedLoanAmount, selected.rate, termYearsForVerusCes(input.product as VerusCesProduct))),
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

  const maxLtv = calculateMaxLtv(stage1, input, requested);
  const maxAvailable = calculateMaxAvailable(stage1, input, requested);

  if (maxLtv <= 0) reasons.push('This Verus scenario is not eligible in the current workbook.');
  else if (input.resultingCltv > maxLtv) reasons.push('Resulting CLTV exceeds the current supported Verus workbook range.');
  if (requested > maxAvailable) reasons.push('Desired loan amount exceeds the current max available amount.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
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
    ? clamp(options.targetPrice, DATA.programs.CES.minPrice, getVerusGuideMaxPrice(quote))
    : Math.min(options.targetPrice, getVerusGuideMaxPrice(quote));
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

function calculateMaxAvailable(
  stage1: ButtonStage1Input & { verusDocType?: VerusDocType; verusDrawPeriodYears?: VerusDrawPeriodYears; verusLockPeriodDays?: VerusLockPeriodDays },
  input: VerusPricingInput,
  selectedLoanAmount = input.desiredLoanAmount
): number {
  return calculateMaxAvailableFromMaxLtv(input.propertyValue, input.loanBalance, calculateMaxLtv(stage1, input, selectedLoanAmount));
}

function calculateMaxLtv(
  stage1: ButtonStage1Input & { verusDocType?: VerusDocType; verusDrawPeriodYears?: VerusDrawPeriodYears; verusLockPeriodDays?: VerusLockPeriodDays },
  input: VerusPricingInput,
  selectedLoanAmount = input.desiredLoanAmount
): number {
  const docType = normalizeDocType(stage1.verusDocType);

  if (input.program === 'CES') {
    const ficoLabel = getMatchingFicoLabel(getVerusCesDocTable(docType).rows, input.creditScore);
    const loanAmountLabel = getMatchingLoanAmountLabel(VERUS_CES_ADJUSTMENTS.loanAmount.rows, selectedLoanAmount);
    const occupancyLabel = getVerusOccupancyLabel(input.occupancy);
    const propertyTypeLabel = getVerusPropertyTypeLabel(input);
    const dtiLabel = getMatchingDtiLabel(VERUS_CES_ADJUSTMENTS.dti.rows, input.dti);

    let maxEligible = 0;
    VERUS_CES_ADJUSTMENTS.loanAmount.columns.forEach((columnLabel, index) => {
      const cltvEligible = isVerusCesColumnEligible({
        columnIndex: index,
        columnLabel,
        docType,
        ficoLabel,
        loanAmountLabel,
        dtiLabel,
        occupancyLabel,
        propertyTypeLabel,
        propertyState: input.propertyState,
      });
      if (cltvEligible) maxEligible = getCltvUpperBound(String(columnLabel)) / 100;
    });
    return maxEligible;
  }

  const ficoLabel = getMatchingFicoLabel(getVerusHelocDocTable(docType).rows, input.creditScore);
  const loanAmountLabel = getMatchingLoanAmountLabel(VERUS_HELOC_ADJUSTMENTS.loanAmount.rows, selectedLoanAmount);
  const occupancyLabel = getVerusOccupancyLabel(input.occupancy);
  const propertyTypeLabel = getVerusPropertyTypeLabel(input);
  const dtiLabel = getMatchingDtiLabel(VERUS_HELOC_ADJUSTMENTS.dti.rows, input.dti);
  const drawYears = normalizeDrawPeriodYears(stage1.verusDrawPeriodYears);

  let maxEligible = 0;
  VERUS_HELOC_ADJUSTMENTS.loanAmount.columns.forEach((columnLabel, index) => {
    const cltvEligible = isVerusHelocColumnEligible({
      columnIndex: index,
      columnLabel,
      docType,
      ficoLabel,
      loanAmountLabel,
      dtiLabel,
      occupancyLabel,
      propertyTypeLabel,
      propertyState: input.propertyState,
      drawYears,
    });
    if (cltvEligible) maxEligible = getCltvUpperBound(String(columnLabel)) / 100;
  });
  return maxEligible;
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
  const docType = normalizeDocType(stage1.verusDocType);
  const lockPeriodDays = normalizeLockPeriodDays(stage1.verusLockPeriodDays);

  if (input.program === 'CES') {
    rows.push({ label: `Doc Type: ${docType}`, value: 0 });

    const docTable = getVerusCesDocTable(docType);
    const cltvColumnIndex = getMatchingColumnIndex(VERUS_CES_ADJUSTMENTS.loanAmount.columns, input.resultingCltv);
    const docCltvColumnIndex = getMatchingColumnIndex(docTable.columns, input.resultingCltv);
    const ficoLabel = getMatchingFicoLabel(docTable.rows, input.creditScore);
    const docValue = getVerusMatrixValue(docTable, ficoLabel, docCltvColumnIndex);
    if (docValue !== null) rows.push({ label: `${docType === 'Alt Doc' ? 'Alt Doc' : 'Standard Doc - 2 Years'}: ${ficoLabel}`, value: docValue });

    const loanAmountLabel = getMatchingLoanAmountLabel(VERUS_CES_ADJUSTMENTS.loanAmount.rows, selectedLoanAmount);
    const loanAmountValue = getVerusMatrixValue(VERUS_CES_ADJUSTMENTS.loanAmount, loanAmountLabel, cltvColumnIndex);
    if (loanAmountValue !== null) rows.push({ label: `Loan Amount: ${loanAmountLabel}`, value: loanAmountValue });

    const dtiLabel = getMatchingDtiLabel(VERUS_CES_ADJUSTMENTS.dti.rows, input.dti);
    const dtiValue = getVerusMatrixValue(VERUS_CES_ADJUSTMENTS.dti, dtiLabel, cltvColumnIndex);
    if (dtiValue !== null) rows.push({ label: `DTI: ${dtiLabel}`, value: dtiValue });

    const occupancyLabel = getVerusOccupancyLabel(input.occupancy);
    if (occupancyLabel) {
      const occupancyValue = getVerusMatrixValue(VERUS_CES_ADJUSTMENTS.occupancy, occupancyLabel, cltvColumnIndex);
      if (occupancyValue !== null) rows.push({ label: `Occupancy: ${occupancyLabel}`, value: occupancyValue });
    }

    const propertyTypeLabel = getVerusPropertyTypeLabel(input);
    if (propertyTypeLabel) {
      const propertyValue = getVerusMatrixValue(VERUS_CES_ADJUSTMENTS.propertyType, propertyTypeLabel, cltvColumnIndex);
      if (propertyValue !== null) rows.push({ label: `Property Type: ${propertyTypeLabel}`, value: propertyValue });
    }

    const stateLabel = getMatchingStateLabel(VERUS_CES_ADJUSTMENTS.state.rows, input.propertyState);
    if (stateLabel) {
      const stateValue = getVerusMatrixValue(VERUS_CES_ADJUSTMENTS.state, stateLabel, cltvColumnIndex);
      if (stateValue !== null) rows.push({ label: `State: ${input.propertyState}`, value: stateValue });
    }

    rows.push({ label: `Lock Period: ${lockPeriodDays} days`, value: getLockAdjustment(VERUS_CES_ADJUSTMENTS.lockAdjustments, lockPeriodDays, 'CES') });
    return rows;
  }

  const drawYears = normalizeDrawPeriodYears(stage1.verusDrawPeriodYears);
  rows.push({ label: 'Prime Rate', value: 0 });
  rows.push({ label: `Doc Type: ${docType}`, value: 0 });

  const docTable = getVerusHelocDocTable(docType);
  const cltvColumnIndex = getMatchingColumnIndex(VERUS_HELOC_ADJUSTMENTS.loanAmount.columns, input.resultingCltv);
  const docCltvColumnIndex = getMatchingColumnIndex(docTable.columns, input.resultingCltv);
  const ficoLabel = getMatchingFicoLabel(docTable.rows, input.creditScore);
  const docValue = getVerusMatrixValue(docTable, ficoLabel, docCltvColumnIndex);
  if (docValue !== null) rows.push({ label: `${docType === 'Alt Doc' ? 'Alt Doc' : 'Standard Doc - 2 Years'}: ${ficoLabel}`, value: docValue });

  const drawTermValue = getVerusMatrixValue(VERUS_HELOC_ADJUSTMENTS.drawTerm, String(drawYears * 12), cltvColumnIndex);
  if (drawTermValue !== null) rows.push({ label: `Draw Period: ${drawYears} Years`, value: drawTermValue });

  const dtiLabel = getMatchingDtiLabel(VERUS_HELOC_ADJUSTMENTS.dti.rows, input.dti);
  const dtiValue = getVerusMatrixValue(VERUS_HELOC_ADJUSTMENTS.dti, dtiLabel, cltvColumnIndex);
  if (dtiValue !== null) rows.push({ label: `DTI: ${dtiLabel}`, value: dtiValue });

  const loanAmountLabel = getMatchingLoanAmountLabel(VERUS_HELOC_ADJUSTMENTS.loanAmount.rows, selectedLoanAmount);
  const loanAmountValue = getVerusMatrixValue(VERUS_HELOC_ADJUSTMENTS.loanAmount, loanAmountLabel, cltvColumnIndex);
  if (loanAmountValue !== null) rows.push({ label: `Loan Amount: ${loanAmountLabel}`, value: loanAmountValue });

  const occupancyLabel = getVerusOccupancyLabel(input.occupancy);
  if (occupancyLabel) {
    const occupancyValue = getVerusMatrixValue(VERUS_HELOC_ADJUSTMENTS.occupancy, occupancyLabel, cltvColumnIndex);
    if (occupancyValue !== null) rows.push({ label: `Occupancy: ${occupancyLabel}`, value: occupancyValue });
  }

  const propertyTypeLabel = getVerusPropertyTypeLabel(input);
  if (propertyTypeLabel) {
    const propertyValue = getVerusMatrixValue(VERUS_HELOC_ADJUSTMENTS.propertyType, propertyTypeLabel, cltvColumnIndex);
    if (propertyValue !== null) rows.push({ label: `Property Type: ${propertyTypeLabel}`, value: propertyValue });
  }

  const stateLabel = getMatchingStateLabel(VERUS_HELOC_ADJUSTMENTS.state.rows, input.propertyState);
  if (stateLabel) {
    const stateValue = getVerusMatrixValue(VERUS_HELOC_ADJUSTMENTS.state, stateLabel, cltvColumnIndex);
    if (stateValue !== null) rows.push({ label: `State: ${input.propertyState}`, value: stateValue });
  }

  rows.push({ label: `Lock Period: ${lockPeriodDays} days`, value: getLockAdjustment(VERUS_HELOC_ADJUSTMENTS.lockAdjustments, lockPeriodDays, 'HELOC') });
  return rows;
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

function getVerusCesDocTable(docType: VerusDocType): VerusSecondPriceMatrixTable {
  return docType === 'Alt Doc' ? VERUS_CES_ADJUSTMENTS.docAlt : VERUS_CES_ADJUSTMENTS.docStandard2Year;
}

function getVerusHelocDocTable(docType: VerusDocType): VerusSecondPriceMatrixTable {
  return docType === 'Alt Doc' ? VERUS_HELOC_ADJUSTMENTS.docAlt : VERUS_HELOC_ADJUSTMENTS.docStandard2Year;
}

function getVerusMatrixValue(table: VerusSecondPriceMatrixTable, rowLabel: string | null, columnIndex: number | null): number | null {
  if (!rowLabel) return null;
  const cell = getVerusMatrixCell(table, rowLabel, columnIndex);
  if (cell === null || cell === undefined || String(cell).toUpperCase() === 'NA') return null;
  return Number(cell);
}

function getVerusMatrixCell(table: VerusSecondPriceMatrixTable, rowLabel: string | null, columnIndex: number | null): MatrixCell | undefined {
  if (rowLabel === null || columnIndex === null) return undefined;
  const rowIndex = table.rows.findIndex(row => row === rowLabel);
  if (rowIndex < 0) return undefined;
  return table.values[rowIndex]?.[columnIndex];
}

function getMatchingColumnIndex(labels: string[], resultingCltv: number): number | null {
  const cltvPct = resultingCltv * 100;
  for (let i = 0; i < labels.length; i += 1) {
    if (cltvPct <= getCltvUpperBound(labels[i])) return i;
  }
  return null;
}

function getCltvUpperBound(label: string): number {
  const normalized = String(label).replace(/\s+/g, ' ').trim();
  const maxOnly = normalized.match(/^<=\s*(\d+(?:\.\d+)?)/);
  if (maxOnly) return Number(maxOnly[1]);
  const range = normalized.match(/-\s*(\d+(?:\.\d+)?)/);
  if (range) return Number(range[1]);
  return Number.POSITIVE_INFINITY;
}

function getMatchingFicoLabel(labels: string[], creditScore: number): string | null {
  for (const label of labels) {
    const normalized = String(label).trim();
    const plus = normalized.match(/^(\d+)\+$/);
    if (plus && creditScore >= Number(plus[1])) return normalized;
    const range = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range && creditScore >= Number(range[1]) && creditScore <= Number(range[2])) return normalized;
  }
  return null;
}

function getMatchingLoanAmountLabel(labels: string[], amount: number): string | null {
  for (const label of labels) {
    const normalized = String(label).replace(/,/g, '').trim();
    const lt = normalized.match(/^<\s*\$(\d+(?:\.\d+)?)$/);
    if (lt && amount < Number(lt[1])) return String(label);
    const range = normalized.match(/^\$(\d+(?:\.\d+)?)\s*-\s*\$(\d+(?:\.\d+)?)$/);
    if (range && amount >= Number(range[1]) && amount <= Number(range[2])) return String(label);
  }
  return null;
}

function getMatchingDtiLabel(labels: string[], dti: number | null): string | null {
  if (dti === null || !Number.isFinite(dti)) return null;
  for (const label of labels) {
    const normalized = String(label).trim();
    const maxOnly = normalized.match(/^<=\s*(\d+(?:\.\d+)?)%$/);
    if (maxOnly && dti <= Number(maxOnly[1])) return normalized;
    const range = normalized.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)%$/);
    if (range && dti > Number(range[1]) && dti <= Number(range[2])) return normalized;
  }
  return null;
}

function getMatchingStateLabel(labels: string[], propertyState: string): string | null {
  return labels.find(label => String(label).split(',').map(part => part.trim().toUpperCase()).includes(propertyState.toUpperCase())) ?? null;
}

function isWorkbookEligibleCell(table: VerusSecondPriceMatrixTable, rowLabel: string | null, columnIndex: number | null): boolean {
  const cell = getVerusMatrixCell(table, rowLabel, columnIndex);
  return cell !== null && cell !== undefined && String(cell).toUpperCase() !== 'NA';
}

function isVerusCesColumnEligible(input: {
  columnIndex: number;
  columnLabel: string;
  docType: VerusDocType;
  ficoLabel: string | null;
  loanAmountLabel: string | null;
  dtiLabel: string | null;
  occupancyLabel: '2nd Home' | 'Investor' | null;
  propertyTypeLabel: 'Condo' | '2-4 Unit' | null;
  propertyState: string;
}): boolean {
  const docTable = getVerusCesDocTable(input.docType);
  const docColumnIndex = docTable.columns.findIndex(label => label === input.columnLabel);
  if (!isWorkbookEligibleCell(docTable, input.ficoLabel, docColumnIndex >= 0 ? docColumnIndex : null)) return false;
  if (!isWorkbookEligibleCell(VERUS_CES_ADJUSTMENTS.loanAmount, input.loanAmountLabel, input.columnIndex)) return false;
  if (!isWorkbookEligibleCell(VERUS_CES_ADJUSTMENTS.dti, input.dtiLabel, input.columnIndex)) return false;
  if (input.occupancyLabel && !isWorkbookEligibleCell(VERUS_CES_ADJUSTMENTS.occupancy, input.occupancyLabel, input.columnIndex)) return false;
  if (input.propertyTypeLabel && !isWorkbookEligibleCell(VERUS_CES_ADJUSTMENTS.propertyType, input.propertyTypeLabel, input.columnIndex)) return false;
  const stateLabel = getMatchingStateLabel(VERUS_CES_ADJUSTMENTS.state.rows, input.propertyState);
  if (stateLabel && !isWorkbookEligibleCell(VERUS_CES_ADJUSTMENTS.state, stateLabel, input.columnIndex)) return false;
  return true;
}

function isVerusHelocColumnEligible(input: {
  columnIndex: number;
  columnLabel: string;
  docType: VerusDocType;
  ficoLabel: string | null;
  loanAmountLabel: string | null;
  dtiLabel: string | null;
  occupancyLabel: '2nd Home' | 'Investor' | null;
  propertyTypeLabel: 'Condo' | '2-4 Unit' | null;
  propertyState: string;
  drawYears: VerusDrawPeriodYears;
}): boolean {
  const docTable = getVerusHelocDocTable(input.docType);
  const docColumnIndex = docTable.columns.findIndex(label => label === input.columnLabel);
  if (!isWorkbookEligibleCell(docTable, input.ficoLabel, docColumnIndex >= 0 ? docColumnIndex : null)) return false;
  if (!isWorkbookEligibleCell(VERUS_HELOC_ADJUSTMENTS.drawTerm, String(input.drawYears * 12), input.columnIndex)) return false;
  if (!isWorkbookEligibleCell(VERUS_HELOC_ADJUSTMENTS.dti, input.dtiLabel, input.columnIndex)) return false;
  if (!isWorkbookEligibleCell(VERUS_HELOC_ADJUSTMENTS.loanAmount, input.loanAmountLabel, input.columnIndex)) return false;
  if (input.occupancyLabel && !isWorkbookEligibleCell(VERUS_HELOC_ADJUSTMENTS.occupancy, input.occupancyLabel, input.columnIndex)) return false;
  if (input.propertyTypeLabel && !isWorkbookEligibleCell(VERUS_HELOC_ADJUSTMENTS.propertyType, input.propertyTypeLabel, input.columnIndex)) return false;
  const stateLabel = getMatchingStateLabel(VERUS_HELOC_ADJUSTMENTS.state.rows, input.propertyState);
  if (stateLabel && !isWorkbookEligibleCell(VERUS_HELOC_ADJUSTMENTS.state, stateLabel, input.columnIndex)) return false;
  return true;
}

function normalizeProgram(program?: string, product?: string): VerusProgram {
  const source = `${program ?? ''} ${product ?? ''}`.toUpperCase();
  if (source.includes('HELOC')) return 'HELOC';
  if (source.includes('CES') || source.includes('FIX')) return 'CES';
  throw new Error(`Unsupported Verus program/product combination: ${program ?? ''} ${product ?? ''}`.trim());
}

function normalizeProduct(program: VerusProgram, product?: string): VerusProduct {
  const value = String(product || '').toUpperCase();
  if (program === 'HELOC') {
    if (value.includes('15')) return '15 YR';
    if (value.includes('20')) return '20 YR';
    if (value.includes('25')) return '25 YR';
    if (value.includes('30')) return '30 YR';
    throw new Error(`Unsupported Verus HELOC product: ${product ?? ''}`);
  }
  if (value.includes('10')) return '10 YR FIX';
  if (value.includes('15')) return '15 YR FIX';
  if (value.includes('20')) return '20 YR FIX';
  if (value.includes('25')) return '25 YR FIX';
  if (value.includes('30')) return '30 YR FIX';
  throw new Error(`Unsupported Verus CES product: ${product ?? ''}`);
}

function normalizeDocType(value?: string): VerusDocType {
  const text = String(value || '').toLowerCase();
  if (text.includes('standard') || text.includes('full')) return 'Standard';
  if (text.includes('alt') || text.includes('bank') || text.includes('1099') || text.includes('wvoe') || text.includes('p&l') || text.includes('p & l') || text.includes('pnl')) return 'Alt Doc';
  throw new Error(`Unsupported Verus doc type: ${value ?? ''}`);
}

function normalizeDrawPeriodYears(value?: number): VerusDrawPeriodYears {
  if (value === 2 || value === 3 || value === 5) return value;
  throw new Error(`Unsupported Verus draw period: ${value ?? ''}`);
}

function normalizeLockPeriodDays(value?: number): VerusLockPeriodDays {
  if (value === 30 || value === 45 || value === 60) return value;
  throw new Error(`Unsupported Verus lock period: ${value ?? ''}`);
}

function normalizeOccupancy(value?: string): string {
  const text = String(value || '').toLowerCase();
  if (text.includes('investment')) return 'Investment';
  if (text.includes('second')) return 'Second Home';
  if (text.includes('primary') || text.includes('owner')) return 'Primary';
  throw new Error(`Unsupported Verus occupancy: ${value ?? ''}`);
}

function getLockAdjustment(lockAdjustments: Record<string, number>, lockPeriodDays: VerusLockPeriodDays, program: VerusProgram): number {
  const adjustment = lockAdjustments[String(lockPeriodDays)];
  if (!Number.isFinite(adjustment)) {
    throw new Error(`Verus ${program} lock adjustment is missing from verus-ratesheet.json for ${lockPeriodDays} days.`);
  }
  return adjustment;
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
