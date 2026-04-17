import { calculateButtonStage1Quote, evaluateButtonStage1Eligibility, getTargetPurchasePriceForLoanAmount, solveButtonStage1TargetRate, type ButtonStage1Input } from '@/lib/rates/button';
import { calculateNewRezStage1Quote, evaluateNewRezStage1Eligibility, solveNewRezStage1TargetRate } from '@/lib/rates/newrez';
import { calculateDeephavenStage1Quote, evaluateDeephavenStage1Eligibility, solveDeephavenStage1TargetRate } from '@/lib/rates/deephaven';
import { calculateOsbStage1Quote, evaluateOsbStage1Eligibility, solveOsbStage1TargetRate } from '@/lib/rates/osb';
import { calculateVerusStage1Quote, evaluateVerusStage1Eligibility, solveVerusStage1TargetRate } from '@/lib/rates/verus';
import { calculateVistaStage1Quote, evaluateVistaStage1Eligibility, solveVistaStage1TargetRate } from '@/lib/rates/vista';
import type { BestExTermYears, ButtonDocType, DeephavenDocType, InvestorSummary, OsbLockPeriod, PricingViewEngine, SharedDocType, Stage1Eligibility, Stage1ExecutionQuote, Stage1PricingEngineResult, Stage1PricingRequest, Stage1PricingResponse, TesterInput, VerusDrawPeriodYears, VerusLockPeriodDays, VistaDocType } from './types';

const BEST_EX_WINDOW_FLOOR = 0.375;
const BEST_EX_WINDOW_CEILING = 0.125;

function roundToThree(value: number) { return Number(value.toFixed(3)); }
function roundUpToEighth(value: number) {
  if (value >= 0) return Number((Math.ceil(value * 8) / 8).toFixed(3));
  return Number((Math.floor(value * 8) / 8).toFixed(3));
}
function buildRequestedRates(min: number, max: number, step = 0.125) { const values: number[] = []; for (let rate = min; rate <= max + 0.0001; rate += step) values.push(roundToThree(rate)); return values; }
function distanceToBestExWindow(purchasePrice: number, lowerBound: number, upperBound: number) { if (purchasePrice < lowerBound) return roundToThree(lowerBound - purchasePrice); if (purchasePrice > upperBound) return roundToThree(purchasePrice - upperBound); return 0; }
function chooseDisplayQuote(engine: Stage1ExecutionQuote['engine'], fallbackQuote: Stage1ExecutionQuote, requestedRates: number[], getQuote: (rateOverride?: number) => Stage1ExecutionQuote, targetPrice: number) {
  const lowerBound = roundToThree(targetPrice - BEST_EX_WINDOW_FLOOR);
  const upperBound = roundToThree(targetPrice + BEST_EX_WINDOW_CEILING);
  const candidates = new Map<string, Stage1ExecutionQuote>();
  for (const requestedRate of requestedRates) {
    const quote = getQuote(requestedRate);
    candidates.set(`${quote.rate}|${quote.purchasePrice}|${quote.product}`, quote);
  }
  const allCandidates = candidates.size ? [...candidates.values()] : [fallbackQuote];
  const withMeta = allCandidates.map(quote => {
    const deltaFromTarget = roundToThree(quote.purchasePrice - targetPrice);
    const windowMatched = quote.purchasePrice >= lowerBound && quote.purchasePrice <= upperBound;
    return { quote, deltaFromTarget, windowMatched };
  });
  const windowCandidates = withMeta.filter(candidate => candidate.windowMatched);
  if (windowCandidates.length > 0) {
    return [...windowCandidates].sort((a, b) => a.quote.rate - b.quote.rate || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || ((a.deltaFromTarget > 0) === (b.deltaFromTarget > 0) ? 0 : a.deltaFromTarget > 0 ? 1 : -1) || a.quote.engine.localeCompare(b.quote.engine))[0].quote;
  }
  return [...withMeta].sort((a, b) => distanceToBestExWindow(a.quote.purchasePrice, lowerBound, upperBound) - distanceToBestExWindow(b.quote.purchasePrice, lowerBound, upperBound) || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || a.quote.rate - b.quote.rate || a.quote.engine.localeCompare(b.quote.engine))[0].quote;
}
type EngineQuoteLike = Omit<Stage1ExecutionQuote, 'engine'> & { program?: string };
function toQuote(engine: Stage1ExecutionQuote['engine'], quote: EngineQuoteLike): Stage1ExecutionQuote { return { engine, program: quote.program ?? engine, product: quote.product, maxAvailable: quote.maxAvailable, rate: quote.rate, noteRate: quote.noteRate, monthlyPayment: quote.monthlyPayment, maxLtv: quote.maxLtv, purchasePrice: quote.purchasePrice, basePrice: quote.basePrice, llpaAdjustment: quote.llpaAdjustment, adjustments: quote.adjustments }; }

function mapBestExDocTypeToButton(docType: SharedDocType, product: 'HELOC' | 'CES'): ButtonDocType | null {
  if (docType === 'Full Doc') return 'Full Doc';
  if (docType === 'Bank Statement') return product === 'HELOC' ? 'Bank Statement' : null;
  if (docType === 'Asset Depletion') return product === 'HELOC' ? 'Asset Depletion' : null;
  return null;
}

function mapBestExDocTypeToVista(docType: SharedDocType): VistaDocType {
  return docType;
}

function mapBestExDocTypeToVerus(docType: SharedDocType, product: 'CES' | 'HELOC'): 'Standard' | 'Alt Doc' | null {
  if (docType === 'Full Doc') return 'Standard';
  if (docType === 'Bank Statement') return 'Alt Doc';
  if (product === 'CES' && (docType === '1099' || docType === 'P&L Only' || docType === 'WVOE')) return 'Alt Doc';
  return null;
}

function mapBestExDocTypeToOsb(docType: SharedDocType): 'Full Doc' | null {
  return docType === 'Full Doc' ? 'Full Doc' : null;
}

function mapBestExDocTypeToDeephaven(docType: SharedDocType): DeephavenDocType | null {
  if (docType === 'Full Doc') return 'Full Doc';
  if (docType === 'Bank Statement') return 'Bank Statement';
  if (docType === 'P&L Only') return 'P&L Only';
  return null;
}

function getActiveResult(engine: PricingViewEngine, input: TesterInput, effectiveTargetPrice: number, effectiveManualRateOverride: number | undefined, tolerance: number): Stage1PricingEngineResult | null {
  if (engine === 'BestX') return null;
  if (engine === 'Button') {
    const eligibility = evaluateButtonStage1Eligibility(input as ButtonStage1Input, input.desiredLoanAmount);
    const baseQuote = calculateButtonStage1Quote(input as ButtonStage1Input, { selectedLoanAmount: input.desiredLoanAmount, rateOverride: effectiveManualRateOverride, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears });
    const targetQuote = solveButtonStage1TargetRate(input as ButtonStage1Input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears });
    const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Button', toQuote('Button', { ...baseQuote, program: 'Button', product: String(input.buttonProduct || 'HELOC') }), buildRequestedRates(3, 20), rateOverride => toQuote('Button', { ...calculateButtonStage1Quote(input as ButtonStage1Input, { selectedLoanAmount: input.desiredLoanAmount, rateOverride, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears }), program: 'Button', product: String(input.buttonProduct || 'HELOC') }), effectiveTargetPrice);
    return { eligibility, quote: toQuote('Button', { ...displayQuote, program: 'Button', product: String(input.buttonProduct || 'HELOC') }), targetQuote: { ...toQuote('Button', { ...targetQuote, program: 'Button', product: String(input.buttonProduct || 'HELOC') }), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice: solveButtonStage1TargetRate(input as ButtonStage1Input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears }).purchasePrice };
  }
  if (engine === 'Vista') { const eligibility = evaluateVistaStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateVistaStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveVistaStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Vista', toQuote('Vista', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('Vista', calculateVistaStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice); return { eligibility, quote: toQuote('Vista', displayQuote), targetQuote: { ...toQuote('Vista', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice: solveVistaStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice }; }
  if (engine === 'NewRez') { const eligibility = evaluateNewRezStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateNewRezStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveNewRezStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('NewRez', toQuote('NewRez', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('NewRez', calculateNewRezStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice); return { eligibility, quote: toQuote('NewRez', displayQuote), targetQuote: { ...toQuote('NewRez', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice: solveNewRezStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice }; }
  if (engine === 'Verus') { const eligibility = evaluateVerusStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateVerusStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveVerusStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Verus', toQuote('Verus', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('Verus', calculateVerusStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice); return { eligibility, quote: toQuote('Verus', displayQuote), targetQuote: { ...toQuote('Verus', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice: solveVerusStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice }; }
  if (engine === 'Deephaven') { const eligibility = evaluateDeephavenStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateDeephavenStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveDeephavenStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Deephaven', toQuote('Deephaven', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('Deephaven', calculateDeephavenStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice); return { eligibility, quote: toQuote('Deephaven', displayQuote), targetQuote: { ...toQuote('Deephaven', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice: solveDeephavenStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice }; }
  const eligibility = evaluateOsbStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateOsbStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveOsbStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('OSB', toQuote('OSB', baseQuote), input.osbProgram === 'HELOC' ? buildRequestedRates(0.5, 8) : buildRequestedRates(3, 20), rateOverride => toQuote('OSB', calculateOsbStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice); return { eligibility, quote: toQuote('OSB', displayQuote), targetQuote: { ...toQuote('OSB', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice: solveOsbStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice };
}

export function computeStage1Pricing(request: Stage1PricingRequest): Stage1PricingResponse {
  const { engine, input } = request;
  const tolerance = request.tolerance ?? 0.125;
  const defaultBackendTargetPrice = getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0));
  const parsedTargetPriceOverride = request.targetPriceOverride?.trim()
    ? (Number.isFinite(Number(request.targetPriceOverride)) ? Number(request.targetPriceOverride) : undefined)
    : undefined;
  const loTargetPrice = parsedTargetPriceOverride ?? 100;
  const effectiveTargetPrice = roundToThree(defaultBackendTargetPrice - (100 - loTargetPrice));
  const effectiveManualRateOverride = request.manualRateOverride?.trim() ? (Number.isFinite(Number(request.manualRateOverride)) ? Number(request.manualRateOverride) : undefined) : undefined;
  const activeResult = getActiveResult(engine, input, effectiveTargetPrice, effectiveManualRateOverride, tolerance);

  const selectedLoanAmount = Number(input.desiredLoanAmount || 0);
  const bestExProduct = input.bestExProduct ?? 'HELOC';
  const bestExDrawPeriodYears = input.bestExDrawPeriodYears ?? 5;
  const bestExTermYears = input.bestExTermYears ?? 30;
  const bestExLockPeriodDays = input.bestExLockPeriodDays ?? 45;
  const bestExDocType = input.bestExDocType ?? 'Full Doc';
  const actualLockPeriodDays = bestExLockPeriodDays + 15;
  const bestExWindowLowerBound = roundToThree(effectiveTargetPrice - BEST_EX_WINDOW_FLOOR);
  const bestExWindowUpperBound = roundToThree(effectiveTargetPrice + BEST_EX_WINDOW_CEILING);
  const makeSummary = (eligibility: Stage1Eligibility, quote: Stage1ExecutionQuote, maxPrice: number): InvestorSummary => { const rawDiscountPoints = effectiveTargetPrice - quote.purchasePrice; const discountPoints = roundUpToEighth(Math.abs(rawDiscountPoints)); const buyPrice = 0; const deltaFromTarget = roundToThree(quote.purchasePrice - effectiveTargetPrice); const windowMatched = eligibility.eligible && quote.purchasePrice >= bestExWindowLowerBound && quote.purchasePrice <= bestExWindowUpperBound; return { investor: quote.engine, eligibility, quote, discountPoints, buyPrice, windowMatched, deltaFromTarget, targetPrice: defaultBackendTargetPrice, maxPrice }; };
  const makeIneligible = (investor: Stage1ExecutionQuote['engine'], program: string, product: string, reason: string, maxPrice = 0): InvestorSummary => ({ investor, eligibility: { eligible: false, reasons: [reason], maxAvailable: 0, resultingCltv: 0 }, quote: { engine: investor, program, product, maxAvailable: 0, rate: 0, noteRate: 0, monthlyPayment: 0, maxLtv: 0, purchasePrice: 0, basePrice: 0, llpaAdjustment: 0, adjustments: [] }, discountPoints: 0, buyPrice: 0, windowMatched: false, deltaFromTarget: 0, targetPrice: defaultBackendTargetPrice, maxPrice });
  const chooseBestXSummary = (eligibility: Stage1Eligibility, fallbackQuote: Stage1ExecutionQuote, requestedRates: number[], getQuote: (rateOverride?: number) => Stage1ExecutionQuote, maxPrice: number): InvestorSummary => { if (!eligibility.eligible) return makeSummary(eligibility, fallbackQuote, maxPrice); if (effectiveManualRateOverride !== undefined) return makeSummary(eligibility, getQuote(effectiveManualRateOverride), maxPrice); const candidates = new Map<string, InvestorSummary>(); for (const requestedRate of requestedRates) { const summary = makeSummary(eligibility, getQuote(requestedRate), maxPrice); candidates.set(`${summary.quote.rate}|${summary.quote.purchasePrice}|${summary.quote.product}`, summary); } const allCandidates = candidates.size ? [...candidates.values()] : [makeSummary(eligibility, fallbackQuote, maxPrice)]; const windowCandidates = allCandidates.filter(summary => summary.windowMatched); if (windowCandidates.length > 0) { return [...windowCandidates].sort((a, b) => a.quote.rate - b.quote.rate || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || ((a.deltaFromTarget > 0) === (b.deltaFromTarget > 0) ? 0 : a.deltaFromTarget > 0 ? 1 : -1) || b.buyPrice - a.buyPrice || a.investor.localeCompare(b.investor))[0]; } return [...allCandidates].sort((a, b) => distanceToBestExWindow(a.quote.purchasePrice, bestExWindowLowerBound, bestExWindowUpperBound) - distanceToBestExWindow(b.quote.purchasePrice, bestExWindowLowerBound, bestExWindowUpperBound) || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || a.quote.rate - b.quote.rate || b.buyPrice - a.buyPrice || a.investor.localeCompare(b.investor))[0]; };
  const standardRequestedRates = buildRequestedRates(3, 20); const osbHelocRequestedRates = buildRequestedRates(0.5, 8); const results: InvestorSummary[] = [];

  if (bestExProduct === 'HELOC') {
    const buttonDocType = mapBestExDocTypeToButton(bestExDocType, 'HELOC');
    if (!buttonDocType) results.push(makeIneligible('Button', 'Button', 'HELOC', `Button does not support ${bestExDocType} pricing for HELOC.`));
    else {
      const buttonInput = { ...input, buttonProduct: 'HELOC' as const, helocDrawTermYears: bestExDrawPeriodYears, buttonDocType };
      const buttonEligibility = evaluateButtonStage1Eligibility(buttonInput as ButtonStage1Input, selectedLoanAmount);
      const buttonBaseQuote = calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears });
      const buttonMaxPrice = solveButtonStage1TargetRate(buttonInput as ButtonStage1Input, { targetPrice: 999, tolerance, selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears }).purchasePrice;
      results.push(chooseBestXSummary(buttonEligibility, toQuote('Button', { ...buttonBaseQuote, program: 'Button', product: 'HELOC' }), standardRequestedRates, rateOverride => toQuote('Button', { ...calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears, rateOverride }), program: 'Button', product: 'HELOC' }), buttonMaxPrice));
    }
    results.push(makeIneligible('Vista', 'CES Only', 'HELOC', 'Vista only supports CES pricing in Best Ex.'));
    results.push(makeIneligible('NewRez', 'CES Only', 'HELOC', 'NewRez only supports CES pricing in Best Ex.'));
    results.push(makeIneligible('Deephaven', 'CES Only', 'HELOC', 'Deephaven only supports CES pricing in Best Ex.'));
    const osbDocType = mapBestExDocTypeToOsb(bestExDocType);
    if (!osbDocType) results.push(makeIneligible('OSB', 'HELOC', '30 Year Maturity', `OSB does not support ${bestExDocType} pricing in this engine.`));
    else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) results.push(makeIneligible('OSB', 'HELOC', '30 Year Maturity', `OSB HELOC only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
    else { const osbInput = { ...input, osbProgram: 'HELOC' as const, osbProduct: '30 Year Maturity' as const, osbLockPeriodDays: actualLockPeriodDays as OsbLockPeriod, helocDrawTermYears: bestExDrawPeriodYears }; const eligibility = evaluateOsbStage1Eligibility(osbInput, selectedLoanAmount); const baseQuote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveOsbStage1TargetRate(osbInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('OSB', baseQuote), osbHelocRequestedRates, rateOverride => toQuote('OSB', calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
    const verusDocType = mapBestExDocTypeToVerus(bestExDocType, 'HELOC');
    if (!verusDocType) results.push(makeIneligible('Verus', 'HELOC', '30 YR', `Verus does not support ${bestExDocType} pricing for HELOC.`));
    else if (bestExDrawPeriodYears === 10) results.push(makeIneligible('Verus', 'HELOC', '30 YR', 'Verus HELOC supports 3 or 5 year draw periods only.'));
    else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) results.push(makeIneligible('Verus', 'HELOC', '30 YR', `Verus HELOC only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
    else { const verusInput = { ...input, verusProgram: 'HELOC' as const, verusProduct: '30 YR' as const, verusDocType, verusDrawPeriodYears: bestExDrawPeriodYears as Exclude<VerusDrawPeriodYears, 2>, verusLockPeriodDays: actualLockPeriodDays as VerusLockPeriodDays }; const eligibility = evaluateVerusStage1Eligibility(verusInput, selectedLoanAmount); const baseQuote = calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveVerusStage1TargetRate(verusInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('Verus', baseQuote), standardRequestedRates, rateOverride => toQuote('Verus', calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
  } else {
    const buttonDocType = mapBestExDocTypeToButton(bestExDocType, 'CES');
    if (!buttonDocType) results.push(makeIneligible('Button', 'Button', 'CES', `Button does not support ${bestExDocType} pricing for CES.`));
    else {
      const buttonInput = { ...input, buttonProduct: 'CES' as const, buttonTermYears: bestExTermYears, buttonDocType };
      const buttonEligibility = evaluateButtonStage1Eligibility(buttonInput as ButtonStage1Input, selectedLoanAmount);
      const buttonBaseQuote = calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, cesTermYears: bestExTermYears });
      const buttonMaxPrice = solveButtonStage1TargetRate(buttonInput as ButtonStage1Input, { targetPrice: 999, tolerance, selectedLoanAmount, cesTermYears: bestExTermYears }).purchasePrice;
      results.push(chooseBestXSummary(buttonEligibility, toQuote('Button', { ...buttonBaseQuote, program: 'Button', product: 'CES' }), standardRequestedRates, rateOverride => toQuote('Button', { ...calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, cesTermYears: bestExTermYears, rateOverride }), program: 'Button', product: 'CES' }), buttonMaxPrice));
    }
    const vistaProducts: Partial<Record<BestExTermYears, TesterInput['vistaProduct']>> = { 10: '10yr Fixed', 15: '15yr Fixed', 20: '20yr Fixed', 30: '30yr Fixed' };
    const vistaProduct = vistaProducts[bestExTermYears];
    if (!vistaProduct) results.push(makeIneligible('Vista', 'CES', `${bestExTermYears} Year`, `Vista does not support ${bestExTermYears}-year CES pricing.`));
    else { const vistaInput = { ...input, vistaProduct, vistaDocType: mapBestExDocTypeToVista(bestExDocType) }; const eligibility = evaluateVistaStage1Eligibility(vistaInput, selectedLoanAmount); const baseQuote = calculateVistaStage1Quote(vistaInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveVistaStage1TargetRate(vistaInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('Vista', baseQuote), standardRequestedRates, rateOverride => toQuote('Vista', calculateVistaStage1Quote(vistaInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
    const newrezProducts: Partial<Record<BestExTermYears, TesterInput['newrezProduct']>> = { 15: '15 Year Fixed', 20: '20 Year Fixed', 30: '30 Year Fixed' };
    const newrezProduct = newrezProducts[bestExTermYears];
    if (!newrezProduct) results.push(makeIneligible('NewRez', 'CES', `${bestExTermYears} Year`, `NewRez does not support ${bestExTermYears}-year CES pricing.`));
    else if (bestExDocType !== 'Full Doc') results.push(makeIneligible('NewRez', 'CES', newrezProduct, 'NewRez does not support alt-doc pricing in the Home Equity workbook.'));
    else { const newrezInput = { ...input, newrezProduct }; const eligibility = evaluateNewRezStage1Eligibility(newrezInput, selectedLoanAmount); const baseQuote = calculateNewRezStage1Quote(newrezInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveNewRezStage1TargetRate(newrezInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('NewRez', baseQuote), standardRequestedRates, rateOverride => toQuote('NewRez', calculateNewRezStage1Quote(newrezInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
    const osbProducts: Partial<Record<BestExTermYears, TesterInput['osbProduct']>> = { 10: 'Fixed 10', 15: 'Fixed 15', 20: 'Fixed 20', 30: 'Fixed 30' };
    const osbProduct = osbProducts[bestExTermYears];
    const osbDocType = mapBestExDocTypeToOsb(bestExDocType);
    if (!osbProduct) results.push(makeIneligible('OSB', '2nd Liens', `${bestExTermYears} Year`, `OSB does not support ${bestExTermYears}-year CES pricing.`));
    else if (!osbDocType) results.push(makeIneligible('OSB', '2nd Liens', osbProduct, `OSB does not support ${bestExDocType} pricing in this engine.`));
    else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) results.push(makeIneligible('OSB', '2nd Liens', osbProduct, `OSB only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
    else { const osbInput = { ...input, osbProgram: '2nd Liens' as const, osbProduct, osbLockPeriodDays: actualLockPeriodDays as OsbLockPeriod }; const eligibility = evaluateOsbStage1Eligibility(osbInput, selectedLoanAmount); const baseQuote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveOsbStage1TargetRate(osbInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('OSB', baseQuote), standardRequestedRates, rateOverride => toQuote('OSB', calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
    const verusProducts: Record<BestExTermYears, TesterInput['verusProduct']> = { 10: '10 YR FIX', 15: '15 YR FIX', 20: '20 YR FIX', 25: '25 YR FIX', 30: '30 YR FIX' };
    const verusDocType = mapBestExDocTypeToVerus(bestExDocType, 'CES');
    if (!verusDocType) results.push(makeIneligible('Verus', 'CES', verusProducts[bestExTermYears]!, `Verus does not support ${bestExDocType} pricing for CES.`));
    else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) results.push(makeIneligible('Verus', 'CES', verusProducts[bestExTermYears]!, `Verus only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
    else { const verusInput = { ...input, verusProgram: 'CES' as const, verusProduct: verusProducts[bestExTermYears], verusDocType, verusLockPeriodDays: actualLockPeriodDays as VerusLockPeriodDays }; const eligibility = evaluateVerusStage1Eligibility(verusInput, selectedLoanAmount); const baseQuote = calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveVerusStage1TargetRate(verusInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('Verus', baseQuote), standardRequestedRates, rateOverride => toQuote('Verus', calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
    const deephavenProducts: Partial<Record<BestExTermYears, TesterInput['deephavenProduct']>> = { 15: '15Y Fixed', 20: '20Y Fixed', 30: '30Y Fixed' };
    const deephavenProduct = deephavenProducts[bestExTermYears];
    const deephavenDocType = mapBestExDocTypeToDeephaven(bestExDocType);
    if (!deephavenProduct) results.push(makeIneligible('Deephaven', 'Equity Advantage / Elite', `${bestExTermYears} Year`, `Deephaven does not support ${bestExTermYears}-year CES pricing.`));
    else if (!deephavenDocType) results.push(makeIneligible('Deephaven', 'Equity Advantage / Elite', deephavenProduct, `Deephaven does not support ${bestExDocType} pricing in the current workbook-backed engine.`));
    else { const deephavenInput = { ...input, deephavenProduct, deephavenDocType }; const eligibility = evaluateDeephavenStage1Eligibility(deephavenInput, selectedLoanAmount); const baseQuote = calculateDeephavenStage1Quote(deephavenInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveDeephavenStage1TargetRate(deephavenInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('Deephaven', baseQuote), standardRequestedRates, rateOverride => toQuote('Deephaven', calculateDeephavenStage1Quote(deephavenInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
  }

  results.sort((a, b) => (a.eligibility.eligible === b.eligibility.eligible ? 0 : a.eligibility.eligible ? -1 : 1) || (effectiveManualRateOverride !== undefined && a.eligibility.eligible && b.eligibility.eligible ? b.buyPrice - a.buyPrice || b.quote.purchasePrice - a.quote.purchasePrice : 0) || (a.windowMatched === b.windowMatched ? 0 : a.windowMatched ? -1 : 1) || (a.windowMatched && b.windowMatched ? a.quote.rate - b.quote.rate || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || ((a.deltaFromTarget > 0) === (b.deltaFromTarget > 0) ? 0 : a.deltaFromTarget > 0 ? 1 : -1) || b.buyPrice - a.buyPrice : 0) || (a.eligibility.eligible && b.eligibility.eligible && !a.windowMatched && !b.windowMatched ? distanceToBestExWindow(a.quote.purchasePrice, bestExWindowLowerBound, bestExWindowUpperBound) - distanceToBestExWindow(b.quote.purchasePrice, bestExWindowLowerBound, bestExWindowUpperBound) || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || a.quote.rate - b.quote.rate || b.buyPrice - a.buyPrice : 0) || a.investor.localeCompare(b.investor));
  return { defaultBackendTargetPrice, effectiveTargetPrice, activeResult, results };
}
