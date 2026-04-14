import { getBackendFeeForLoanAmount, getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';

const NEWREZ_MAX_PURCHASE_PRICE = 106;
const NEWREZ_TOLERANCE = 0.5;

const NEWREZ_COLUMNS = ['BE15', 'BE30', 'BE45', 'BE60'] as const;
export type NewRezColumn = (typeof NEWREZ_COLUMNS)[number];

const RATE_ROWS = [
  { noteRate: 5.125, prices: { BE15: 97.711, BE30: 97.633, BE45: 97.588, BE60: 97.523 } },
  { noteRate: 5.25, prices: { BE15: 97.992, BE30: 97.914, BE45: 97.869, BE60: 97.804 } },
  { noteRate: 5.375, prices: { BE15: 98.704, BE30: 98.626, BE45: 98.581, BE60: 98.516 } },
  { noteRate: 5.49, prices: { BE15: 99.338, BE30: 99.260, BE45: 99.215, BE60: 99.15 } },
  { noteRate: 5.625, prices: { BE15: 99.394, BE30: 99.316, BE45: 99.271, BE60: 99.206 } },
  { noteRate: 5.75, prices: { BE15: 99.919, BE30: 99.841, BE45: 99.796, BE60: 99.731 } },
  { noteRate: 5.875, prices: { BE15: 100.119, BE30: 100.041, BE45: 99.996, BE60: 99.931 } },
  { noteRate: 5.99, prices: { BE15: 100.801, BE30: 100.723, BE45: 100.678, BE60: 100.613 } },
  { noteRate: 6.125, prices: { BE15: 101.405, BE30: 101.327, BE45: 101.282, BE60: 101.217 } },
  { noteRate: 6.25, prices: { BE15: 101.455, BE30: 101.377, BE45: 101.332, BE60: 101.267 } },
  { noteRate: 6.375, prices: { BE15: 102.135, BE30: 102.057, BE45: 102.012, BE60: 101.947 } },
  { noteRate: 6.49, prices: { BE15: 102.175, BE30: 102.097, BE45: 102.052, BE60: 101.987 } },
  { noteRate: 6.625, prices: { BE15: 102.373, BE30: 102.295, BE45: 102.25, BE60: 102.185 } },
  { noteRate: 6.75, prices: { BE15: 102.479, BE30: 102.401, BE45: 102.356, BE60: 102.291 } },
  { noteRate: 6.875, prices: { BE15: 102.822, BE30: 102.744, BE45: 102.699, BE60: 102.634 } },
  { noteRate: 6.99, prices: { BE15: 102.941, BE30: 102.863, BE45: 102.818, BE60: 102.753 } },
  { noteRate: 7.125, prices: { BE15: 103.114, BE30: 103.036, BE45: 102.991, BE60: 102.926 } },
  { noteRate: 7.25, prices: { BE15: 103.575, BE30: 103.497, BE45: 103.452, BE60: 103.387 } },
  { noteRate: 7.375, prices: { BE15: 104.021, BE30: 103.943, BE45: 103.898, BE60: 103.833 } },
  { noteRate: 7.49, prices: { BE15: 104.046, BE30: 103.968, BE45: 103.923, BE60: 103.858 } },
] as const;

export interface NewRezQuote {
  noteRate: number;
  rate: number;
  basePrice: number;
  llpaAdjustment: number;
  purchasePrice: number;
  selectedColumn: NewRezColumn;
}

export interface NewRezTargetRateQuote extends NewRezQuote {
  targetPrice: number;
  cappedTargetPrice: number;
  tolerance: number;
  backendFee: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
}

export interface NewRezExecutionResult {
  targetPrice: number;
  cappedTargetPrice: number;
  tolerance: number;
  backendFee: number;
  eligible: boolean;
  reasons: string[];
  selectedColumn: NewRezColumn | null;
  noteRate: number | null;
  rate: number | null;
  basePrice: number | null;
  llpaAdjustment: number | null;
  purchasePrice: number | null;
  deltaFromTarget: number | null;
  withinTolerance: boolean;
}

export function calculateNewRezQuote(loanAmount: number, options?: { targetPrice?: number; tolerance?: number }): NewRezExecutionResult {
  const backendFee = getBackendFeeForLoanAmount(loanAmount);
  const targetPrice = roundToThree(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(loanAmount));
  const cappedTargetPrice = Math.min(targetPrice, NEWREZ_MAX_PURCHASE_PRICE);
  const tolerance = options?.tolerance ?? NEWREZ_TOLERANCE;

  const candidates: Array<NewRezTargetRateQuote> = [];

  for (const row of RATE_ROWS) {
    for (const column of NEWREZ_COLUMNS) {
      const basePrice = row.prices[column];
      const llpaAdjustment = 0;
      const purchasePrice = roundToThree(basePrice + llpaAdjustment);
      if (purchasePrice > cappedTargetPrice) continue;
      const deltaFromTarget = roundToThree(cappedTargetPrice - purchasePrice);
      if (deltaFromTarget <= tolerance) {
        candidates.push({
          noteRate: row.noteRate,
          rate: row.noteRate,
          basePrice,
          llpaAdjustment,
          purchasePrice,
          selectedColumn: column,
          targetPrice,
          cappedTargetPrice,
          tolerance,
          backendFee,
          deltaFromTarget,
          withinTolerance: true,
        });
      }
    }
  }

  candidates.sort((a, b) => {
    if (a.noteRate !== b.noteRate) return a.noteRate - b.noteRate;
    return b.purchasePrice - a.purchasePrice;
  });

  const best = candidates[0];
  if (!best) {
    return {
      targetPrice,
      cappedTargetPrice,
      tolerance,
      backendFee,
      eligible: false,
      reasons: [`No NewRez execution is within ${tolerance.toFixed(3)} of the target purchase price without going over.`],
      selectedColumn: null,
      noteRate: null,
      rate: null,
      basePrice: null,
      llpaAdjustment: null,
      purchasePrice: null,
      deltaFromTarget: null,
      withinTolerance: false,
    };
  }

  return {
    ...best,
    eligible: true,
    reasons: [],
  };
}

export function calculateNewRezExecution(loanAmount: number): NewRezExecutionResult {
  return calculateNewRezQuote(loanAmount);
}

export function solveNewRezStage1TargetRate(
  stage1: ButtonStage1Input,
  options?: { targetPrice?: number; tolerance?: number; selectedLoanAmount?: number }
): NewRezExecutionResult {
  const loanAmount = Math.max(0, options?.selectedLoanAmount ?? Number(stage1.desiredLoanAmount || 0));
  return calculateNewRezQuote(loanAmount, options);
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}
