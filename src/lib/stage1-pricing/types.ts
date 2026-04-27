export type PricingViewEngine = 'BestX' | 'Button' | 'Arc Home' | 'Vista' | 'OSB' | 'NewRez' | 'Verus' | 'Deephaven';

export type VistaProduct = '30yr Fixed' | '20yr Fixed' | '15yr Fixed' | '10yr Fixed';
export type SharedDocType = 'Full Doc' | 'Bank Statement' | '1099' | 'Asset Depletion' | 'P&L Only' | 'WVOE';
export type BestExDocType = SharedDocType | '12 Month Bank Statement' | '24 Month Bank Statement';
export type VistaDocType = SharedDocType;
export type NewRezProduct = '30 Year Fixed' | '20 Year Fixed' | '15 Year Fixed';
export type OsbProgram = 'HELOC' | '2nd Liens';
export type OsbProduct = '20 Year Maturity' | '30 Year Maturity' | 'Fixed 10' | 'Fixed 15' | 'Fixed 20' | 'Fixed 30';
export type OsbLockPeriod = 30 | 45 | 60;
export type VerusProgram = 'CES' | 'HELOC';
export type VerusProduct = '10 YR FIX' | '15 YR FIX' | '20 YR FIX' | '25 YR FIX' | '30 YR FIX' | '15 YR' | '20 YR' | '25 YR' | '30 YR';
export type VerusDocType = 'Standard' | 'Alt Doc';
export type VerusDrawPeriodYears = 2 | 3 | 5;
export type VerusLockPeriodDays = 30 | 45 | 60;
export type DeephavenProgram = 'Equity Advantage' | 'Equity Advantage Elite';
export type DeephavenProduct = '15Y Fixed' | '20Y Fixed' | '30Y Fixed';
export type DeephavenDocType = 'Full Doc' | 'Bank Statement' | 'P&L Only';
export type DeephavenLockPeriodDays = 15 | 30;
export type ArcHomeProduct = '10 Year Maturity' | '15 Year Maturity' | '20 Year Maturity' | '30 Year Maturity';
export type ArcHomeLockPeriodDays = 15 | 30 | 45 | 60 | 75 | 90;
export type ButtonProduct = 'HELOC' | 'CES';
export type ButtonDocType = 'Full Doc' | '12 Month Bank Statement' | '24 Month Bank Statement' | 'Asset Depletion';
export type BestExProduct = 'HELOC' | 'CES';
export type BestExDrawPeriodYears = 3 | 5 | 10;
export type BestExTermYears = 10 | 15 | 20 | 25 | 30;
export type BestExLockPeriodDays = 15 | 30 | 45;
export type PropertyOccupancy = 'Owner-Occupied' | 'Second Home' | 'Investment';
export type StructureType = 'SFR' | 'Condo' | 'Townhome' | 'PUD' | '2-4 Unit';

export type TesterInput = {
  buttonProduct?: ButtonProduct;
  arcHomeProduct?: ArcHomeProduct;
  arcHomeLockPeriodDays?: ArcHomeLockPeriodDays;
  product?: string;
  propertyState?: string;
  propertyValue?: number;
  loanBalance?: number;
  desiredLoanAmount?: number;
  creditScore?: number;
  dti?: number;
  occupancy?: PropertyOccupancy | string;
  structureType?: StructureType | string;
  numberOfUnits?: number;
  cashOut?: boolean;
  buttonTermYears?: 10 | 15 | 20 | 25 | 30;
  buttonDocType?: ButtonDocType;
  vistaProduct?: VistaProduct;
  vistaDocType?: VistaDocType;
  vistaLockPeriodDays?: 30 | 45 | 60;
  newrezProduct?: NewRezProduct;
  newrezLockPeriodDays?: 15 | 30 | 45 | 60;
  osbProgram?: OsbProgram;
  osbProduct?: OsbProduct;
  osbLockPeriodDays?: OsbLockPeriod;
  verusProgram?: VerusProgram;
  verusProduct?: VerusProduct;
  verusDocType?: VerusDocType;
  verusDrawPeriodYears?: VerusDrawPeriodYears;
  verusLockPeriodDays?: VerusLockPeriodDays;
  deephavenProgram?: DeephavenProgram;
  deephavenProduct?: DeephavenProduct;
  deephavenDocType?: DeephavenDocType;
  deephavenLockPeriodDays?: 15 | 30;
  helocDrawTermYears?: 3 | 5 | 10;
  bestExProduct?: BestExProduct;
  bestExDrawPeriodYears?: BestExDrawPeriodYears;
  bestExTermYears?: BestExTermYears;
  bestExLockPeriodDays?: BestExLockPeriodDays;
  bestExDocType?: BestExDocType;
};

export type Stage1PricingEngine = 'Button' | 'Arc Home' | 'Vista' | 'OSB' | 'NewRez' | 'Verus' | 'Deephaven';
export type Stage1AdjustmentLine = { label: string; value: number };
export type Stage1Eligibility = { eligible: boolean; reasons: string[]; maxAvailable: number; resultingCltv: number };
export type Stage1ExecutionQuote = { engine: Stage1PricingEngine; program: string; product: string; maxAvailable: number; rate: number; noteRate: number; monthlyPayment: number; maxLtv: number; purchasePrice: number; basePrice: number; llpaAdjustment: number; adjustments: Stage1AdjustmentLine[] };
export type Stage1TargetExecutionQuote = Stage1ExecutionQuote & { targetPrice: number; tolerance: number; deltaFromTarget: number; withinTolerance: boolean; withinToleranceAllowOverage: boolean };
export type Stage1PricingEngineResult = { eligibility: Stage1Eligibility; quote: Stage1ExecutionQuote; targetQuote: Stage1TargetExecutionQuote; maxPrice: number };

export type InvestorPriceLadderRow = { purchasePrice: number; rate: number; noteRate: number; pointsLabel: 'Discount' | 'Rebate'; pointsValue: number; highlighted: boolean; };
export type InvestorSummary = { investor: string; eligibility: Stage1Eligibility; quote: Stage1ExecutionQuote; discountPoints: number; buyPrice: number; windowMatched: boolean; deltaFromTarget: number; targetPrice: number; maxPrice: number; priceLadder: InvestorPriceLadderRow[] };

export type Stage1PricingRequest = { engine: PricingViewEngine; input: TesterInput; targetPriceOverride?: string; manualRateOverride?: string; tolerance?: number };
export type Stage1PricingResponse = { defaultBackendTargetPrice: number; effectiveTargetPrice: number; activeResult: Stage1PricingEngineResult | null; results: InvestorSummary[] };

export const defaultInput: TesterInput = {
  buttonProduct: 'HELOC',
  arcHomeProduct: '30 Year Maturity',
  arcHomeLockPeriodDays: 45,
  vistaProduct: '30yr Fixed',
  vistaDocType: 'Full Doc',
  vistaLockPeriodDays: 45,
  newrezProduct: '30 Year Fixed',
  newrezLockPeriodDays: 30,
  osbProgram: 'HELOC',
  osbProduct: '30 Year Maturity',
  osbLockPeriodDays: 45,
  verusProgram: 'CES',
  verusProduct: '30 YR FIX',
  verusDocType: 'Standard',
  verusDrawPeriodYears: 5,
  verusLockPeriodDays: 45,
  deephavenProgram: 'Equity Advantage',
  deephavenProduct: '30Y Fixed',
  deephavenDocType: 'Full Doc',
  deephavenLockPeriodDays: 30,
  helocDrawTermYears: 5,
  buttonTermYears: 20,
  buttonDocType: 'Full Doc',
  bestExProduct: 'HELOC',
  bestExDrawPeriodYears: 5,
  bestExTermYears: 30,
  bestExLockPeriodDays: 30,
  bestExDocType: 'Full Doc',
  propertyState: 'CA',
  propertyValue: 750000,
  loanBalance: 250000,
  desiredLoanAmount: 100000,
  creditScore: 740,
  dti: 35,
  occupancy: 'Owner-Occupied',
  structureType: 'SFR',
  numberOfUnits: 1,
  cashOut: true,
};
