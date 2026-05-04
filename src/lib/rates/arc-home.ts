import ratesheet from './arc-home-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount } from './button';
import {
  calculateAmortizingMonthlyPayment,
  calculateMaxAvailableFromMaxLtv,
  type Stage1AdjustmentLine,
} from './shared';

export type ArcHomeProduct = '10 Year Maturity' | '15 Year Maturity' | '20 Year Maturity' | '30 Year Maturity';
export type ArcHomeLockPeriod = 15 | 30 | 45 | 60 | 75 | 90;

export interface ArcHomePricingInput {
  product: ArcHomeProduct;
  propertyState: string;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  dti: number | null;
  occupancy: string;
  structureType: string;
  unitCount: number;
  lockPeriodDays: ArcHomeLockPeriod;
}

export interface ArcHomeQuote {
  program: 'Arc Home';
  product: ArcHomeProduct;
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

export interface ArcHomeTargetRateQuote extends ArcHomeQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
  withinToleranceAllowOverage: boolean;
}

export interface ArcHomeEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type PriceRow = { noteRate: number; prices: Record<'15 Day' | '30 Day' | '45 Day' | '60 Day' | '75 Day' | '90 Day', number | null> };
type AdjustmentRow = { label: string; values: Array<number | null> };
type MaxPriceRow = { term: ArcHomeProduct; withCondition: number | null; allElse: number | null };
type ArcHomeData = {
  sourceWorkbook: string;
  sheet: string;
  title?: string;
  section?: string;
  priceCode: string;
  products: ArcHomeProduct[];
  lockPeriods: ArcHomeLockPeriod[];
  pricing: { rows: PriceRow[] };
  adjustments: {
    term: Array<{ label: string; value: number | null }>;
    cltvBuckets: string[];
    fico: AdjustmentRow[];
    loanAmount: AdjustmentRow[];
    occupancy: AdjustmentRow[];
    dti: AdjustmentRow[];
    propertyType: AdjustmentRow[];
    maxPrice: { conditionLabel: string; rows: MaxPriceRow[] };
  };
};

const DATA = ratesheet as ArcHomeData;
const LOCK_PERIOD_COLUMNS: Record<ArcHomeLockPeriod, keyof PriceRow['prices']> = {
  15: '15 Day',
  30: '30 Day',
  45: '45 Day',
  60: '60 Day',
  75: '75 Day',
  90: '90 Day',
};

export function getArcHomeGuideMaxPrice(product: ArcHomeProduct): number {
  const row = DATA.adjustments.maxPrice.rows.find(entry => entry.term === product);
  return Number(row?.allElse ?? 0);
}

const CLTV_BUCKETS = [55, 60, 65, 70, 75, 80] as const;
const TERM_TO_YEARS: Record<ArcHomeProduct, number> = {
  '10 Year Maturity': 10,
  '15 Year Maturity': 15,
  '20 Year Maturity': 20,
  '30 Year Maturity': 30,
};

export function buildArcHomeStage1PricingInput(stage1: {
  arcHomeProduct?: ArcHomeProduct;
  arcHomeLockPeriodDays?: ArcHomeLockPeriod;
  propertyState?: string;
  propertyValue?: number;
  loanBalance?: number;
  desiredLoanAmount?: number;
  creditScore?: number;
  dti?: number;
  occupancy?: string;
  structureType?: string;
  numberOfUnits?: number;
}): ArcHomePricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    product: normalizeProduct(stage1.arcHomeProduct),
    propertyState: String(stage1.propertyState || '').trim().toUpperCase(),
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    dti: Number.isFinite(Number(stage1.dti)) ? Number(stage1.dti) : null,
    occupancy: normalizeOccupancy(stage1.occupancy),
    structureType: normalizePropertyType(stage1.structureType, Number(stage1.numberOfUnits || 1)),
    unitCount: Number(stage1.numberOfUnits || 1),
    lockPeriodDays: stage1.arcHomeLockPeriodDays ?? 45,
  };
}

export function calculateArcHomeStage1Quote(
  stage1: {
    arcHomeProduct?: ArcHomeProduct;
    arcHomeLockPeriodDays?: ArcHomeLockPeriod;
    propertyState?: string;
    propertyValue?: number;
    loanBalance?: number;
    desiredLoanAmount?: number;
    creditScore?: number;
    dti?: number;
    occupancy?: string;
    structureType?: string;
    numberOfUnits?: number;
  },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): ArcHomeQuote {
  const input = buildArcHomeStage1PricingInput(stage1);
  const maxAvailable = calculateMaxAvailable(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const targetPrice = clampTargetPrice(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount));

  const eligibility = evaluateArcHomeStage1Eligibility(stage1, selectedLoanAmount);
  if (!eligibility.eligible) {
    return {
      program: 'Arc Home',
      product: input.product,
      maxAvailable,
      maxLtv: getArcHomeMaxLtv(),
      rate: 0,
      noteRate: 0,
      rateType: 'Fixed',
      monthlyPayment: 0,
      basePrice: 0,
      llpaAdjustment: 0,
      purchasePrice: 0,
      adjustments: [],
    };
  }

  const baseAdjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(baseAdjustments.reduce((sum, row) => sum + row.value, 0));
  const maxPrice = getMaxPriceCap(input.product);
  const effectiveTargetPrice = Math.min(targetPrice, maxPrice);
  const selected = options?.rateOverride !== undefined
    ? pickExecutionByRate(input, options.rateOverride, llpaAdjustment)
    : pickExecutionAtOrBelowTarget(input, effectiveTargetPrice, llpaAdjustment);
  const lockPeriodAdjustment = getLockPeriodDisplayAdjustment(input.lockPeriodDays, selected.noteRate);
  const adjustments = [{ label: `Lock Period: ${input.lockPeriodDays} Day`, value: lockPeriodAdjustment }, ...baseAdjustments];

  return {
    program: 'Arc Home',
    product: input.product,
    maxAvailable,
    maxLtv: getArcHomeMaxLtv(),
    rate: selected.noteRate,
    noteRate: selected.noteRate,
    rateType: 'Fixed',
    monthlyPayment: calculateMonthlyPayment(selectedLoanAmount, selected.noteRate, input.product),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: roundToThree(selected.purchasePrice),
    adjustments,
  };
}

export function evaluateArcHomeStage1Eligibility(
  stage1: {
    arcHomeProduct?: ArcHomeProduct;
    arcHomeLockPeriodDays?: ArcHomeLockPeriod;
    propertyState?: string;
    propertyValue?: number;
    loanBalance?: number;
    desiredLoanAmount?: number;
    creditScore?: number;
    dti?: number;
    occupancy?: string;
    structureType?: string;
    numberOfUnits?: number;
  },
  selectedLoanAmount?: number
): ArcHomeEligibilityResult {
  const input = buildArcHomeStage1PricingInput(stage1);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const reasons: string[] = [];
  const maxAvailable = calculateMaxAvailable(input);

  if (!DATA.products.includes(input.product)) {
    reasons.push('Arc Home product selection is not supported by the current workbook-backed engine.');
  }
  if (input.creditScore < 640) {
    reasons.push('Credit score is below the current supported Arc Home pricing range.');
  }
  if (input.resultingCltv > getArcHomeMaxLtv()) {
    reasons.push(`Resulting CLTV exceeds the current Arc Home max of ${(getArcHomeMaxLtv() * 100).toFixed(0)}%.`);
  }
  if (input.dti !== null && input.dti > 50) {
    reasons.push('DTI exceeds the current supported Arc Home pricing range.');
  }
  if (requested > maxAvailable) {
    reasons.push('Desired loan amount exceeds the current max available amount.');
  }
  if (getPricingRow(input.lockPeriodDays) === null) {
    reasons.push(`Arc Home does not support ${input.lockPeriodDays} day lock pricing in the workbook.`);
  }
  if (getFicoBucketIndex(input.creditScore) < 0) {
    reasons.push('Credit score is below the current supported Arc Home matrix.');
  }
  if (getCltvBucketIndex(input.resultingCltv) < 0) {
    reasons.push('Resulting CLTV exceeds the current supported Arc Home matrix.');
  }

  const ficoIndex = getFicoBucketIndex(input.creditScore);
  const cltvIndex = getCltvBucketIndex(input.resultingCltv);
  const ficoLabel = getFicoLabel(input.creditScore);
  if (ficoIndex >= 0 && cltvIndex >= 0 && getAdjustmentValue(DATA.adjustments.fico, ficoLabel, cltvIndex) === null) {
    reasons.push('Selected credit / CLTV combination is not available in the Arc Home matrix.');
  }
  if (cltvIndex >= 0 && getAdjustmentValue(DATA.adjustments.loanAmount, getLoanAmountLabel(selectedLoanAmount ?? input.desiredLoanAmount), cltvIndex) === null) {
    reasons.push('Selected loan amount / CLTV combination is not available in the Arc Home matrix.');
  }
  if (cltvIndex >= 0 && getAdjustmentValue(DATA.adjustments.occupancy, normalizeOccupancy(input.occupancy), cltvIndex) === null) {
    reasons.push('Selected occupancy is not available at this CLTV in the Arc Home matrix.');
  }
  if (cltvIndex >= 0 && getAdjustmentValue(DATA.adjustments.propertyType, normalizePropertyType(input.structureType, input.unitCount), cltvIndex) === null) {
    reasons.push('Selected property type is not available at this CLTV in the Arc Home matrix.');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
    resultingCltv: input.resultingCltv,
  };
}

export function solveArcHomeStage1TargetRate(
  stage1: {
    arcHomeProduct?: ArcHomeProduct;
    arcHomeLockPeriodDays?: ArcHomeLockPeriod;
    propertyState?: string;
    propertyValue?: number;
    loanBalance?: number;
    desiredLoanAmount?: number;
    creditScore?: number;
    dti?: number;
    occupancy?: string;
    structureType?: string;
    numberOfUnits?: number;
  },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): ArcHomeTargetRateQuote {
  const input = buildArcHomeStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const targetPrice = clampTargetPrice(options.targetPrice);
  const quote = calculateArcHomeStage1Quote(stage1, { selectedLoanAmount, targetPrice });
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

function pickExecutionByRate(input: ArcHomePricingInput, requestedRate: number, llpaAdjustment: number) {
  const rows = getPricingRows();
  let best = { noteRate: rows[0]?.noteRate ?? 0, basePrice: 0, purchasePrice: 0 };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = getBasePrice(row, input.lockPeriodDays);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = Math.abs(row.noteRate - requestedRate);
    if (delta < bestDelta || (delta === bestDelta && row.noteRate > best.noteRate)) {
      best = { noteRate: row.noteRate, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickExecutionAtOrBelowTarget(input: ArcHomePricingInput, targetPrice: number, llpaAdjustment: number) {
  const rows = getPricingRows();
  let bestUnder: { noteRate: number; basePrice: number; purchasePrice: number } | null = null;
  let bestClosest: { noteRate: number; basePrice: number; purchasePrice: number } | null = null;
  let closestDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = getBasePrice(row, input.lockPeriodDays);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = targetPrice - purchasePrice;
    if (purchasePrice <= targetPrice + 0.0001) {
      if (!bestUnder || purchasePrice > bestUnder.purchasePrice || (purchasePrice === bestUnder.purchasePrice && row.noteRate > bestUnder.noteRate)) {
        bestUnder = { noteRate: row.noteRate, basePrice, purchasePrice };
      }
    }
    const absDelta = Math.abs(delta);
    if (absDelta < closestDelta || (absDelta === closestDelta && row.noteRate > (bestClosest?.noteRate ?? 0))) {
      bestClosest = { noteRate: row.noteRate, basePrice, purchasePrice };
      closestDelta = absDelta;
    }
  }

  return bestUnder ?? bestClosest ?? { noteRate: 0, basePrice: 0, purchasePrice: 0 };
}

function buildAdjustmentLines(input: ArcHomePricingInput, selectedLoanAmount: number): Stage1AdjustmentLine[] {
  const cltvIndex = getCltvBucketIndex(input.resultingCltv);
  if (cltvIndex < 0) return [];
  const adjustments: Stage1AdjustmentLine[] = [{ label: `Lock Period: ${input.lockPeriodDays} Day`, value: 0 }];

  const termAdjustment = getTermAdjustment(input.product);
  if (termAdjustment !== 0) adjustments.push({ label: `Term: ${input.product}`, value: termAdjustment });

  const ficoAdj = getAdjustmentValue(DATA.adjustments.fico, getFicoLabel(input.creditScore), cltvIndex);
  if (ficoAdj !== null) adjustments.push({ label: `FICO / CLTV: ${getFicoLabel(input.creditScore)} / ${DATA.adjustments.cltvBuckets[cltvIndex] ?? ''}`, value: ficoAdj });

  const loanAmountAdj = getAdjustmentValue(DATA.adjustments.loanAmount, getLoanAmountLabel(selectedLoanAmount), cltvIndex);
  if (loanAmountAdj !== null) adjustments.push({ label: `Loan Amount / CLTV: ${getLoanAmountLabel(selectedLoanAmount)} / ${DATA.adjustments.cltvBuckets[cltvIndex] ?? ''}`, value: loanAmountAdj });

  const occupancyAdj = getAdjustmentValue(DATA.adjustments.occupancy, normalizeOccupancy(input.occupancy), cltvIndex);
  if (occupancyAdj !== null) adjustments.push({ label: `Occupancy / CLTV: ${normalizeOccupancy(input.occupancy)} / ${DATA.adjustments.cltvBuckets[cltvIndex] ?? ''}`, value: occupancyAdj });

  const dtiLabel = input.dti !== null ? getDtiLabel(input.dti) : null;
  const dtiAdj = dtiLabel ? getAdjustmentValue(DATA.adjustments.dti, dtiLabel, cltvIndex) : null;
  if (dtiLabel && dtiAdj !== null) adjustments.push({ label: `DTI / CLTV: ${dtiLabel} / ${DATA.adjustments.cltvBuckets[cltvIndex] ?? ''}`, value: dtiAdj });

  const propertyAdj = getAdjustmentValue(DATA.adjustments.propertyType, normalizePropertyType(input.structureType, input.unitCount), cltvIndex);
  if (propertyAdj !== null) adjustments.push({ label: `Property / CLTV: ${normalizePropertyType(input.structureType, input.unitCount)} / ${DATA.adjustments.cltvBuckets[cltvIndex] ?? ''}`, value: propertyAdj });

  return adjustments.filter(row => row.value !== 0);
}

function getPricingRows(): PriceRow[] {
  return DATA.pricing.rows;
}

function getPricingRow(lockPeriodDays: ArcHomeLockPeriod): PriceRow | null {
  if (!DATA.lockPeriods.includes(lockPeriodDays)) return null;
  const rows = getPricingRows();
  return rows.length > 0 ? rows[0] : null;
}

function getPriceRowByNoteRate(noteRate: number): PriceRow | null {
  return getPricingRows().find(row => Math.abs(row.noteRate - noteRate) < 0.0001) ?? null;
}

function getBasePrice(row: PriceRow, lockPeriodDays: ArcHomeLockPeriod): number {
  return Number(row.prices[LOCK_PERIOD_COLUMNS[lockPeriodDays]] ?? 0);
}

function getLockPeriodDisplayAdjustment(lockPeriodDays: ArcHomeLockPeriod, noteRate: number): number {
  const row = getPriceRowByNoteRate(noteRate);
  if (!row) return 0;
  const selected = getBasePrice(row, lockPeriodDays);
  const benchmark = getBasePrice(row, 45);
  return roundToThree(selected - benchmark);
}

function getMaxPriceCap(product: ArcHomeProduct): number {
  const row = DATA.adjustments.maxPrice.rows.find(entry => entry.term === product);
  return Number(row?.allElse ?? 0);
}

function calculateMaxAvailable(input: ArcHomePricingInput): number {
  const byCltv = calculateMaxAvailableFromMaxLtv(input.propertyValue, input.loanBalance, getArcHomeMaxLtv());
  return Math.min(getArcHomeMaxLoanAmount(), roundToThree(byCltv));
}

function calculateMonthlyPayment(loanAmount: number, noteRate: number, product: ArcHomeProduct): number {
  if (loanAmount <= 0) return 0;
  const termYears = getProductTermYears(product);
  if (noteRate === 0) return roundToNearestDollar(loanAmount / (termYears * 12));
  return roundToNearestDollar(calculateAmortizingMonthlyPayment(loanAmount, noteRate, termYears));
}

function roundToThree(value: number) {
  return Number(value.toFixed(3));
}

function roundToNearestDollar(value: number) {
  return Math.round(value);
}

function clampTargetPrice(targetPrice: number) {
  return Math.min(targetPrice, Math.max(...DATA.adjustments.maxPrice.rows.map(row => Number(row.allElse ?? 0))));
}

function getArcHomeMaxLtv(): number {
  const lastBucket = DATA.adjustments.cltvBuckets.at(-1);
  return getUpperBoundFromLabel(lastBucket) / 100;
}

function getArcHomeMaxLoanAmount(): number {
  return Math.max(...DATA.adjustments.loanAmount.map(row => getUpperBoundFromLabel(row.label)));
}

function getCltvBucketIndex(cltv: number) {
  if (!Number.isFinite(cltv) || cltv <= 0) return -1;
  const cltvPct = cltv * 100;
  return DATA.adjustments.cltvBuckets.findIndex(label => cltvPct <= getUpperBoundFromLabel(label));
}

function getFicoBucketIndex(creditScore: number) {
  return DATA.adjustments.fico.findIndex(row => isScoreInLabel(creditScore, row.label));
}

function getFicoLabel(creditScore: number) {
  return DATA.adjustments.fico.find(row => isScoreInLabel(creditScore, row.label))?.label ?? 'Unknown';
}

function getDtiLabel(dti: number) {
  return DATA.adjustments.dti.find(row => isValueInLabel(dti, row.label))?.label ?? null;
}

function getLoanAmountLabel(loanAmount: number) {
  return DATA.adjustments.loanAmount.find(row => isValueInLabel(loanAmount, row.label))?.label ?? DATA.adjustments.loanAmount.at(-1)?.label ?? 'Unknown';
}

function normalizeProduct(product?: ArcHomeProduct) {
  return (product && DATA.products.includes(product)) ? product : (DATA.products.includes('30 Year Maturity') ? '30 Year Maturity' : DATA.products[0]);
}

function normalizeOccupancy(value?: string) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('second')) return 'Second Home';
  if (text.includes('invest')) return 'Investment';
  return 'Primary';
}

function normalizePropertyType(value?: string, unitCount = 1) {
  const text = String(value || '').trim().toLowerCase();
  if (unitCount > 1 || text.includes('2-4') || text.includes('2 to 4') || text.includes('multi')) return '2-4 Units';
  if (text.includes('condo')) return 'Condo';
  if (text.includes('pud')) return 'PUD';
  return 'Single Family';
}

function getTermAdjustment(product: ArcHomeProduct) {
  const row = DATA.adjustments.term.find(entry => entry.label === product);
  return Number(row?.value ?? 0);
}

function getProductTermYears(product: ArcHomeProduct): number {
  const match = String(product).match(/(\d+)/);
  return match ? Number(match[1]) : 30;
}

function getUpperBoundFromLabel(label?: string): number {
  const normalized = String(label ?? '').replace(/,/g, '').trim();
  const lteMatch = normalized.match(/^<=\s*(\d+(?:\.\d+)?)/);
  if (lteMatch) return Number(lteMatch[1]);
  const rangeMatch = normalized.match(/to\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch) return Number(rangeMatch[1]);
  const plusMatch = normalized.match(/(\d+(?:\.\d+)?)\+$/);
  if (plusMatch) return Number.POSITIVE_INFINITY;
  return Number.POSITIVE_INFINITY;
}

function isScoreInLabel(score: number, label?: string): boolean {
  const normalized = String(label ?? '').trim();
  const plusMatch = normalized.match(/^(\d+)\+$/);
  if (plusMatch) return score >= Number(plusMatch[1]);
  const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) return score >= Number(rangeMatch[1]) && score <= Number(rangeMatch[2]);
  return false;
}

function isValueInLabel(value: number, label?: string): boolean {
  const normalized = String(label ?? '').replace(/,/g, '').trim();
  const lteMatch = normalized.match(/^<=\s*(\d+(?:\.\d+)?)/);
  if (lteMatch) return value <= Number(lteMatch[1]);
  const gtRangeMatch = normalized.match(/^>(\d+(?:\.\d+)?)\s*to\s*(\d+(?:\.\d+)?)/i);
  if (gtRangeMatch) return value > Number(gtRangeMatch[1]) && value <= Number(gtRangeMatch[2]);
  return false;
}

function getAdjustmentValue(rows: AdjustmentRow[], label: string, cltvIndex: number) {
  const row = rows.find(entry => entry.label === label);
  if (!row) return null;
  const value = row.values[cltvIndex];
  return value === undefined ? null : value;
}
