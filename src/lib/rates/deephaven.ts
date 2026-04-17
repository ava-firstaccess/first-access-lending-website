import ratesheet from './deephaven-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import type { Stage1AdjustmentLine } from './shared';

export type DeephavenProgram = 'Equity Advantage' | 'Equity Advantage Elite';
export type DeephavenProduct = '15Y Fixed' | '20Y Fixed' | '30Y Fixed';
export type DeephavenDocType = 'Full Doc' | 'Bank Statement' | 'P&L Only';

export interface DeephavenPricingInput {
  program: DeephavenProgram;
  product: DeephavenProduct;
  docType: DeephavenDocType;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  occupancy: string;
  propertyType: string;
  propertyState: string;
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
type AdjustmentRow = { label: string; values: Array<number | null> };
type ProgramData = {
  minPrice: number;
  maxPriceTiers: Array<{ upToLoanAmount: number; maxPrice: number }>;
  pricing: PricingRow[];
  cltvBuckets: Array<number | null>;
  creditAdjustments: AdjustmentRow[];
  documentationAdjustments?: {
    bankStatement: AdjustmentRow[];
    pnlOnly: AdjustmentRow[];
  };
  adjustments: {
    term: AdjustmentRow[];
    occupancy: AdjustmentRow[];
    loanAmount: AdjustmentRow[];
    propertyType: AdjustmentRow[];
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

export function buildDeephavenStage1PricingInput(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct; deephavenDocType?: DeephavenDocType }
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
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    occupancy: normalizeOccupancy(stage1.occupancy),
    propertyType: normalizePropertyType(stage1.structureType, Number(stage1.numberOfUnits || 1)),
    propertyState: String(stage1.propertyState || '').trim().toUpperCase(),
  };
}

function sourceProgram(program: DeephavenProgram): 'Expanded Prime' | 'Non-Prime' {
  return DEEPHAVEN_PROGRAM_MAP[program];
}

export function calculateDeephavenStage1Quote(
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct; deephavenDocType?: DeephavenDocType },
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
    if (!programSupportsDocType(program, input.docType, input.product)) return [];
    const llpaAdjustment = calculateLlpaAdjustment(candidateInput, selectedLoanAmount, program);
    const targetPrice = clampTargetPrice(candidateInput, options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), selectedLoanAmount, program);
    const selected = options?.rateOverride !== undefined
      ? pickExecutionByRate(candidateInput, options.rateOverride, program, llpaAdjustment)
      : pickExecution(candidateInput, targetPrice, program, llpaAdjustment);
    return [{ program, maxAvailable, maxLtv, llpaAdjustment, selected }];
  });

  const fallbackProgram = DEEPHAVEN_PROGRAMS[0];
  const fallbackInput = { ...input, program: fallbackProgram };
  const fallbackLlpaAdjustment = calculateLlpaAdjustment(fallbackInput, selectedLoanAmount, fallbackProgram);
  const fallbackTargetPrice = clampTargetPrice(fallbackInput, options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), selectedLoanAmount, fallbackProgram);
  const fallbackSelected = options?.rateOverride !== undefined
    ? pickExecutionByRate(fallbackInput, options.rateOverride, fallbackProgram, fallbackLlpaAdjustment)
    : pickExecution(fallbackInput, fallbackTargetPrice, fallbackProgram, fallbackLlpaAdjustment);

  const best = candidates.reduce<(typeof candidates)[number] | null>((winner, candidate) => {
    if (!winner) return candidate;
    if (candidate.selected.purchasePrice > winner.selected.purchasePrice) return candidate;
    if (candidate.selected.purchasePrice === winner.selected.purchasePrice && candidate.selected.rate < winner.selected.rate) return candidate;
    return winner;
  }, null) ?? {
    program: fallbackProgram,
    maxAvailable: calculateMaxAvailableForProgram(fallbackInput, fallbackProgram),
    maxLtv: calculateMaxLtvForProgram(fallbackInput, fallbackProgram),
    llpaAdjustment: fallbackLlpaAdjustment,
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
    return programSupportsDocType(program, input.docType, input.product)
      && input.creditScore >= minCreditScore(program)
      && input.resultingCltv <= calculateMaxLtvForProgram(candidateInput, program)
      && requested <= calculateMaxAvailableForProgram(candidateInput, program);
  });

  if (!anyEligible) {
    if (DEEPHAVEN_PROGRAMS.every(program => !programSupportsDocType(program, input.docType, input.product))) reasons.push(`Deephaven ${input.docType} pricing is not available in the workbook for ${input.product}.`);
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
  stage1: ButtonStage1Input & { deephavenProgram?: DeephavenProgram; deephavenProduct?: DeephavenProduct; deephavenDocType?: DeephavenDocType },
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
  return Math.max(0, input.propertyValue * calculateMaxLtvForProgram(input, program) - input.loanBalance);
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

function normalizeDocType(value?: string): DeephavenDocType {
  const text = String(value || '').toLowerCase();
  if (text.includes('bank')) return 'Bank Statement';
  if (text.includes('p&l') || text.includes('p & l') || text.includes('pnl')) return 'P&L Only';
  return 'Full Doc';
}

function programSupportsDocType(program: DeephavenProgram, docType: DeephavenDocType, product: DeephavenProduct): boolean {
  const programData = DATA.programs[sourceProgram(program)];
  if (docType === 'Full Doc') return true;
  if (docType === 'Bank Statement') return (programData.documentationAdjustments?.bankStatement ?? []).length > 0;
  return (programData.documentationAdjustments?.pnlOnly ?? []).length > 0;
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
  if (input.propertyState === 'FL' || input.propertyState === 'TX') {
    pushAdjustment(lines, 'State (FL / TX)', readAdjustmentValue(programData.adjustments.state[0], cltvIndex));
  }

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

function matchesCreditBand(label: string, creditScore: number): boolean {
  const text = label.replace(/\s+/g, ' ').trim();
  if (text.endsWith('+')) return creditScore >= Number(text.replace('+', ''));
  const match = text.match(/(\d+)\s*-\s*(\d+)/);
  if (match) return creditScore >= Number(match[1]) && creditScore <= Number(match[2]);
  return false;
}

function termAdjustmentLabel(product: DeephavenProduct): string {
  if (product === '15Y Fixed') return '15Yr Fixed';
  if (product === '20Y Fixed') return '20Yr Fixed';
  return product === '30Y Fixed' ? '30Yr Fixed' : '';
}

function findLoanAmountRow(rows: AdjustmentRow[], selectedLoanAmount: number): AdjustmentRow | undefined {
  return rows.find(row => matchesLoanAmountBand(row.label, selectedLoanAmount));
}

function matchesLoanAmountBand(label: string, selectedLoanAmount: number): boolean {
  const text = label.replace(/,/g, '').trim();
  if (text.startsWith('<')) return selectedLoanAmount < Number(text.replace(/[^\d.]/g, ''));
  if (text.startsWith('>')) return selectedLoanAmount > Number(text.replace(/[^\d.]/g, ''));
  return false;
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
