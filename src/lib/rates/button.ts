import ratesheet from './button-ratesheet.json';

export type ButtonProduct = 'HELOC' | 'CES';
export type ButtonDocType = 'Full Doc' | 'Bank Statement';

export interface ButtonPricingInput {
  product: ButtonProduct;
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
  dti: number | null;
  docType: ButtonDocType;
  selfEmployed: boolean;
  bankStatementMonths: number | null;
}

export interface ButtonPricingAssumptions {
  dti: string;
  docType: string;
  selfEmployed: string;
  bankStatementMonths: string;
}

export interface ButtonStage1Input {
  product?: string;
  propertyState?: string;
  propertyValue?: number;
  loanBalance?: number;
  desiredLoanAmount?: number;
  creditScore?: number;
  occupancy?: string;
  structureType?: string;
  numberOfUnits?: number;
  cashOut?: boolean;
}

export interface ButtonQuote {
  maxAvailable: number;
  rate: number;
  monthlyPayment: number;
  maxLtv: number;
  rateType: string;
  noteRate: number;
  purchasePrice: number;
  llpaAdjustment: number;
  basePrice: number;
}

export interface ButtonTargetRateQuote extends ButtonQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
}

type RateRow = {
  noteRate: number;
  prices: {
    fullDoc: { HELOC: number; CES: number };
    altDoc: { HELOC: number; CES: number | null };
  };
};

type Matrix = Array<Array<number | string | null>>;

const NOTE_RATE_ROWS = ratesheet.noteRates as unknown as RateRow[];
const CLTV_MATRIX = ratesheet.tables.cltv as { rows: string[]; columns: string[]; fullDoc: Matrix; altDoc: Matrix };
const CASH_OUT_TABLE = ratesheet.tables.cashOut as { rows: string[]; columns: Array<string | null>; values: Matrix };

const SECOND_LIEN_MARGIN_TARGETS = [
  { min: 0, max: 100000, backendFee: 0.06 },
  { min: 100000, max: 150000, backendFee: 0.06 },
  { min: 150000, max: 200000, backendFee: 0.05 },
  { min: 200000, max: 250000, backendFee: 0.045 },
  { min: 250000, max: 300000, backendFee: 0.04 },
  { min: 300000, max: 350000, backendFee: 0.035 },
  { min: 350000, max: 400000, backendFee: 0.0325 },
  { min: 400000, max: 450000, backendFee: 0.03 },
  { min: 450000, max: 500000, backendFee: 0.0275 },
  { min: 500000, max: 600000, backendFee: 0.025 },
  { min: 600000, max: 700000, backendFee: 0.02 },
  { min: 700000, max: 800000, backendFee: 0.02 },
  { min: 800000, max: 900000, backendFee: 0.02 },
  { min: 900000, max: 1000000, backendFee: 0.02 },
] as const;

const FICO_BUCKETS = [
  { max: 639, label: 'FICO 620 - 639' },
  { max: 659, label: 'FICO 640 - 659' },
  { max: 679, label: 'FICO 660 - 679' },
  { max: 699, label: 'FICO 680 - 699' },
  { max: 719, label: 'FICO 700 - 719' },
  { max: 739, label: 'FICO 720 - 739' },
  { max: 759, label: 'FICO 740 - 759' },
  { max: 779, label: 'FICO 760 - 779' },
  { max: Number.POSITIVE_INFINITY, label: 'FICO 780+' },
];

const CLTV_BUCKETS = [
  { max: 0.60, label: '<= 60%' },
  { max: 0.65, label: '60.01 - 65%' },
  { max: 0.70, label: '65.01 - 70%' },
  { max: 0.75, label: '70.01 - 75%' },
  { max: 0.80, label: '75.01 - 80%' },
  { max: 0.85, label: '80.01 - 85%' },
  { max: 0.90, label: '85.01 - 90%' },
];

export function buildButtonStage1PricingInput(stage1: ButtonStage1Input): ButtonPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    product: normalizeProduct(stage1.product),
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
    dti: null,
    docType: 'Full Doc',
    selfEmployed: false,
    bankStatementMonths: null,
  };
}

export function getButtonStage1Assumptions(): ButtonPricingAssumptions {
  return {
    dti: 'Not collected in stage 1 yet. Defaulting outside LLPA logic for version 1.',
    docType: 'Defaulting to Full Doc for version 1.',
    selfEmployed: 'Defaulting to false for version 1.',
    bankStatementMonths: 'Not collected in stage 1 yet. Not used in version 1.',
  };
}

export function calculateButtonQuote(
  input: ButtonPricingInput,
  options?: {
    selectedLoanAmount?: number;
    targetPrice?: number;
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): ButtonQuote {
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? maxAvailable);
  const targetPrice = options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);
  const docKey = input.docType === 'Bank Statement' ? 'altDoc' : 'fullDoc';

  const ficoIndex = getFicoBucketIndex(input.creditScore);
  const cltvIndex = getCltvBucketIndex(input.resultingCltv);
  const cltvAdj = getMatrixValue(CLTV_MATRIX[docKey], ficoIndex, cltvIndex);

  const propertyAdj = getPropertyTypeAdjustment(input);
  const cashOutAdj = input.cashOut ? getMatrixValue(CASH_OUT_TABLE.values, 0, cltvIndex) : 0;
  const termAdj = getTermAdjustment(input, options);

  const llpaAdjustment = roundToThree(cltvAdj + propertyAdj + cashOutAdj + termAdj);
  const selected = pickNoteRate(input.product, docKey, llpaAdjustment, targetPrice);

  const monthlyPayment = calculateMonthlyPayment(input.product, selected.noteRate, selected.purchasePrice, selectedLoanAmount, options);

  return {
    maxAvailable,
    rate: selected.noteRate,
    monthlyPayment,
    maxLtv: calculateMaxLtv(input.creditScore, input.occupancy),
    rateType: input.product === 'HELOC' ? 'Variable' : 'Fixed',
    noteRate: selected.noteRate,
    purchasePrice: roundToThree(selected.purchasePrice),
    llpaAdjustment,
    basePrice: selected.basePrice,
  };
}

export function calculateButtonStage1Quote(
  stage1: ButtonStage1Input,
  options?: {
    selectedLoanAmount?: number;
    targetPrice?: number;
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): ButtonQuote {
  return calculateButtonQuote(buildButtonStage1PricingInput(stage1), options);
}

export function getTargetPurchasePriceForLoanAmount(loanAmount: number): number {
  const amount = Math.max(0, loanAmount);
  const match = SECOND_LIEN_MARGIN_TARGETS.find(row => amount >= row.min && amount <= row.max);
  const backendFee = match?.backendFee ?? SECOND_LIEN_MARGIN_TARGETS[SECOND_LIEN_MARGIN_TARGETS.length - 1].backendFee;
  return roundToThree(100 + backendFee * 100);
}

export function solveButtonStage1TargetRate(
  stage1: ButtonStage1Input,
  options: {
    targetPrice: number;
    tolerance?: number;
    selectedLoanAmount?: number;
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): ButtonTargetRateQuote {
  const input = buildButtonStage1PricingInput(stage1);
  const docKey = input.docType === 'Bank Statement' ? 'altDoc' : 'fullDoc';
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);
  const tolerance = options.tolerance ?? 0.125;

  const ficoIndex = getFicoBucketIndex(input.creditScore);
  const cltvIndex = getCltvBucketIndex(input.resultingCltv);
  const cltvAdj = getMatrixValue(CLTV_MATRIX[docKey], ficoIndex, cltvIndex);
  const propertyAdj = getPropertyTypeAdjustment(input);
  const cashOutAdj = input.cashOut ? getMatrixValue(CASH_OUT_TABLE.values, 0, cltvIndex) : 0;
  const termAdj = getTermAdjustment(input, options);
  const llpaAdjustment = roundToThree(cltvAdj + propertyAdj + cashOutAdj + termAdj);

  const selected = pickNoteRateAtOrBelowTarget(input.product, docKey, llpaAdjustment, targetPrice);
  const monthlyPayment = calculateMonthlyPayment(input.product, selected.noteRate, selected.purchasePrice, selectedLoanAmount, options);
  const deltaFromTarget = roundToThree(targetPrice - selected.purchasePrice);

  return {
    maxAvailable: calculateMaxAvailable(input),
    rate: selected.noteRate,
    monthlyPayment,
    maxLtv: calculateMaxLtv(input.creditScore, input.occupancy),
    rateType: input.product === 'HELOC' ? 'Variable' : 'Fixed',
    noteRate: selected.noteRate,
    purchasePrice: roundToThree(selected.purchasePrice),
    llpaAdjustment,
    basePrice: selected.basePrice,
    targetPrice,
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
  };
}

function calculateMaxAvailable(input: ButtonPricingInput): number {
  const maxLtv = calculateMaxLtv(input.creditScore, input.occupancy);
  const maxLoan = input.propertyValue * maxLtv;
  return Math.max(0, maxLoan - input.loanBalance);
}

function calculateMaxLtv(creditScore: number, occupancy: string): number {
  const occupancyValue = normalizeOccupancy(occupancy);
  if (creditScore >= 720) {
    return occupancyValue === 'Primary' ? 0.90 : occupancyValue === 'Second Home' ? 0.85 : 0.80;
  }
  if (creditScore >= 680) {
    return occupancyValue === 'Primary' ? 0.85 : occupancyValue === 'Second Home' ? 0.80 : 0.75;
  }
  if (creditScore >= 640) {
    return occupancyValue === 'Primary' ? 0.80 : occupancyValue === 'Second Home' ? 0.75 : 0.70;
  }
  return occupancyValue === 'Primary' ? 0.70 : occupancyValue === 'Second Home' ? 0.65 : 0.60;
}

function pickNoteRate(
  product: ButtonProduct,
  docKey: 'fullDoc' | 'altDoc',
  llpaAdjustment: number,
  targetPrice: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let best = { noteRate: NOTE_RATE_ROWS[0].noteRate, basePrice: basePriceFor(NOTE_RATE_ROWS[0], product, docKey), purchasePrice: 0 };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of NOTE_RATE_ROWS) {
    const basePrice = basePriceFor(row, product, docKey);
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < bestDelta || (delta === bestDelta && purchasePrice > best.purchasePrice)) {
      best = { noteRate: row.noteRate, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickNoteRateAtOrBelowTarget(
  product: ButtonProduct,
  docKey: 'fullDoc' | 'altDoc',
  llpaAdjustment: number,
  targetPrice: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let bestUnder: { noteRate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { noteRate: NOTE_RATE_ROWS[0].noteRate, basePrice: basePriceFor(NOTE_RATE_ROWS[0], product, docKey), purchasePrice: 0 };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of NOTE_RATE_ROWS) {
    const basePrice = basePriceFor(row, product, docKey);
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);

    if (purchasePrice <= targetPrice) {
      if (!bestUnder || purchasePrice > bestUnder.purchasePrice) {
        bestUnder = { noteRate: row.noteRate, basePrice, purchasePrice };
      }
    }

    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < fallbackDelta || (delta === fallbackDelta && purchasePrice > fallback.purchasePrice)) {
      fallback = { noteRate: row.noteRate, basePrice, purchasePrice };
      fallbackDelta = delta;
    }
  }

  return bestUnder ?? fallback;
}

function basePriceFor(row: RateRow, product: ButtonProduct, docKey: 'fullDoc' | 'altDoc'): number {
  if (product === 'HELOC') {
    return row.prices[docKey].HELOC;
  }
  return row.prices[docKey].CES ?? row.prices.fullDoc.CES;
}

function calculateMonthlyPayment(
  product: ButtonProduct,
  noteRate: number,
  _purchasePrice: number,
  selectedLoanAmount: number,
  options?: {
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): number {
  const monthlyRate = noteRate / 100 / 12;
  if (selectedLoanAmount <= 0) return 0;

  if (product === 'CES') {
    const termYears = options?.cesTermYears ?? 20;
    const n = termYears * 12;
    return roundToNearestDollar(selectedLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
  }

  return roundToNearestDollar(selectedLoanAmount * monthlyRate);
}

function getPropertyTypeAdjustment(input: ButtonPricingInput): number {
  const occupancy = normalizeOccupancy(input.occupancy);
  const propertyType = String(input.structureType || '').toLowerCase();

  let adj = 0;
  if (occupancy === 'Second Home') adj += 0.25;
  if (occupancy === 'Investor') adj += 0.50;
  if (propertyType.includes('condo')) adj += 0.125;
  if (input.unitCount > 1) adj += 0.125;
  return adj;
}

function getTermAdjustment(
  input: ButtonPricingInput,
  options?: {
    helocDrawTermYears?: number;
    helocTotalTermYears?: number;
    cesTermYears?: number;
  }
): number {
  if (input.product === 'HELOC') {
    const drawTerm = options?.helocDrawTermYears ?? 5;
    if (drawTerm <= 3) return -0.5;
    if (drawTerm <= 5) return -0.25;
    return 0;
  }

  const cesTerm = options?.cesTermYears ?? 20;
  if (cesTerm >= 30) return 0.25;
  return 0;
}

function getFicoBucketIndex(score: number): number {
  for (let i = 0; i < FICO_BUCKETS.length; i += 1) {
    if (score <= FICO_BUCKETS[i].max) return i;
  }
  return FICO_BUCKETS.length - 1;
}

function getCltvBucketIndex(cltv: number): number {
  for (let i = 0; i < CLTV_BUCKETS.length; i += 1) {
    if (cltv <= CLTV_BUCKETS[i].max) return i;
  }
  return CLTV_BUCKETS.length - 1;
}

function getMatrixValue(matrix: Matrix, rowIndex: number, colIndex: number): number {
  const row = matrix[rowIndex] || [];
  const value = row[colIndex];
  if (value === null || value === undefined || value === 'n/a') return 0;
  return Number(value) || 0;
}

function normalizeProduct(product?: string): ButtonProduct {
  const value = String(product || '').toUpperCase();
  if (value.includes('HELOC')) return 'HELOC';
  return 'CES';
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
