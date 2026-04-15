export type Stage1PricingEngine = 'Button' | 'Vista' | 'OSB' | 'NewRez' | 'Verus' | 'Deephaven';

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
};

export type Stage1PricingEngineResult = {
  eligibility: Stage1Eligibility;
  quote: Stage1ExecutionQuote;
  targetQuote: Stage1TargetExecutionQuote;
};
