import ratesheet from './deephaven-ratesheet.json';
import { STAGE1_INVESTOR_OVERLAYS } from '../stage1-pricing/config';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import {
  calculateAmortizingMonthlyPayment,
  calculateMaxAvailableFromMaxLtv,
  type Stage1AdjustmentLine,
} from './shared';

export type DeephavenProgram = 'Equity Advantage' | 'Equity Advantage Elite';
export type DeephavenProduct = '15Y Fixed' | '20Y Fixed' | '30Y Fixed';
export type DeephavenDocType = 'Full Doc' | 'Bank Statement' | 'P&L Only';

export interface DeephavenPricingInput {
  program: DeephavenProgram;
  product: DeephavenProduct;
  docType: DeephavenDocType;
  lockPeriodDays: 45 | 60;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  dti: number | null;
  occupancy: string;
  propertyType: string;
  propertyState: string;
}

export const DEEPHAVEN_COMBINED_PROGRAM_LABEL = 'Equity Advantage / Elite' as const;

export interface DeephavenQuote {
  program: DeephavenProgram | typeof DEEPHAVEN_COMBINED_PROGRAM_LABEL;
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
type AdjustmentRow = { label: string; values: Array<number | null> };
type ProgramData = {
  minPrice: number;
  maxPriceTiers: Array<{ upToLoanAmount: number; maxPrice: number }>;
  pricing: PricingRow[];
  cltvBuckets: Array<number | null>;
  creditAdjustments: AdjustmentRow[];
  lockAdjustments: Array<{ days: number; adjustment: number }>;
  documentationAdjustments?: {
    bankStatement: AdjustmentRow[];
    pnlOnly: AdjustmentRow[];
  };
  adjustments: {
    term: AdjustmentRow[];
    occupancy: AdjustmentRow[];
    loanAmount: AdjustmentRow[];
    propertyType: AdjustmentRow[];
    dti: AdjustmentRow[];
    state: AdjustmentRow[];
  };
};

type DeephavenData = { programs: Record<'Expanded Prime' | 'Non-Prime', ProgramData> };
const DATA = ratesheet as DeephavenData;
const DEEPHAVEN_PROGRAM_MAP: Record<DeephavenProgram, 'Expanded Prime' | 'Non-Prime'> = {
  'Equity Advantage': 'Expanded Prime',
  'Equity Advantage Elite': 'Non-Prime',
};
const DEEPHAVEN_PROGRAMS: DeephavenProgram[] = ['Equity Advantage', 'Equity Advantage Elite'];
const DEEPHAVEN_OVERLAY = STAGE1_INVESTOR_OVERLAYS.Deephaven;

export function getDeephavenGuideMaxPrice(program: DeephavenProgram | typeof DEEPHAVEN_COMBINED_PROGRAM_LABEL, desiredLoanAmount: number): number {
  if (program === DEEPHAVEN_COMBINED_PROGRAM_LABEL) {
    return Math.max(...DEEPHAVEN_PROGRAMS.map(candidate => getDeephavenGuideMaxPrice(candidate, desiredLoanAmount)));
  }
  const source = DATA.programs[sourceProgram(program)];
  const tier = source.maxPriceTiers.find(candidate => desiredLoanAmount <= candidate.upToLoanAmount);
  if (!tier || !Number.isFinite(tier.maxPrice)) {
    throw new Error(`Deephaven guide max price is missing from deephaven-ratesheet.json for ${program} at loan amount ${desiredLoanAmount}.`);
  }
  return tier.maxPrice;
}

export function buildDeephavenStage1PricingInput(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct; deephavenDocType?: DeephavenDocType; deephavenLockPeriodDays?: 15 | 30 }
): DeephavenPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    program: normalizeProgram(stage1.deephavenProgram),
    product: normalizeProduct(stage1.deephavenProduct),
    docType: normalizeDocType(stage1.deephavenDocType),
    lockPeriodDays: normalizeLockPeriodDays(stage1.deephavenLockPeriodDays),
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    dti: Number.isFinite(Number(stage1.dti)) ? Number(stage1.dti) : null,
    occupancy: normalizeOccupancy(stage1.occupancy),
    propertyType: normalizePropertyType(stage1.structureType, Number(stage1.numberOfUnits || 1)),
    propertyState: String(stage1.propertyState || '').trim().toUpperCase(),
  };
}

function sourceProgram(program: DeephavenProgram): 'Expanded Prime' | 'Non-Prime' {
  return DEEPHAVEN_PROGRAM_MAP[program];
}

export function calculateDeephavenStage1Quote(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct; deephavenDocType?: DeephavenDocType; deephavenLockPeriodDays?: 15 | 30 },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): DeephavenQuote {
  const input = buildDeephavenStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? Math.max(...DEEPHAVEN_PROGRAMS.map(program => calculateMaxAvailableForProgram(input, program))));
  const targetPrice = options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount);

  const candidates = DEEPHAVEN_PROGRAMS.flatMap(program => {
    const candidateInput = { ...input, program };
    const maxAvailable = calculateMaxAvailableForProgram(candidateInput, program);
    const maxLtv = calculateMaxLtvForProgram(candidateInput, program);
    if (!programSupportsDocType(program, input.docType)) return [];
    if (input.lockPeriodDays !== 45 && input.lockPeriodDays !== 60) return [];
    if (input.creditScore < minCreditScore(program)) return [];
    if (input.resultingCltv > maxLtv) return [];
    if (selectedLoanAmount > maxAvailable) return [];
    const llpaAdjustment = calculateLlpaAdjustment(candidateInput, selectedLoanAmount, program);
    const selected = options?.rateOverride !== undefined
      ? pickExecutionByRate(candidateInput, options.rateOverride, program, llpaAdjustment)
      : pickExecution(candidateInput, clampTargetPrice(candidateInput, targetPrice, selectedLoanAmount, program), program, llpaAdjustment);
    return [{ program, maxAvailable, maxLtv, llpaAdjustment, selected }];
  });

  const summaryPrograms = getSummaryProgramsForDocType(input.docType);
  const summaryProgramLabel = summaryPrograms.length > 1 ? DEEPHAVEN_COMBINED_PROGRAM_LABEL : (summaryPrograms[0] ?? input.program);
  const summaryMaxLtv = Math.max(...summaryPrograms.map(program => calculateMaxLtvForProgram({ ...input, program }, program)));
  const summaryMaxAvailable = Math.max(...summaryPrograms.map(program => calculateMaxAvailableForProgram({ ...input, program }, program)));

  const preferredCandidates = candidates.filter(candidate => candidate.program === 'Equity Advantage Elite');
  const selectionPool = preferredCandidates.length > 0 ? preferredCandidates : candidates;

  const best = selectionPool.reduce<(typeof selectionPool)[number] | null>((winner, candidate) => {
    if (!winner) return candidate;
    if (candidate.selected.purchasePrice > winner.selected.purchasePrice) return candidate;
    if (candidate.selected.purchasePrice === winner.selected.purchasePrice && candidate.selected.rate < winner.selected.rate) return candidate;
    return winner;
  }, null);

  if (!best) {
    return {
      program: summaryProgramLabel,
      product: input.product,
      maxAvailable: summaryMaxAvailable,
      maxLtv: summaryMaxLtv,
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

  return {
    program: summaryProgramLabel,
    product: input.product,
    maxAvailable: summaryMaxAvailable,
    maxLtv: summaryMaxLtv,
    rate: best.selected.rate,
    noteRate: best.selected.rate,
    rateType: 'Fixed',
    monthlyPayment: amortizedPayment(selectedLoanAmount, best.selected.rate, termYears(input.product)),
    basePrice: best.selected.basePrice,
    llpaAdjustment: best.llpaAdjustment,
    purchasePrice: best.selected.purchasePrice,
    adjustments: buildAdjustmentLines({ ...input, program: best.program }, selectedLoanAmount, best.program),
  };
}

export function evaluateDeephavenStage1Eligibility(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct; deephavenDocType?: DeephavenDocType },
  selectedLoanAmount?: number
): DeephavenEligibilityResult {
  const input = buildDeephavenStage1PricingInput(stage1);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const reasons: string[] = [];
  const maxAvailable = Math.max(...DEEPHAVEN_PROGRAMS.map(program => calculateMaxAvailableForProgram({ ...input, program }, program)));
  const anyEligible = DEEPHAVEN_PROGRAMS.some(program => {
    const candidateInput = { ...input, program };
    return programSupportsDocType(program, input.docType)
      && input.creditScore >= minCreditScore(program)
      && input.resultingCltv <= calculateMaxLtvForProgram(candidateInput, program)
      && requested <= calculateMaxAvailableForProgram(candidateInput, program);
  });

  if (!anyEligible) {
    if (DEEPHAVEN_PROGRAMS.every(program => !programSupportsDocType(program, input.docType))) reasons.push(`Deephaven ${input.docType} pricing is not available in the workbook for ${input.product}.`);
    if (input.lockPeriodDays !== 45 && input.lockPeriodDays !== 60) reasons.push('Deephaven only supports 15 and 30 day lock pads (45 and 60 day actual locks).');
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
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct; deephavenDocType?: DeephavenDocType; deephavenLockPeriodDays?: 15 | 30 },
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

function pickExecutionByRate(input: DeephavenPricingInput, requestedRate: number, program = input.program, llpaAdjustment = 0) {
  const rows = DATA.programs[sourceProgram(program)].pricing;
  const productKey = pricingProduct(input.product);
  let best = { rate: rows[0].rate, basePrice: Number(rows[0].prices[productKey] ?? 0), purchasePrice: roundToThree(Number(rows[0].prices[productKey] ?? 0) + llpaAdjustment) };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[productKey] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
    const delta = Math.abs(row.rate - requestedRate);
    if (delta < bestDelta || (delta === bestDelta && row.rate > best.rate)) {
      best = { rate: row.rate, basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickExecution(input: DeephavenPricingInput, targetPrice: number, program = input.program, llpaAdjustment = 0) {
  const rows = DATA.programs[sourceProgram(program)].pricing;
  const productKey = pricingProduct(input.product);
  let bestUnder: { rate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { rate: rows[0].rate, basePrice: Number(rows[0].prices[productKey] ?? 0), purchasePrice: roundToThree(Number(rows[0].prices[productKey] ?? 0) + llpaAdjustment) };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const basePrice = Number(row.prices[productKey] ?? 0);
    if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
    const purchasePrice = roundToThree(basePrice + llpaAdjustment);
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
  return Math.min(
    DEEPHAVEN_OVERLAY.maxLoanAmount,
    calculateMaxAvailableFromMaxLtv(input.propertyValue, input.loanBalance, calculateMaxLtvForProgram(input, program)),
  );
}

function calculateMaxLtvForProgram(input: DeephavenPricingInput, program: DeephavenProgram): number {
  const programData = DATA.programs[sourceProgram(program)];
  const fullDocRow = findCreditRow(programData.creditAdjustments, input.creditScore);
  if (!fullDocRow) return 0;

  let maxEligibleIndex = lastEligibleIndex(fullDocRow.values);
  if (maxEligibleIndex < 0) return 0;

  if (input.docType === 'Bank Statement') {
    const docRow = findCreditRow(programData.documentationAdjustments?.bankStatement ?? [], input.creditScore);
    if (!docRow) return 0;
    maxEligibleIndex = Math.min(maxEligibleIndex, lastEligibleIndex(docRow.values));
  }

  if (input.docType === 'P&L Only') {
    const docRow = findCreditRow(programData.documentationAdjustments?.pnlOnly ?? [], input.creditScore);
    if (!docRow) return 0;
    maxEligibleIndex = Math.min(maxEligibleIndex, lastEligibleIndex(docRow.values));
  }

  if (maxEligibleIndex < 0) return 0;
  return Number(programData.cltvBuckets[maxEligibleIndex] ?? 0);
}

function minCreditScore(program: DeephavenProgram): number {
  const scores = DATA.programs[sourceProgram(program)].creditAdjustments
    .map(row => parseCreditFloor(row.label))
    .filter((score): score is number => Number.isFinite(score));
  if (scores.length === 0) {
    throw new Error(`Deephaven minimum credit score is missing from deephaven-ratesheet.json for ${program}.`);
  }
  return Math.min(...scores);
}

function clampTargetPrice(input: DeephavenPricingInput, targetPrice: number, selectedLoanAmount: number, program = input.program): number {
  const programData = DATA.programs[sourceProgram(program)];
  const maxPrice = getDeephavenGuideMaxPrice(program, selectedLoanAmount);
  return roundToThree(Math.min(maxPrice, Math.max(programData.minPrice, targetPrice)));
}

function normalizeProgram(value?: string): DeephavenProgram {
  return String(value || '').toLowerCase().includes('elite') ? 'Equity Advantage Elite' : 'Equity Advantage';
}

function normalizeLockPeriodDays(value?: number): 45 | 60 {
  if (value === 15) return 45;
  if (value === 30) return 60;
  throw new Error(`Unsupported Deephaven lock period: ${value ?? ''}`);
}

function pricingProduct(product: DeephavenProduct): '15Y Fixed' | '30Y Fixed' {
  return product === '15Y Fixed' ? '15Y Fixed' : '30Y Fixed';
}

function termYears(product: DeephavenProduct): number {
  if (product === '15Y Fixed') return 15;
  if (product === '20Y Fixed') return 20;
  if (product === '30Y Fixed') return 30;
  throw new Error(`Unsupported Deephaven term product: ${product}`);
}

function normalizeProduct(value?: string): DeephavenProduct {
  const text = String(value || '');
  if (text.includes('15')) return '15Y Fixed';
  if (text.includes('20')) return '20Y Fixed';
  if (text.includes('30')) return '30Y Fixed';
  throw new Error(`Unsupported Deephaven product: ${value ?? ''}`);
}

function normalizeDocType(value?: string): DeephavenDocType {
  const text = String(value || '').toLowerCase();
  if (text.includes('full')) return 'Full Doc';
  if (text.includes('bank')) return 'Bank Statement';
  if (text.includes('p&l') || text.includes('p & l') || text.includes('pnl')) return 'P&L Only';
  throw new Error(`Unsupported Deephaven doc type: ${value ?? ''}`);
}

function programSupportsDocType(program: DeephavenProgram, docType: DeephavenDocType): boolean {
  const programData = DATA.programs[sourceProgram(program)];
  if (docType === 'Full Doc') return true;
  if (docType === 'Bank Statement') return (programData.documentationAdjustments?.bankStatement ?? []).length > 0;
  return (programData.documentationAdjustments?.pnlOnly ?? []).length > 0;
}

function getSummaryProgramsForDocType(docType: DeephavenDocType): DeephavenProgram[] {
  const docCompatiblePrograms = DEEPHAVEN_PROGRAMS.filter(program => programSupportsDocType(program, docType));
  return docCompatiblePrograms.length > 0 ? docCompatiblePrograms : DEEPHAVEN_PROGRAMS;
}

function normalizeOccupancy(value?: string): string {
  const text = String(value || '').toLowerCase();
  if (text.includes('investment')) return 'Investor';
  if (text.includes('second')) return 'Second Home';
  return 'Primary';
}

function normalizePropertyType(value?: string, unitCount = 0): string {
  const text = String(value || '').toLowerCase();
  if (text.includes('non-warrantable')) return 'Non-Warrantable Condo';
  if (text.includes('condo')) return 'Condo';
  if (unitCount >= 2) return '2-4 Units';
  return 'SFR';
}

function calculateLlpaAdjustment(input: DeephavenPricingInput, selectedLoanAmount: number, program = input.program): number {
  return roundToThree(buildAdjustmentLines(input, selectedLoanAmount, program).reduce((sum, line) => sum + line.value, 0));
}

function buildAdjustmentLines(input: DeephavenPricingInput, selectedLoanAmount: number, program = input.program): Stage1AdjustmentLine[] {
  const programData = DATA.programs[sourceProgram(program)];
  const cltvIndex = findCltvBucketIndex(programData.cltvBuckets, input.resultingCltv);
  const lines: Stage1AdjustmentLine[] = [{ label: `Program: ${program}`, value: 0 }];

  pushAdjustment(lines, 'FICO x CLTV', readAdjustmentValue(findCreditRow(programData.creditAdjustments, input.creditScore), cltvIndex));
  if (input.docType === 'Bank Statement') {
    pushAdjustment(lines, 'Doc Type: Bank Statement', readAdjustmentValue(findCreditRow(programData.documentationAdjustments?.bankStatement ?? [], input.creditScore), cltvIndex));
  }
  if (input.docType === 'P&L Only') {
    pushAdjustment(lines, 'Doc Type: P&L Only', readAdjustmentValue(findCreditRow(programData.documentationAdjustments?.pnlOnly ?? [], input.creditScore), cltvIndex));
  }
  pushAdjustment(lines, 'Term', readAdjustmentValue(findByLabel(programData.adjustments.term, termAdjustmentLabel(input.product)), cltvIndex));
  pushAdjustment(lines, 'Occupancy', readAdjustmentValue(findByLabel(programData.adjustments.occupancy, input.occupancy), cltvIndex));
  pushAdjustment(lines, 'Loan Amount', readAdjustmentValue(findLoanAmountRow(programData.adjustments.loanAmount, selectedLoanAmount), cltvIndex));
  pushAdjustment(lines, 'Property Type', readAdjustmentValue(findByLabel(programData.adjustments.propertyType, input.propertyType), cltvIndex));
  const dtiRow = findMatchingDtiRow(programData.adjustments.dti, input.dti);
  if (dtiRow) pushAdjustment(lines, `DTI: ${dtiRow.label}`, readAdjustmentValue(dtiRow, cltvIndex));
  if (input.propertyState === 'FL' || input.propertyState === 'TX') {
    pushAdjustment(lines, 'State (FL / TX)', readAdjustmentValue(programData.adjustments.state[0], cltvIndex));
  }

  pushAdjustment(lines, `Lock Period: ${input.lockPeriodDays} Day`, getLockAdjustment(programData, input.lockPeriodDays));

  return lines;
}

function pushAdjustment(lines: Stage1AdjustmentLine[], label: string, value: number | null) {
  if (value === null || value === 0 || !Number.isFinite(value)) return;
  lines.push({ label, value: roundToThree(value) });
}

function findCltvBucketIndex(buckets: Array<number | null>, cltv: number): number {
  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    if (bucket !== null && cltv <= bucket) return index;
  }
  return buckets.length - 1;
}

function readAdjustmentValue(row: AdjustmentRow | undefined, cltvIndex: number): number | null {
  return row?.values?.[cltvIndex] ?? null;
}

function lastEligibleIndex(values: Array<number | null>): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return index;
  }
  return -1;
}

function findByLabel(rows: AdjustmentRow[], label: string): AdjustmentRow | undefined {
  if (!label) return undefined;
  return rows.find(row => row.label.toLowerCase() === label.toLowerCase());
}

function findCreditRow(rows: AdjustmentRow[], creditScore: number): AdjustmentRow | undefined {
  return rows.find(row => matchesCreditBand(row.label, creditScore));
}

function parseCreditFloor(label: string): number | null {
  const text = label.replace(/\s+/g, ' ').trim();
  if (text.endsWith('+')) return Number(text.replace('+', ''));
  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function matchesCreditBand(label: string, creditScore: number): boolean {
  const text = label.replace(/\s+/g, ' ').trim();
  if (text.endsWith('+')) return creditScore >= Number(text.replace('+', ''));
  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  if (match) return creditScore >= Number(match[1]) && creditScore <= Number(match[2]);
  return false;
}

function termAdjustmentLabel(product: DeephavenProduct): string {
  const targetYears = termYears(product);
  const labels = Object.values(DATA.programs).flatMap(program => program.adjustments.term.map(row => row.label));
  return labels.find(label => Number(label.match(/(\d+)/)?.[1] ?? 0) === targetYears) ?? '';
}

function findLoanAmountRow(rows: AdjustmentRow[], selectedLoanAmount: number): AdjustmentRow | undefined {
  return rows.find(row => matchesLoanAmountBand(row.label, selectedLoanAmount));
}

function parseStrictGreaterThanThreshold(label: string): number {
  const match = label.match(/^\s*(?:DTI\s*)?>\s*(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : Number.NaN;
}

function findMatchingDtiRow(rows: AdjustmentRow[], dti: number | null | undefined): AdjustmentRow | undefined {
  if (!Number.isFinite(dti)) return undefined;
  return rows
    .map(row => ({ row, threshold: parseStrictGreaterThanThreshold(row.label) }))
    .filter((item): item is { row: AdjustmentRow; threshold: number } => Number.isFinite(item.threshold))
    .sort((a, b) => b.threshold - a.threshold)
    .find(item => dti! > item.threshold)?.row;
}

function matchesLoanAmountBand(label: string, selectedLoanAmount: number): boolean {
  const text = label.replace(/,/g, '').trim();
  const lt = text.match(/^<\s*(\d+(?:\.\d+)?)/);
  if (lt) return selectedLoanAmount < Number(lt[1]);
  const gt = text.match(/^>\s*(\d+(?:\.\d+)?)/);
  if (gt) return selectedLoanAmount > Number(gt[1]) && selectedLoanAmount <= DEEPHAVEN_OVERLAY.maxLoanAmount;
  return false;
}

function getLockAdjustment(programData: ProgramData, lockPeriodDays: 45 | 60): number | null {
  const row = programData.lockAdjustments.find(candidate => candidate.days === lockPeriodDays);
  if (!row) {
    throw new Error(`Deephaven lock adjustment is missing from deephaven-ratesheet.json for ${lockPeriodDays} day lock.`);
  }
  return row.adjustment;
}

function amortizedPayment(balance: number, rate: number, years: number): number {
  if (balance <= 0) return 0;
  return roundToNearestDollar(calculateAmortizingMonthlyPayment(balance, rate, years));
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToNearestDollar(value: number): number {
  return Math.round(value);
}
