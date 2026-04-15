import ratesheet from './verus-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import type { Stage1AdjustmentLine } from './shared';

export type VerusProgram = 'CES' | 'HELOC';
export type VerusCesProduct = '10 YR FIX' | '15 YR FIX' | '20 YR FIX' | '25 YR FIX' | '30 YR FIX';
export type VerusHelocProduct = '15 YR' | '20 YR' | '25 YR' | '30 YR';
export type VerusProduct = VerusCesProduct | VerusHelocProduct;
export type VerusDocType = 'Standard' | 'Alt Doc';
export type VerusDrawPeriodYears = 2 | 3 | 5;

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
}

export interface VerusEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type CesRow = { rate: number; prices: Record<VerusCesProduct, number | null> };
type HelocRow = { margin: number; prices: Record<VerusHelocProduct, number | null> };

type VerusData = {
  programs: {
    CES: { minPrice: number; maxPrice: number; pricing: { standard: CesRow[]; alt: CesRow[] } };
    HELOC: { primeRate: number; pricing: HelocRow[] };
  };
};

const DATA = ratesheet as VerusData;

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
  const program = normalizeProgram(stage1.verusProgram, stage1.product);

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
  };
}

export function calculateVerusStage1Quote(
  stage1: ButtonStage1Input & {
    verusProgram?: VerusProgram;
    verusProduct?: VerusProduct;
    verusDocType?: VerusDocType;
    verusDrawPeriodYears?: VerusDrawPeriodYears;
  },
  options?: { selectedLoanAmount?: number; targetPrice?: number }
): VerusQuote {
  const input = buildVerusStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);
  const llpaAdjustment = 0;
  const adjustments = buildAdjustmentLines(stage1, input);

  if (input.program === 'HELOC') {
    const selected = pickHelocExecution(input.product as VerusHelocProduct, targetPrice);
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

  const selected = pickCesExecution(input.product as VerusCesProduct, stage1.verusDocType ?? 'Standard', clamp(targetPrice, DATA.programs.CES.minPrice, DATA.programs.CES.maxPrice));
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

function pickCesExecution(product: VerusCesProduct, docType: VerusDocType, targetPrice: number) {
  const rows = docType === 'Alt Doc' ? DATA.programs.CES.pricing.alt : DATA.programs.CES.pricing.standard;
  let bestUnder: { rate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { rate: rows[0].rate, basePrice: Number(rows[0].prices[product] ?? 0), purchasePrice: Number(rows[0].prices[product] ?? 0) };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[product] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice);
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

function pickHelocExecution(product: VerusHelocProduct, targetPrice: number) {
  const rows = DATA.programs.HELOC.pricing;
  let bestUnder: { margin: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { margin: rows[0].margin, basePrice: Number(rows[0].prices[product] ?? 0), purchasePrice: Number(rows[0].prices[product] ?? 0) };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[product] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice);
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
  stage1: ButtonStage1Input & { verusDocType?: VerusDocType; verusDrawPeriodYears?: VerusDrawPeriodYears },
  input: VerusPricingInput
): Stage1AdjustmentLine[] {
  const rows: Stage1AdjustmentLine[] = [];
  if (input.program === 'CES') {
    rows.push({ label: `Doc Type: ${stage1.verusDocType ?? 'Standard'}`, value: 0 });
  } else {
    const drawYears = stage1.verusDrawPeriodYears ?? 5;
    rows.push({ label: `Prime Rate`, value: roundToThree(DATA.programs.HELOC.primeRate) });
    rows.push({ label: `Draw Period: ${drawYears} Years`, value: 0 });
  }
  return rows;
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
