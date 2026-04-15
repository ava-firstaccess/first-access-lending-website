import ratesheet from './deephaven-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import type { Stage1AdjustmentLine } from './shared';

export type DeephavenProgram = 'Expanded Prime' | 'Non-Prime';
export type DeephavenProduct = '15Y Fixed' | '30Y Fixed';

export interface DeephavenPricingInput {
  program: DeephavenProgram;
  product: DeephavenProduct;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  occupancy: string;
}

export interface DeephavenQuote {
  program: DeephavenProgram;
  product: DeephavenProduct;
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

export interface DeephavenTargetRateQuote extends DeephavenQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
}

export interface DeephavenEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type PricingRow = { rate: number; prices: Record<DeephavenProduct, number | null> };
type ProgramData = {
  minPrice: number;
  maxPriceTiers: Array<{ upToLoanAmount: number; maxPrice: number }>;
  pricing: PricingRow[];
};

type DeephavenData = { programs: Record<DeephavenProgram, ProgramData> };
const DATA = ratesheet as DeephavenData;

export function buildDeephavenStage1PricingInput(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct }
): DeephavenPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    program: normalizeProgram(stage1.deephavenProgram),
    product: normalizeProduct(stage1.deephavenProduct),
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    occupancy: normalizeOccupancy(stage1.occupancy),
  };
}

export function calculateDeephavenStage1Quote(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct },
  options?: { selectedLoanAmount?: number; targetPrice?: number }
): DeephavenQuote {
  const input = buildDeephavenStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = clampTargetPrice(input, options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), selectedLoanAmount);
  const selected = pickExecution(input, targetPrice);

  return {
    program: input.program,
    product: input.product,
    maxAvailable: calculateMaxAvailable(input),
    maxLtv: calculateMaxLtv(input),
    rate: selected.rate,
    noteRate: selected.rate,
    rateType: 'Fixed',
    monthlyPayment: amortizedPayment(selectedLoanAmount, selected.rate, input.product === '15Y Fixed' ? 15 : 30),
    basePrice: selected.basePrice,
    llpaAdjustment: 0,
    purchasePrice: selected.purchasePrice,
    adjustments: [{ label: `Program: ${input.program}`, value: 0 }],
  };
}

export function evaluateDeephavenStage1Eligibility(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct },
  selectedLoanAmount?: number
): DeephavenEligibilityResult {
  const input = buildDeephavenStage1PricingInput(stage1);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const reasons: string[] = [];

  if (input.occupancy === 'Primary') reasons.push('Deephaven tester is wired for non-owner occupied CES scenarios.');
  if (input.creditScore < minCreditScore(input.program)) reasons.push('Credit score is below the current supported Deephaven tester range.');
  if (input.resultingCltv > calculateMaxLtv(input)) reasons.push('Resulting CLTV exceeds the current supported Deephaven tester range.');
  if (requested > calculateMaxAvailable(input)) reasons.push('Desired loan amount exceeds the current max available amount.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable: calculateMaxAvailable(input),
    resultingCltv: input.resultingCltv,
  };
}

export function solveDeephavenStage1TargetRate(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): DeephavenTargetRateQuote {
  const input = buildDeephavenStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = clampTargetPrice(input, options.targetPrice, selectedLoanAmount);
  const quote = calculateDeephavenStage1Quote(stage1, { selectedLoanAmount, targetPrice });
  const tolerance = options.tolerance ?? 0.125;
  const deltaFromTarget = roundToThree(targetPrice - quote.purchasePrice);

  return {
    ...quote,
    targetPrice,
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
  };
}

function pickExecution(input: DeephavenPricingInput, targetPrice: number) {
  const rows = DATA.programs[input.program].pricing;
  let bestUnder: { rate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { rate: rows[0].rate, basePrice: Number(rows[0].prices[input.product] ?? 0), purchasePrice: Number(rows[0].prices[input.product] ?? 0) };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[input.product] ?? 0);
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

function calculateMaxAvailable(input: DeephavenPricingInput): number {
  return Math.max(0, input.propertyValue * calculateMaxLtv(input) - input.loanBalance);
}

function calculateMaxLtv(input: DeephavenPricingInput): number {
  if (input.program === 'Expanded Prime') {
    if (input.creditScore >= 780) return 0.85;
    if (input.creditScore >= 740) return 0.8;
    if (input.creditScore >= 700) return 0.75;
    return 0.7;
  }
  if (input.creditScore >= 720) return 0.8;
  if (input.creditScore >= 680) return 0.75;
  if (input.creditScore >= 640) return 0.7;
  return 0.65;
}

function minCreditScore(program: DeephavenProgram): number {
  return program === 'Expanded Prime' ? 660 : 620;
}

function clampTargetPrice(input: DeephavenPricingInput, targetPrice: number, selectedLoanAmount: number): number {
  const program = DATA.programs[input.program];
  let maxPrice = program.maxPriceTiers[program.maxPriceTiers.length - 1]?.maxPrice ?? 103;
  for (const tier of program.maxPriceTiers) {
    if (selectedLoanAmount <= tier.upToLoanAmount) {
      maxPrice = tier.maxPrice;
      break;
    }
  }
  return roundToThree(Math.min(maxPrice, Math.max(program.minPrice, targetPrice)));
}

function normalizeProgram(value?: string): DeephavenProgram {
  return String(value || '').toLowerCase().includes('non') ? 'Non-Prime' : 'Expanded Prime';
}

function normalizeProduct(value?: string): DeephavenProduct {
  return String(value || '').includes('15') ? '15Y Fixed' : '30Y Fixed';
}

function normalizeOccupancy(value?: string): string {
  const text = String(value || '').toLowerCase();
  if (text.includes('investment')) return 'Investment';
  if (text.includes('second')) return 'Second Home';
  return 'Primary';
}

function amortizedPayment(balance: number, rate: number, years: number): number {
  if (balance <= 0) return 0;
  const monthlyRate = rate / 100 / 12;
  const n = years * 12;
  return roundToNearestDollar(balance * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToNearestDollar(value: number): number {
  return Math.round(value);
}
