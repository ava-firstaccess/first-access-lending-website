import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';

export type VistaProduct = '30yr Fixed' | '20yr Fixed' | '15yr Fixed' | '10yr Fixed' | '20yr IO' | '30yr IO';

export interface VistaPricingInput {
  product: VistaProduct;
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
}

export interface VistaEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type VistaRateRow = { noteRate: number; prices: Record<VistaProduct, number> };

const VISTA_MAX_PURCHASE_PRICE = 106;
const FIXED_PRODUCTS: VistaProduct[] = ['30yr Fixed', '20yr Fixed', '15yr Fixed', '10yr Fixed'];
const VISTA_PRODUCTS: VistaProduct[] = ['30yr Fixed', '20yr Fixed', '15yr Fixed', '10yr Fixed', '20yr IO', '30yr IO'];

const NOTE_RATES = [
  11.5, 11.375, 11.25, 11.125, 11, 10.875, 10.75, 10.625, 10.5, 10.375, 10.25, 10.125,
  10, 9.875, 9.75, 9.625, 9.5, 9.375, 9.25, 9.125, 9, 8.875, 8.75, 8.625, 8.5, 8.375,
  8.25, 8.125, 8, 7.875, 7.75, 7.625, 7.5,
];

const RATE_ROWS: VistaRateRow[] = NOTE_RATES.map((noteRate, index) => {
  const step = NOTE_RATES.length - 1 - index;
  const base = 99.75 + step * 0.1875;
  return {
    noteRate,
    prices: {
      '30yr Fixed': roundToThree(base + 0.5),
      '20yr Fixed': roundToThree(base + 0.25),
      '15yr Fixed': roundToThree(base + 0.125),
      '10yr Fixed': roundToThree(base),
      '20yr IO': roundToThree(base + 0.625),
      '30yr IO': roundToThree(base + 0.875),
    },
  };
});

export function buildVistaStage1PricingInput(stage1: ButtonStage1Input & { vistaProduct?: VistaProduct }): VistaPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    product: normalizeVistaProduct(stage1.vistaProduct),
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
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct },
  options?: { selectedLoanAmount?: number; targetPrice?: number }
): VistaQuote {
  return calculateVistaQuote(buildVistaStage1PricingInput(stage1), options);
}

export function calculateVistaQuote(
  input: VistaPricingInput,
  options?: { selectedLoanAmount?: number; targetPrice?: number }
): VistaQuote {
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const targetPrice = Math.min(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), VISTA_MAX_PURCHASE_PRICE);
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickRateAtOrBelowTarget(input.product, llpaAdjustment, targetPrice);

  return {
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
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct },
  selectedLoanAmount?: number
): VistaEligibilityResult {
  const input = buildVistaStage1PricingInput(stage1);
  const reasons: string[] = [];
  const maxAvailable = calculateMaxAvailable(input);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);

  if (input.creditScore < 680) reasons.push('Credit score is below the current Vista tester range.');
  if (input.resultingCltv > calculateMaxLtv(input)) reasons.push('Resulting CLTV exceeds the current Vista tester limit.');
  if (requested > maxAvailable) reasons.push('Desired loan amount exceeds the current max available amount.');
  if (input.cashOut && input.product.includes('IO') && input.propertyState === 'TX') reasons.push('Texas cash-out with interest-only is not supported in this Vista tester.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
    resultingCltv: input.resultingCltv,
  };
}

export function solveVistaStage1TargetRate(
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): VistaTargetRateQuote {
  const input = buildVistaStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = Math.min(options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), VISTA_MAX_PURCHASE_PRICE);
  const tolerance = options.tolerance ?? 0.125;
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickRateAtOrBelowTarget(input.product, llpaAdjustment, targetPrice);
  const deltaFromTarget = roundToThree(targetPrice - selected.purchasePrice);

  return {
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
  };
}

function calculateMaxAvailable(input: VistaPricingInput): number {
  return Math.max(0, input.propertyValue * calculateMaxLtv(input) - input.loanBalance);
}

function calculateMaxLtv(input: VistaPricingInput): number {
  const occupancy = normalizeOccupancy(input.occupancy);
  const score = input.creditScore;
  let max = occupancy === 'Investor'
    ? score >= 760 ? 0.8 : score >= 740 ? 0.75 : score >= 720 ? 0.7 : 0.6
    : occupancy === 'Second Home'
      ? score >= 760 ? 0.85 : score >= 740 ? 0.8 : score >= 720 ? 0.75 : 0.7
      : score >= 760 ? 0.9 : score >= 740 ? 0.85 : score >= 720 ? 0.8 : 0.75;

  if (input.structureType === 'Condo') max -= occupancy === 'Investor' ? 0.05 : 0;
  if (input.unitCount > 1) max -= 0.05;
  if (input.product.includes('IO')) max -= 0.05;
  if (input.propertyState === 'TX' && input.cashOut) max = Math.min(max, 0.8);
  return Math.max(0.45, roundToThree(max));
}

function buildAdjustmentLines(input: VistaPricingInput, selectedLoanAmount: number): VistaAdjustmentLine[] {
  const cltvPct = input.resultingCltv * 100;
  const occupancy = normalizeOccupancy(input.occupancy);
  const lines: VistaAdjustmentLine[] = [];

  if (input.creditScore < 700) lines.push({ label: 'FICO 680-699', value: -1.125 });
  else if (input.creditScore < 720) lines.push({ label: 'FICO 700-719', value: -0.75 });
  else if (input.creditScore < 740) lines.push({ label: 'FICO 720-739', value: -0.375 });
  else if (input.creditScore < 760) lines.push({ label: 'FICO 740-759', value: -0.125 });
  else lines.push({ label: 'FICO 760+', value: 0 });

  if (cltvPct > 85) lines.push({ label: 'CLTV 85.01-90', value: -1.25 });
  else if (cltvPct > 80) lines.push({ label: 'CLTV 80.01-85', value: -0.75 });
  else if (cltvPct > 75) lines.push({ label: 'CLTV 75.01-80', value: -0.375 });
  else if (cltvPct > 70) lines.push({ label: 'CLTV 70.01-75', value: -0.125 });
  else lines.push({ label: 'CLTV <= 70', value: 0 });

  if (occupancy === 'Second Home') lines.push({ label: 'Second Home', value: -0.25 });
  if (occupancy === 'Investor') lines.push({ label: 'Investment Property', value: -0.625 });
  if (input.structureType === 'Condo') lines.push({ label: 'Condo', value: -0.25 });
  if (input.unitCount > 1) lines.push({ label: `${input.unitCount} Units`, value: -0.375 });
  if (input.cashOut) lines.push({ label: 'Cash-Out', value: -0.25 });
  if (selectedLoanAmount >= 200000) lines.push({ label: 'Loan Amount >= 200k', value: 0.125 });
  if (selectedLoanAmount >= 400000) lines.push({ label: 'Loan Amount >= 400k', value: 0.125 });
  if (input.product === '20yr IO') lines.push({ label: '20yr IO', value: 0.25 });
  if (input.product === '30yr IO') lines.push({ label: '30yr IO', value: 0.375 });
  if (input.propertyState === 'TX' && input.cashOut) lines.push({ label: 'TX Equity Overlay', value: -0.25 });

  return lines;
}

function pickRateAtOrBelowTarget(
  product: VistaProduct,
  llpaAdjustment: number,
  targetPrice: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let bestUnder: { noteRate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { noteRate: RATE_ROWS[0].noteRate, basePrice: RATE_ROWS[0].prices[product], purchasePrice: 0 };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of RATE_ROWS) {
    const basePrice = row.prices[product];
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    if (purchasePrice <= targetPrice && (!bestUnder || purchasePrice > bestUnder.purchasePrice)) {
      bestUnder = { noteRate: row.noteRate, basePrice, purchasePrice };
    }
    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < fallbackDelta || (delta === fallbackDelta && purchasePrice > fallback.purchasePrice)) {
      fallback = { noteRate: row.noteRate, basePrice, purchasePrice };
      fallbackDelta = delta;
    }
  }

  return bestUnder ?? fallback;
}

function calculateMonthlyPayment(product: VistaProduct, noteRate: number, loanAmount: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = noteRate / 100 / 12;
  const termYears = product === '10yr Fixed' ? 10 : product === '15yr Fixed' ? 15 : 20;
  const amortYears = product === '30yr Fixed' || product === '30yr IO' ? 30 : termYears;
  const ioYears = product === '20yr IO' || product === '30yr IO' ? 3 : 0;

  if (!ioYears) {
    const n = amortYears * 12;
    return roundToNearestDollar(loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
  }

  return roundToNearestDollar(loanAmount * monthlyRate);
}

function normalizeVistaProduct(product?: string): VistaProduct {
  if (VISTA_PRODUCTS.includes(product as VistaProduct)) return product as VistaProduct;
  return '30yr Fixed';
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
  if (value.includes('multi')) return '2-4 Unit';
  return 'SFR';
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToNearestDollar(value: number): number {
  return Math.round(value);
}

export { FIXED_PRODUCTS };
