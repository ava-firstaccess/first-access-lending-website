import ratesheet from './vista-ratesheet.json';
import { getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from './button';
import { calculateAmortizingMonthlyPayment, calculateMaxAvailableFromMaxLtv } from './shared';

export type VistaProgram = 'Second OO' | 'Second NOO';
export type VistaProduct = '10yr Fixed' | '15yr Fixed' | '20yr Fixed' | '30yr Fixed';
export type VistaDocType = 'Full Doc' | 'Bank Statement' | '1099' | 'Asset Depletion' | 'P&L Only' | 'WVOE';

export interface VistaPricingInput {
  product: VistaProduct;
  docType: VistaDocType;
  propertyState: string;
  propertyValue: number;
  loanBalance: number;
  desiredLoanAmount: number;
  resultingLoanAmount: number;
  resultingCltv: number;
  creditScore: number;
  dti: number | null;
  lockPeriodDays: 30 | 45 | 60;
  occupancy: string;
  structureType: string;
  unitCount: number;
  cashOut: boolean;
}

export interface VistaAdjustmentLine {
  label: string;
  value: number;
}

export interface VistaQuote {
  program: VistaProgram;
  maxAvailable: number;
  maxLtv: number;
  rate: number;
  noteRate: number;
  rateType: string;
  monthlyPayment: number;
  basePrice: number;
  llpaAdjustment: number;
  purchasePrice: number;
  adjustments: VistaAdjustmentLine[];
  product: VistaProduct;
}

export interface VistaTargetRateQuote extends VistaQuote {
  targetPrice: number;
  tolerance: number;
  deltaFromTarget: number;
  withinTolerance: boolean;
  withinToleranceAllowOverage: boolean;
}

export interface VistaEligibilityResult {
  eligible: boolean;
  reasons: string[];
  maxAvailable: number;
  resultingCltv: number;
}

type ProgramKey = 'secondOO' | 'secondNOO';
type JsonAdjustmentItem = { label: string; lookupKey: string; value: number | null; values?: Array<number | null> };
type JsonPricingRow = { noteRate: number; basePrice: number };
type JsonCltvRow = { creditScore: string; values: Array<number | null> };
type JsonProgram = {
  inputCode: string;
  inputName: VistaProgram;
  sections: {
    pricing30Day: {
      rows: number[];
      rowsData: JsonPricingRow[];
      maxPrice: Record<string, number | null>;
      guideMaxPrice: Record<string, number | null>;
      minPrice: Record<string, number | null>;
    };
    cltvDoc01: {
      rowRange: number[];
      cltvBuckets: string[];
      rows: JsonCltvRow[];
    };
    cltvDoc02?: {
      rowRange: number[];
      cltvBuckets: string[];
      rows: JsonCltvRow[];
    };
    cltvDoc03?: {
      rowRange: number[];
      cltvBuckets: string[];
      rows: JsonCltvRow[];
    };
    cltvDoc04?: {
      rowRange: number[];
      cltvBuckets: string[];
      rows: JsonCltvRow[];
    };
    cltvDoc05?: {
      rowRange: number[];
      cltvBuckets: string[];
      rows: JsonCltvRow[];
    };
    adjustments: Record<string, { rows: number[]; items: JsonAdjustmentItem[] }>;
  };
};

const PROGRAMS = (ratesheet as unknown as { programs: Record<ProgramKey, JsonProgram> }).programs;
const VISTA_PRODUCTS = Array.from(new Set(Object.values(PROGRAMS).flatMap(program => program.sections.adjustments.term.items.map(item => item.label).filter(label => /yr Fixed$/i.test(label))))) as VistaProduct[];

export function getVistaGuideMaxPrice(occupancy: string): number {
  const program = occupancy === 'Investment' ? PROGRAMS.secondNOO : PROGRAMS.secondOO;
  return getVistaProgramGuideMaxPrice(program);
}

export function buildVistaStage1PricingInput(stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType; vistaLockPeriodDays?: 30 | 45 | 60 }): VistaPricingInput {
  const propertyValue = Number(stage1.propertyValue || 0);
  const loanBalance = Number(stage1.loanBalance || 0);
  const desiredLoanAmount = Number(stage1.desiredLoanAmount || 0);
  const resultingLoanAmount = Math.max(0, loanBalance + desiredLoanAmount);
  const resultingCltv = propertyValue > 0 ? resultingLoanAmount / propertyValue : 0;

  return {
    product: requireVistaProduct(stage1.vistaProduct),
    docType: normalizeVistaDocType(stage1.vistaDocType),
    lockPeriodDays: requireVistaLockPeriodDays(stage1.vistaLockPeriodDays),
    propertyState: String(stage1.propertyState || '').toUpperCase(),
    propertyValue,
    loanBalance,
    desiredLoanAmount,
    resultingLoanAmount,
    resultingCltv,
    creditScore: Number(stage1.creditScore || 0),
    dti: Number.isFinite(Number(stage1.dti)) ? Number(stage1.dti) : null,
    occupancy: normalizeOccupancy(stage1.occupancy),
    structureType: normalizeStructureType(stage1.structureType),
    unitCount: Number(stage1.numberOfUnits || 1),
    cashOut: Boolean(stage1.cashOut),
  };
}

export function calculateVistaStage1Quote(
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType; vistaLockPeriodDays?: 30 | 45 | 60 },
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): VistaQuote {
  return calculateVistaQuote(buildVistaStage1PricingInput(stage1), options);
}

export function calculateVistaQuote(
  input: VistaPricingInput,
  options?: { selectedLoanAmount?: number; targetPrice?: number; rateOverride?: number }
): VistaQuote {
  const programKey = getProgramKey(input);
  const program = PROGRAMS[programKey];
  const maxAvailable = calculateMaxAvailable(input);
  const maxLtv = calculateMaxLtv(input);
  const selectedLoanAmount = Math.max(0, options?.selectedLoanAmount ?? input.desiredLoanAmount ?? maxAvailable);
  const programDti = findAdjustment(PROGRAMS[getProgramKey(input)], 'dti', dtiLabel(input.dti));
  const dtiBucketIndex = findCltvBucketIndex(program, input.resultingCltv, input.docType);
  const loanAmountAdjustment = findLoanAmountAdjustment(program, selectedLoanAmount);

  if (selectedLoanAmount > maxAvailable || input.resultingCltv > maxLtv || !loanAmountAdjustment || (input.dti !== null && programDti && programDti.values && !isWorkbookEligibleCell(programDti.values, dtiBucketIndex))) {
    return {
      program: program.inputName,
      maxAvailable,
      maxLtv,
      rate: 0,
      noteRate: 0,
      rateType: 'Fixed',
      monthlyPayment: 0,
      basePrice: 0,
      llpaAdjustment: 0,
      purchasePrice: 0,
      adjustments: [],
      product: input.product,
    };
  }

  const targetPrice = Math.min(options?.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), getMaxPrice(program));
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = options?.rateOverride !== undefined
    ? pickRateClosestToRequested(program, llpaAdjustment, options.rateOverride)
    : pickRateAtOrBelowTarget(program, llpaAdjustment, targetPrice);

  return {
    program: program.inputName,
    maxAvailable,
    maxLtv,
    rate: selected.noteRate,
    noteRate: selected.noteRate,
    rateType: 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input.product, selected.noteRate, selectedLoanAmount),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    adjustments,
    product: input.product,
  };
}

export function evaluateVistaStage1Eligibility(
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType; vistaLockPeriodDays?: 30 | 45 | 60 },
  selectedLoanAmount?: number
): VistaEligibilityResult {
  const input = buildVistaStage1PricingInput(stage1);
  const reasons: string[] = [];
  const maxAvailable = calculateMaxAvailable(input);
  const requested = Math.max(0, selectedLoanAmount ?? input.desiredLoanAmount ?? 0);
  const program = PROGRAMS[getProgramKey(input)];

  const docMatrix = getCltvMatrix(program, input.docType);

  if (!docMatrix) reasons.push(`Vista ${input.docType} pricing is not available in the workbook.`);
  if (docMatrix && !findCltvRow(program, input.creditScore, input.docType)) reasons.push(`Credit score is outside the Vista ${input.docType} matrix.`);
  if (docMatrix && findCltvBucketIndex(program, input.resultingCltv, input.docType) === null) reasons.push(`Resulting CLTV is outside the Vista ${input.docType} matrix.`);
  const propertyType = findAdjustment(program, 'propertyType', propertyTypeLabel(input));
  if (docMatrix && propertyType && propertyType.values && !isWorkbookEligibleCell(propertyType.values, findCltvBucketIndex(program, input.resultingCltv, input.docType))) {
    reasons.push(`Vista ${propertyType.label} is not eligible at the selected CLTV in the current workbook.`);
  }
  const dtiAdjustment = findAdjustment(program, 'dti', dtiLabel(input.dti));
  const dtiBucketIndex = findCltvBucketIndex(program, input.resultingCltv, input.docType);
  if (input.dti !== null && dtiAdjustment && dtiAdjustment.values && !isWorkbookEligibleCell(dtiAdjustment.values, dtiBucketIndex)) {
    reasons.push(`Vista DTI ${input.dti.toFixed(2)}% is not eligible in the current workbook.`);
  }
  if (!findAdjustment(program, 'term', input.product)) reasons.push('Selected term is not available in the Vista ratesheet.');
  if (!findLoanAmountAdjustment(program, requested)) reasons.push('Desired loan amount is outside the Vista loan amount table.');
  if (requested > maxAvailable) reasons.push('Desired loan amount exceeds the current max available amount.');

  return {
    eligible: reasons.length === 0,
    reasons,
    maxAvailable,
    resultingCltv: input.resultingCltv,
  };
}

export function solveVistaStage1TargetRate(
  stage1: ButtonStage1Input & { vistaProduct?: VistaProduct; vistaDocType?: VistaDocType; vistaLockPeriodDays?: 30 | 45 | 60 },
  options: { targetPrice: number; tolerance?: number; selectedLoanAmount?: number }
): VistaTargetRateQuote {
  const input = buildVistaStage1PricingInput(stage1);
  const selectedLoanAmount = Math.max(0, options.selectedLoanAmount ?? input.desiredLoanAmount ?? calculateMaxAvailable(input));
  const program = PROGRAMS[getProgramKey(input)];
  const programDti = findAdjustment(program, 'dti', dtiLabel(input.dti));
  const dtiBucketIndex = findCltvBucketIndex(program, input.resultingCltv, input.docType);
  if (input.dti !== null && programDti && programDti.values && !isWorkbookEligibleCell(programDti.values, dtiBucketIndex)) {
    return {
      program: program.inputName,
      maxAvailable: calculateMaxAvailable(input),
      maxLtv: calculateMaxLtv(input),
      rate: 0,
      noteRate: 0,
      rateType: 'Fixed',
      monthlyPayment: 0,
      basePrice: 0,
      llpaAdjustment: 0,
      purchasePrice: 0,
      adjustments: [],
      product: input.product,
      targetPrice: options.targetPrice,
      tolerance: options.tolerance ?? 0.125,
      deltaFromTarget: 0,
      withinTolerance: false,
      withinToleranceAllowOverage: false,
    };
  }
  const loanAmountAdjustment = findLoanAmountAdjustment(program, selectedLoanAmount);
  if (!loanAmountAdjustment) {
    return {
      program: program.inputName,
      maxAvailable: calculateMaxAvailable(input),
      maxLtv: calculateMaxLtv(input),
      rate: 0,
      noteRate: 0,
      rateType: 'Fixed',
      monthlyPayment: 0,
      basePrice: 0,
      llpaAdjustment: 0,
      purchasePrice: 0,
      adjustments: [],
      product: input.product,
      targetPrice: options.targetPrice,
      tolerance: options.tolerance ?? 0.125,
      deltaFromTarget: 0,
      withinTolerance: false,
      withinToleranceAllowOverage: false,
    };
  }
  const targetPrice = Math.min(options.targetPrice ?? getTargetPurchasePriceForLoanAmount(selectedLoanAmount), getMaxPrice(program));
  const tolerance = options.tolerance ?? 0.125;
  const adjustments = buildAdjustmentLines(input, selectedLoanAmount);
  const llpaAdjustment = roundToThree(adjustments.reduce((sum, row) => sum + row.value, 0));
  const selected = pickRateAtOrBelowTarget(program, llpaAdjustment, targetPrice);
  const deltaFromTarget = roundToThree(targetPrice - selected.purchasePrice);

  return {
    program: program.inputName,
    maxAvailable: calculateMaxAvailable(input),
    maxLtv: calculateMaxLtv(input),
    rate: selected.noteRate,
    noteRate: selected.noteRate,
    rateType: 'Fixed',
    monthlyPayment: calculateMonthlyPayment(input.product, selected.noteRate, selectedLoanAmount),
    basePrice: selected.basePrice,
    llpaAdjustment,
    purchasePrice: selected.purchasePrice,
    adjustments,
    product: input.product,
    targetPrice,
    tolerance,
    deltaFromTarget,
    withinTolerance: deltaFromTarget >= 0 && deltaFromTarget <= tolerance,
    withinToleranceAllowOverage: deltaFromTarget >= -tolerance && deltaFromTarget <= tolerance,
  };
}

function getProgramKey(input: VistaPricingInput): ProgramKey {
  return input.occupancy === 'Investment' ? 'secondNOO' : 'secondOO';
}

function calculateMaxAvailable(input: VistaPricingInput): number {
  const program = PROGRAMS[getProgramKey(input)];
  const cltvConstrained = calculateMaxAvailableFromMaxLtv(input.propertyValue, input.loanBalance, calculateMaxLtv(input));
  const loanAmountCap = getVistaProgramLoanAmountCap(program);
  if (loanAmountCap === null) return 0;
  return Math.max(0, Math.min(cltvConstrained, loanAmountCap));
}

function calculateMaxLtv(input: VistaPricingInput): number {
  const program = PROGRAMS[getProgramKey(input)];
  const matrix = getCltvMatrix(program, input.docType);
  if (!matrix) return 0;
  const row = findCltvRow(program, input.creditScore, input.docType);
  if (!row) return 0;

  const lastEligibleIndex = row.values.reduce<number>((best, value, index) => value !== null ? index : best, -1);
  if (lastEligibleIndex < 0) return 0;
  let maxEligibleIndex = lastEligibleIndex;

  const propertyType = findAdjustment(program, 'propertyType', propertyTypeLabel(input));
  if (propertyType?.values) {
    const propertyTypeEligibleIndex = lastEligibleIndexForValues(propertyType.values);
    if (propertyTypeEligibleIndex < 0) return 0;
    maxEligibleIndex = Math.min(maxEligibleIndex, propertyTypeEligibleIndex);
  }

  return upperBoundForCltvLabel(matrix.cltvBuckets[maxEligibleIndex]) / 100;
}

function buildAdjustmentLines(input: VistaPricingInput, selectedLoanAmount: number): VistaAdjustmentLine[] {
  const program = PROGRAMS[getProgramKey(input)];
  const adjustments: VistaAdjustmentLine[] = [];
  const cltv = buildCltvAdjustment(program, input.creditScore, input.resultingCltv, input.docType);
  if (cltv) adjustments.push(cltv);

  const term = findAdjustment(program, 'term', input.product);
  if (term) adjustments.push({ label: `Term: ${term.label}`, value: term.value ?? 0 });

  const lockTerm = findAdjustment(program, 'lockTerm', vistaLockPeriodLabel(input.lockPeriodDays));
  if (lockTerm) adjustments.push({ label: `Lock Period: ${lockTerm.label}`, value: lockTerm.value ?? 0 });

  const loanAmount = findLoanAmountAdjustment(program, selectedLoanAmount);
  if (loanAmount) adjustments.push({ label: `Loan Amount: ${loanAmount.label}`, value: loanAmount.value ?? 0 });

  const occupancyLabel = occupancyAdjustmentLabel(input.occupancy);
  const occupancy = findAdjustment(program, 'occupancy', occupancyLabel);
  if (occupancy) adjustments.push({ label: `Occupancy: ${occupancy.label}`, value: occupancy.value ?? 0 });

  if (input.cashOut) {
    const purpose = findAdjustment(program, 'purpose', 'Cash-Out');
    if (purpose) adjustments.push({ label: `Purpose: ${purpose.label}`, value: purpose.value ?? 0 });
  }

  const dti = findAdjustment(program, 'dti', dtiLabel(input.dti));
  if (input.dti !== null && dti) {
    const dtiValue = dti.values?.[findCltvBucketIndex(program, input.resultingCltv, input.docType) ?? 0] ?? dti.value;
    adjustments.push({ label: `DTI: ${dti.label}`, value: dtiValue ?? 0 });
  }

  const propertyType = findAdjustment(program, 'propertyType', propertyTypeLabel(input));
  if (propertyType) {
    const propertyTypeValue = propertyType.values?.[cltv ? findCltvBucketIndex(program, input.resultingCltv, input.docType) ?? 0 : 0] ?? propertyType.value;
    adjustments.push({ label: `Property Type: ${propertyType.label}`, value: propertyTypeValue ?? 0 });
  }

  return adjustments;
}

function buildCltvAdjustment(program: JsonProgram, creditScore: number, cltv: number, docType: VistaDocType): VistaAdjustmentLine | null {
  const matrix = getCltvMatrix(program, docType);
  const row = findCltvRow(program, creditScore, docType);
  const bucketIndex = findCltvBucketIndex(program, cltv, docType);
  if (!matrix || !row || bucketIndex === null) return null;

  const label = `${row.creditScore} / CLTV ${matrix.cltvBuckets[bucketIndex]}`;
  return { label: `${docType} CLTV: ${label}`, value: row.values[bucketIndex] ?? 0 };
}

function getCltvMatrix(program: JsonProgram, docType: VistaDocType): JsonProgram['sections']['cltvDoc01'] | NonNullable<JsonProgram['sections']['cltvDoc02']> | NonNullable<JsonProgram['sections']['cltvDoc03']> | NonNullable<JsonProgram['sections']['cltvDoc04']> | NonNullable<JsonProgram['sections']['cltvDoc05']> | null {
  if (docType === 'Full Doc') return program.sections.cltvDoc01;
  if (docType === 'Bank Statement' || docType === '1099') return program.sections.cltvDoc02 ?? null;
  if (docType === 'Asset Depletion') return program.inputName === 'Second OO' ? program.sections.cltvDoc03 ?? null : null;
  if (docType === 'P&L Only' || docType === 'WVOE') return program.inputName === 'Second NOO' ? program.sections.cltvDoc04 ?? null : null;
  return null;
}

function findCltvRow(program: JsonProgram, creditScore: number, docType: VistaDocType): JsonCltvRow | null {
  return getCltvMatrix(program, docType)?.rows.find(row => matchesCreditScoreLabel(row.creditScore, creditScore)) ?? null;
}

function findCltvBucketIndex(program: JsonProgram, cltv: number, docType: VistaDocType): number | null {
  const cltvPct = cltv * 100;
  const buckets = getCltvMatrix(program, docType)?.cltvBuckets;
  if (!buckets) return null;
  for (let i = 0; i < buckets.length; i += 1) {
    if (cltvPct <= upperBoundForCltvLabel(buckets[i])) return i;
  }
  return null;
}

function findAdjustment(program: JsonProgram, category: string, label: string): JsonAdjustmentItem | null {
  const items = program.sections.adjustments[category]?.items ?? [];
  return items.find(item => item.label === label) ?? null;
}

function lastEligibleIndexForValues(values: Array<number | null>): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return index;
  }
  return -1;
}

function isWorkbookEligibleCell(values: Array<number | null>, index: number | null): boolean {
  return index !== null && index >= 0 && index < values.length && values[index] !== null;
}

function getMaxPrice(program: JsonProgram): number {
  return getVistaProgramGuideMaxPrice(program);
}

function getVistaProgramGuideMaxPrice(program: JsonProgram): number {
  const value = program.sections.pricing30Day.guideMaxPrice.default;
  if (value === null || value === undefined) {
    throw new Error(`Vista guide max price is missing from vista-ratesheet.json for ${program.inputName}`);
  }
  return value;
}

function pickRateClosestToRequested(
  program: JsonProgram,
  llpaAdjustment: number,
  requestedRate: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let best = { noteRate: program.sections.pricing30Day.rowsData[0].noteRate, basePrice: program.sections.pricing30Day.rowsData[0].basePrice, purchasePrice: 0 };
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const row of program.sections.pricing30Day.rowsData) {
    const purchasePrice = roundToThree(row.basePrice + llpaAdjustment);
    const delta = Math.abs(row.noteRate - requestedRate);
    if (delta < bestDelta || (delta === bestDelta && row.noteRate > best.noteRate)) {
      best = { noteRate: row.noteRate, basePrice: row.basePrice, purchasePrice };
      bestDelta = delta;
    }
  }

  return best;
}

function pickRateAtOrBelowTarget(
  program: JsonProgram,
  llpaAdjustment: number,
  targetPrice: number
): { noteRate: number; basePrice: number; purchasePrice: number } {
  let bestUnder: { noteRate: number; basePrice: number; purchasePrice: number } | null = null;
  let fallback = { noteRate: program.sections.pricing30Day.rowsData[0].noteRate, basePrice: program.sections.pricing30Day.rowsData[0].basePrice, purchasePrice: 0 };
  let fallbackDelta = Number.POSITIVE_INFINITY;

  for (const row of program.sections.pricing30Day.rowsData) {
    const purchasePrice = roundToThree(row.basePrice + llpaAdjustment);
    if (purchasePrice <= targetPrice && (!bestUnder || purchasePrice > bestUnder.purchasePrice)) {
      bestUnder = { noteRate: row.noteRate, basePrice: row.basePrice, purchasePrice };
    }
    const delta = Math.abs(purchasePrice - targetPrice);
    if (delta < fallbackDelta || (delta === fallbackDelta && purchasePrice > fallback.purchasePrice)) {
      fallback = { noteRate: row.noteRate, basePrice: row.basePrice, purchasePrice };
      fallbackDelta = delta;
    }
  }

  return bestUnder ?? fallback;
}

function calculateMonthlyPayment(product: VistaProduct, noteRate: number, loanAmount: number): number {
  const years = termYears(product);
  if (loanAmount <= 0 || years === null) return 0;
  return roundToNearestDollar(calculateAmortizingMonthlyPayment(loanAmount, noteRate, years));
}

function occupancyAdjustmentLabel(occupancy: string): string {
  if (occupancy === 'Second Home') return 'Second Home';
  if (occupancy === 'Investment') return 'Non Owner Occupied';
  return 'Owner Occupied';
}

function propertyTypeLabel(input: VistaPricingInput): string {
  if (input.unitCount === 2) return '2-Unit';
  if (input.unitCount === 3) return '3-Unit';
  if (input.unitCount >= 4) return '4-Unit';
  if (input.structureType === 'Condo') return 'Condo-Warrantable';
  if (input.structureType === 'Townhome') return 'Townhouse';
  if (input.structureType === 'PUD') return 'PUD';
  return 'SFR';
}

function dtiLabel(dti: number | null): string {
  const labels = PROGRAMS.secondOO.sections.adjustments.dti.items.map(item => item.label).filter(label => label !== '00.00-00');
  if (dti === null) return labels[0] ?? '00.01-43';
  return labels.find(label => valueMatchesRangeLabel(dti, label)) ?? labels.at(-1) ?? '50.01-55';
}

function findLoanAmountAdjustment(program: JsonProgram, amount: number): JsonAdjustmentItem | null {
  const items = program.sections.adjustments.loanAmount.items ?? [];
  return items.find(item => amountMatchesVistaLoanLabel(amount, item.label) && item.value !== null) ?? null;
}

function getVistaProgramLoanAmountCap(program: JsonProgram): number | null {
  let best: number | null = null;
  for (const item of program.sections.adjustments.loanAmount.items ?? []) {
    if (item.value === null) continue;
    const upperBound = upperBoundForVistaLoanLabel(item.label);
    if (upperBound === null) continue;
    best = best === null ? upperBound : Math.max(best, upperBound);
  }
  return best;
}

function matchesCreditScoreLabel(label: string, creditScore: number): boolean {
  const text = label.replace('≥', '>=').trim();
  if (text.startsWith('>=')) return creditScore >= Number(text.replace('>=', '').trim());
  const parts = text.split('-').map(part => Number(part.trim()));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return creditScore >= parts[0] && creditScore <= parts[1];
  }
  return false;
}

function upperBoundForCltvLabel(label: string): number {
  const right = label.split('-')[1] ?? label;
  return Number(String(right).replace('%', '').trim());
}

function requireVistaLockPeriodDays(lockPeriodDays?: 30 | 45 | 60): 30 | 45 | 60 {
  if (lockPeriodDays === 30 || lockPeriodDays === 45 || lockPeriodDays === 60) return lockPeriodDays;
  throw new Error('Vista lock period is missing or invalid.');
}

function vistaLockPeriodLabel(lockPeriodDays: 30 | 45 | 60): string {
  return `${lockPeriodDays} Day`;
}

function requireVistaProduct(product?: string): VistaProduct {
  if (VISTA_PRODUCTS.includes(product as VistaProduct)) return product as VistaProduct;
  throw new Error('Vista product is missing or invalid.');
}

function normalizeVistaDocType(docType?: string): VistaDocType {
  const value = String(docType || '').toLowerCase();
  if (value.includes('bank')) return 'Bank Statement';
  if (value.includes('1099')) return '1099';
  if (value.includes('asset')) return 'Asset Depletion';
  if (value.includes('p&l') || value.includes('p & l') || value.includes('pnl')) return 'P&L Only';
  if (value.includes('wvoe')) return 'WVOE';
  return 'Full Doc';
}

function normalizeOccupancy(occupancy?: string): string {
  const value = String(occupancy || '').toLowerCase();
  if (value.includes('rental') || value.includes('investment') || value.includes('investor')) return 'Investment';
  if (value.includes('second')) return 'Second Home';
  return 'Owner Occupied';
}

function normalizeStructureType(structureType?: string): string {
  const value = String(structureType || '').toLowerCase();
  if (value.includes('condo')) return 'Condo';
  if (value.includes('town')) return 'Townhome';
  if (value.includes('pud')) return 'PUD';
  if (value.includes('multi')) return '2-4 Unit';
  return 'SFR';
}

function termYears(product: VistaProduct): number | null {
  const match = String(product).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function valueMatchesRangeLabel(value: number, label: string): boolean {
  const normalized = label.trim();
  const range = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!range) return false;
  return value >= Number(range[1]) && value <= Number(range[2]);
}

function amountMatchesVistaLoanLabel(amount: number, label: string): boolean {
  const normalized = label.toLowerCase().trim();
  if (normalized.endsWith('+')) {
    const min = normalized.match(/([\d,]+(?:\.\d+)?)([km])?/);
    return min ? amount >= scaleVistaAmountToken(min[1], min[2] ?? '') : false;
  }
  const range = normalized.match(/([\d,]+(?:\.\d+)?)\s*-\s*([\d,]+(?:\.\d+)?)([km])?/);
  if (!range) return false;
  const left = scaleVistaAmountToken(range[1], '');
  const right = scaleVistaAmountToken(range[2], range[3] ?? '');
  return amount >= left && amount <= right;
}

function upperBoundForVistaLoanLabel(label: string): number | null {
  const normalized = label.toLowerCase().trim();
  if (normalized.endsWith('+')) return null;
  const range = normalized.match(/([\d,]+(?:\.\d+)?)\s*-\s*([\d,]+(?:\.\d+)?)([km])?/);
  if (!range) return null;
  return scaleVistaAmountToken(range[2], range[3] ?? '');
}

function scaleVistaAmountToken(token: string, suffix = ''): number {
  const value = Number(token.replace(/,/g, ''));
  if (suffix === 'm') return value * 1_000_000;
  if (suffix === 'k') return value * 1_000;
  return value;
}

function roundToThree(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundToNearestDollar(value: number): number {
  return Math.round(value);
}
