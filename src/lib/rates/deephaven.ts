import ratesheet from './deephaven-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import type { Stage1AdjustmentLine } from './shared';

export type DeephavenProgram = 'Equity Advantage' | 'Equity Advantage Elite';
export type DeephavenProduct = '15Y Fixed' | '20Y Fixed' | '30Y Fixed';

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
  withinToleranceAllowOverage: boolean;
}

export interface DeephavenEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type PricingRow = { rate: number; prices: Record<'15Y Fixed' | '30Y Fixed', number | null> };
type ProgramData = {
  minPrice: number;
  maxPriceTiers: Array<{ upToLoanAmount: number; maxPrice: number }>;
  pricing: PricingRow[];
};

type DeephavenData = { programs: Record<'Expanded Prime' | 'Non-Prime', ProgramData> };
const DATA = ratesheet as DeephavenData;
const DEEPHAVEN_PROGRAM_MAP: Record<DeephavenProgram, 'Expanded Prime' | 'Non-Prime'> = {
  'Equity Advantage': 'Expanded Prime',
  'Equity Advantage Elite': 'Non-Prime',
};
const DEEPHAVEN_PROGRAMS: DeephavenProgram[] = ['Equity Advantage', 'Equity Advantage Elite'];

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

function sourceProgram(program: DeephavenProgram): 'Expanded Prime' | 'Non-Prime' {
  return DEEPHAVEN_PROGRAM_MAP[program];
}

export function calculateDeephavenStage1Quote(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): DeephavenQuote {
  const input = buildDeephavenStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? Math.max(...DEEPHAVEN_PROGRAMS.map(program => calculateMaxAvailableForProgram(input, program))));

  const candidates = DEEPHAVEN_PROGRAMS.flatMap(program => {
    const candidateInput = { ...input, program };
    const maxAvailable = calculateMaxAvailableForProgram(candidateInput, program);
    const maxLtv = calculateMaxLtvForProgram(candidateInput, program);
    if (input.creditScore < minCreditScore(program)) return [];
    if (input.resultingCltv > maxLtv) return [];
    if (selectedLoanAmount > maxAvailable) return [];
    const targetPrice = clampTargetPrice(candidateInput, options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), selectedLoanAmount, program);
    const selected = options?.rateOverride !== undefined
      ? pickExecutionByRate(candidateInput, options.rateOverride, program)
      : pickExecution(candidateInput, targetPrice, program);
    return [{ program, maxAvailable, maxLtv, selected }];
  });

  const fallbackProgram = DEEPHAVEN_PROGRAMS[0];
  const fallbackInput = { ...input, program: fallbackProgram };
  const fallbackTargetPrice = clampTargetPrice(fallbackInput, options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), selectedLoanAmount, fallbackProgram);
  const fallbackSelected = options?.rateOverride !== undefined
    ? pickExecutionByRate(fallbackInput, options.rateOverride, fallbackProgram)
    : pickExecution(fallbackInput, fallbackTargetPrice, fallbackProgram);

  const best = candidates.reduce<(typeof candidates)[number] | null>((winner, candidate) => {
    if (!winner) return candidate;
    if (candidate.selected.purchasePrice > winner.selected.purchasePrice) return candidate;
    if (candidate.selected.purchasePrice === winner.selected.purchasePrice && candidate.selected.rate < winner.selected.rate) return candidate;
    return winner;
  }, null) ?? {
    program: fallbackProgram,
    maxAvailable: calculateMaxAvailableForProgram(fallbackInput, fallbackProgram),
    maxLtv: calculateMaxLtvForProgram(fallbackInput, fallbackProgram),
    selected: fallbackSelected,
  };

  return {
    program: best.program,
    product: input.product,
    maxAvailable: best.maxAvailable,
    maxLtv: best.maxLtv,
    rate: best.selected.rate,
    noteRate: best.selected.rate,
    rateType: 'Fixed',
    monthlyPayment: amortizedPayment(selectedLoanAmount, best.selected.rate, termYears(input.product)),
    basePrice: best.selected.basePrice,
    llpaAdjustment: 0,
    purchasePrice: best.selected.purchasePrice,
    adjustments: [{ label: `Program: ${best.program}`, value: 0 }],
  };
}

export function evaluateDeephavenStage1Eligibility(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct },
  selectedLoanAmount?: number
): DeephavenEligibilityResult {
  const input = buildDeephavenStage1PricingInput(stage1);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const reasons: string[] = [];
  const maxAvailable = Math.max(...DEEPHAVEN_PROGRAMS.map(program => calculateMaxAvailableForProgram({ ...input, program }, program)));
  const maxLtv = Math.max(...DEEPHAVEN_PROGRAMS.map(program => calculateMaxLtvForProgram({ ...input, program }, program)));
  const anyEligible = DEEPHAVEN_PROGRAMS.some(program => {
    const candidateInput = { ...input, program };
    return input.creditScore >= minCreditScore(program)
      && input.resultingCltv <= calculateMaxLtvForProgram(candidateInput, program)
      && requested <= calculateMaxAvailableForProgram(candidateInput, program);
  });

  if (!anyEligible) {
    if (DEEPHAVEN_PROGRAMS.every(program => input.creditScore < minCreditScore(program))) reasons.push('Credit score is below the current supported Deephaven tester range.');
    if (DEEPHAVEN_PROGRAMS.every(program => input.resultingCltv > calculateMaxLtvForProgram({ ...input, program }, program))) reasons.push('Resulting CLTV exceeds the current supported Deephaven tester range.');
    if (requested > maxAvailable) reasons.push('Desired loan amount exceeds the current max available amount.');
  }

  return {
    eligible: anyEligible,
    reasons,
    maxAvailable,
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
    withinToleranceAllowOverage: deltaFromTarget >= -tolerance && deltaFromTarget <= tolerance,
  };
}

function pickExecutionByRate(input: DeephavenPricingInput, requestedRate: number, program = input.program) {
  const rows = DATA.programs[sourceProgram(program)].pricing;
  const productKey = pricingProduct(input.product);
  let best = { rate: rows[0].rate, basePrice: Number(rows[0].prices[productKey] ?? 0), purchasePrice: Number(rows[0].prices[productKey] ?? 0) };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[productKey] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice);
    const delta = Math.abs(row.rate - requestedRate);
    if (delta < bestDelta || (delta === bestDelta && row.rate > best.rate)) {
      best = { rate: row.rate, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickExecution(input: DeephavenPricingInput, targetPrice: number, program = input.program) {
  const rows = DATA.programs[sourceProgram(program)].pricing;
  const productKey = pricingProduct(input.product);
  let bestUnder: { rate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { rate: rows[0].rate, basePrice: Number(rows[0].prices[productKey] ?? 0), purchasePrice: Number(rows[0].prices[productKey] ?? 0) };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[productKey] ?? 0);
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
  return calculateMaxAvailableForProgram(input, input.program);
}

function calculateMaxAvailableForProgram(input: DeephavenPricingInput, program: DeephavenProgram): number {
  return Math.max(0, input.propertyValue * calculateMaxLtvForProgram(input, program) - input.loanBalance);
}

function calculateMaxLtv(input: DeephavenPricingInput): number {
  return calculateMaxLtvForProgram(input, input.program);
}

function calculateMaxLtvForProgram(input: DeephavenPricingInput, program: DeephavenProgram): number {
  if (program === 'Equity Advantage') {
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
  return program === 'Equity Advantage' ? 660 : 620;
}

function clampTargetPrice(input: DeephavenPricingInput, targetPrice: number, selectedLoanAmount: number, program = input.program): number {
  const programData = DATA.programs[sourceProgram(program)];
  let maxPrice = programData.maxPriceTiers[programData.maxPriceTiers.length - 1]?.maxPrice ?? 103;
  for (const tier of programData.maxPriceTiers) {
    if (selectedLoanAmount <= tier.upToLoanAmount) {
      maxPrice = tier.maxPrice;
      break;
    }
  }
  return roundToThree(Math.min(maxPrice, Math.max(programData.minPrice, targetPrice)));
}

function normalizeProgram(value?: string): DeephavenProgram {
  return String(value || '').toLowerCase().includes('elite') ? 'Equity Advantage Elite' : 'Equity Advantage';
}

function pricingProduct(product: DeephavenProduct): '15Y Fixed' | '30Y Fixed' {
  return product === '15Y Fixed' ? '15Y Fixed' : '30Y Fixed';
}

function termYears(product: DeephavenProduct): number {
  return product === '15Y Fixed' ? 15 : product === '20Y Fixed' ? 20 : 30;
}

function normalizeProduct(value?: string): DeephavenProduct {
  const text = String(value || '');
  if (text.includes('15')) return '15Y Fixed';
  if (text.includes('20')) return '20Y Fixed';
  return '30Y Fixed';
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
