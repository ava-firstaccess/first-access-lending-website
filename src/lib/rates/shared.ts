export type Stage1PricingEngine = 'Button' | 'Arc Home' | 'Vista' | 'OSB' | 'NewRez' | 'Verus' | 'Deephaven';

export type Stage1AdjustmentLine = {
  label: string;
  value: number;
};

export type Stage1Eligibility = {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
};

export type Stage1ExecutionQuote = {
  engine: Stage1PricingEngine;
  program: string;
  product: string;
  maxAvailable: number;
  rate: number;
  noteRate: number;
  monthlyPayment: number;
  maxLtv: number;
  purchasePrice: number;
  basePrice: number;
  llpaAdjustment: number;
  adjustments: Stage1AdjustmentLine[];
};

export type Stage1TargetExecutionQuote = Stage1ExecutionQuote & {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
  withinToleranceAllowOverage: boolean;
};

export type Stage1PricingEngineResult = {
  eligibility: Stage1Eligibility;
  quote: Stage1ExecutionQuote;
  targetQuote: Stage1TargetExecutionQuote;
};

export function calculateMaxAvailableFromMaxLtv(propertyValue: number, loanBalance: number, maxLtv: number): number {
  return Math.max(0, propertyValue * maxLtv - loanBalance);
}

export function calculateInterestOnlyMonthlyPayment(loanAmount: number, annualRatePct: number): number {
  if (loanAmount <= 0) return 0;
  return loanAmount * (annualRatePct / 100 / 12);
}

export function calculateAmortizingMonthlyPayment(loanAmount: number, annualRatePct: number, termYears: number): number {
  if (loanAmount <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  const periods = termYears * 12;
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, periods)) / (Math.pow(1 + monthlyRate, periods) - 1);
}
