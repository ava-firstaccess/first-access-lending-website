import { calculateButtonStage1Quote, evaluateButtonStage1Eligibility, getTargetPurchasePriceForLoanAmount, solveButtonStage1TargetRate, type ButtonStage1Input } from '@/lib/rates/button';
import { calculateArcHomeStage1Quote, evaluateArcHomeStage1Eligibility, solveArcHomeStage1TargetRate } from '@/lib/rates/arc-home';
import { calculateNewRezStage1Quote, evaluateNewRezStage1Eligibility, getNewRezRateBounds, solveNewRezStage1TargetRate } from '@/lib/rates/newrez';
import { calculateDeephavenStage1Quote, evaluateDeephavenStage1Eligibility, solveDeephavenStage1TargetRate } from '@/lib/rates/deephaven';
import { calculateOsbStage1Quote, evaluateOsbStage1Eligibility, solveOsbStage1TargetRate } from '@/lib/rates/osb';
import { calculateVerusStage1Quote, evaluateVerusStage1Eligibility, solveVerusStage1TargetRate } from '@/lib/rates/verus';
import { calculateVistaStage1Quote, evaluateVistaStage1Eligibility, solveVistaStage1TargetRate } from '@/lib/rates/vista';
import { evaluateInvestorAvmRule, type InvestorName } from '@/lib/rates/investor-confidence-rules';
import type { BestExDocType, BestExTermYears, ButtonDocType, DeephavenDocType, InvestorPriceLadderRow, InvestorSummary, OsbLockPeriod, PricingViewEngine, SharedDocType, Stage1Eligibility, Stage1ExecutionQuote, Stage1PricingEngineResult, Stage1PricingRequest, Stage1PricingResponse, TesterInput, VerusDrawPeriodYears, VerusLockPeriodDays, VistaDocType } from './types';

const BEST_EX_WINDOW_FLOOR = 0.375;
const BEST_EX_WINDOW_CEILING = 0.125;

function roundToThree(value: number) { return Number(value.toFixed(3)); }
function roundUpToEighth(value: number) {
  if (value >= 0) return Number((Math.ceil(value * 8) / 8).toFixed(3));
  return Number((Math.floor(value * 8) / 8).toFixed(3));
}
function roundDownToEighth(value: number) {
  if (value >= 0) return Number((Math.floor(value * 8) / 8).toFixed(3));
  return Number((Math.ceil(value * 8) / 8).toFixed(3));
}
function roundBorrowerPoints(deltaFromTarget: number) {
  return deltaFromTarget >= 0 ? roundUpToEighth(deltaFromTarget) : roundDownToEighth(Math.abs(deltaFromTarget));
}
function buildRequestedRates(min: number, max: number, step = 0.125) { const values: number[] = []; for (let rate = min; rate <= max + 0.0001; rate += step) values.push(roundToThree(rate)); return values; }
function distanceToBestExWindow(purchasePrice: number, lowerBound: number, upperBound: number) { if (purchasePrice < lowerBound) return roundToThree(lowerBound - purchasePrice); if (purchasePrice > upperBound) return roundToThree(purchasePrice - upperBound); return 0; }
function capSelectionTarget(targetPrice: number, maxPrice: number) {
  return maxPrice > 0 ? Math.min(targetPrice, maxPrice) : targetPrice;
}
function getBestXSelectionTarget(targetPrice: number, maxPrice: number, hasTargetPriceOverride: boolean) {
  return hasTargetPriceOverride ? capSelectionTarget(targetPrice, maxPrice) : targetPrice;
}
function chooseDisplayQuote(engine: Stage1ExecutionQuote['engine'], fallbackQuote: Stage1ExecutionQuote, requestedRates: number[], getQuote: (rateOverride?: number) => Stage1ExecutionQuote, targetPrice: number, maxPrice: number, useOverrideSelection: boolean) {
  const cappedTargetPrice = capSelectionTarget(targetPrice, maxPrice);
  const lowerBound = roundToThree(cappedTargetPrice - BEST_EX_WINDOW_FLOOR);
  const upperBound = roundToThree(cappedTargetPrice + BEST_EX_WINDOW_CEILING);
  const candidates = new Map<string, Stage1ExecutionQuote>();
  for (const requestedRate of requestedRates) {
    const quote = getQuote(requestedRate);
    candidates.set(`${quote.rate}|${quote.purchasePrice}|${quote.product}`, quote);
  }
  const allCandidates = candidates.size ? [...candidates.values()] : [fallbackQuote];
  if (useOverrideSelection) {
    const underOrEqual = allCandidates
      .filter(quote => quote.purchasePrice <= cappedTargetPrice)
      .sort((a, b) => (b.purchasePrice - a.purchasePrice) || (a.rate - b.rate) || a.engine.localeCompare(b.engine));
    if (underOrEqual.length > 0) return underOrEqual[0];
    return [...allCandidates].sort((a, b) => Math.abs(a.purchasePrice - cappedTargetPrice) - Math.abs(b.purchasePrice - cappedTargetPrice) || a.rate - b.rate || a.engine.localeCompare(b.engine))[0];
  }
  const withMeta = allCandidates.map(quote => {
    const deltaFromTarget = roundToThree(quote.purchasePrice - targetPrice);
    const windowMatched = quote.purchasePrice >= lowerBound && quote.purchasePrice <= upperBound;
    return { quote, deltaFromTarget, windowMatched };
  });
  const windowCandidates = withMeta.filter(candidate => candidate.windowMatched);
  if (windowCandidates.length > 0) {
    return [...windowCandidates].sort((a, b) => Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || ((a.deltaFromTarget > 0) === (b.deltaFromTarget > 0) ? 0 : a.deltaFromTarget > 0 ? 1 : -1) || a.quote.rate - b.quote.rate || a.quote.engine.localeCompare(b.quote.engine))[0].quote;
  }
  return [...withMeta].sort((a, b) => distanceToBestExWindow(a.quote.purchasePrice, lowerBound, upperBound) - distanceToBestExWindow(b.quote.purchasePrice, lowerBound, upperBound) || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || ((a.deltaFromTarget > 0) === (b.deltaFromTarget > 0) ? 0 : a.deltaFromTarget > 0 ? 1 : -1) || a.quote.rate - b.quote.rate || a.quote.engine.localeCompare(b.quote.engine))[0].quote;
}
type EngineQuoteLike = Omit<Stage1ExecutionQuote, 'engine'> & { program?: string };
function toQuote(engine: Stage1ExecutionQuote['engine'], quote: EngineQuoteLike): Stage1ExecutionQuote { return { engine, program: quote.program ?? engine, product: quote.product, maxAvailable: quote.maxAvailable, rate: quote.rate, noteRate: quote.noteRate, monthlyPayment: quote.monthlyPayment, maxLtv: quote.maxLtv, purchasePrice: quote.purchasePrice, basePrice: quote.basePrice, llpaAdjustment: quote.llpaAdjustment, adjustments: quote.adjustments }; }

function buildTargetPriceLadder(requestedRates: number[], getQuoteForRate: (rateOverride?: number) => Stage1ExecutionQuote, highlightedQuote: Stage1ExecutionQuote, referencePrice: number, displayTargetPrice: number, maxPrice: number): InvestorPriceLadderRow[] {
  const rows = new Map<string, InvestorPriceLadderRow>();

  for (const requestedRate of requestedRates) {
    const quote = getQuoteForRate(requestedRate);
    if (maxPrice > 0 && quote.purchasePrice > maxPrice + 0.0001) continue;
    const displayMaxPrice = maxPrice > 0 ? roundToThree(displayTargetPrice + (maxPrice - referencePrice)) : 103;
    const displayPrice = roundToThree(displayTargetPrice + (quote.purchasePrice - referencePrice));
    if (displayPrice < 97 || displayPrice > Math.min(103, displayMaxPrice)) continue;

    const pointsDelta = roundToThree(displayTargetPrice - displayPrice);
    const key = `${quote.rate}|${quote.noteRate}|${quote.purchasePrice}`;
    rows.set(key, {
      displayPrice,
      purchasePrice: quote.purchasePrice,
      rate: quote.rate,
      noteRate: quote.noteRate,
      pointsLabel: pointsDelta >= 0 ? 'Discount' : 'Rebate',
      pointsValue: roundBorrowerPoints(pointsDelta),
      highlighted: Math.abs(quote.rate - highlightedQuote.rate) < 0.0001 && Math.abs(quote.purchasePrice - highlightedQuote.purchasePrice) < 0.0001,
    });
  }

  return [...rows.values()].sort((a, b) => a.rate - b.rate || a.noteRate - b.noteRate || a.displayPrice - b.displayPrice);
}

function mapBestExDocTypeToButton(docType: BestExDocType, product: 'HELOC' | 'CES'): ButtonDocType | null {
  if (docType === 'Full Doc') return 'Full Doc';
  if (product === 'HELOC') return null;
  if (docType === '12 Month Bank Statement') return '12 Month Bank Statement';
  if (docType === '24 Month Bank Statement' || docType === 'Bank Statement') return '24 Month Bank Statement';
  if (docType === 'Asset Depletion') return 'Asset Depletion';
  return null;
}

function mapBestExDocTypeToVista(docType: BestExDocType): VistaDocType {
  if (docType === '12 Month Bank Statement' || docType === '24 Month Bank Statement') return 'Bank Statement';
  return docType;
}

function mapBestExDocTypeToVerus(docType: BestExDocType, product: 'CES' | 'HELOC'): 'Standard' | 'Alt Doc' | null {
  if (docType === 'Full Doc') return 'Standard';
  if (docType === '12 Month Bank Statement' || docType === '24 Month Bank Statement' || docType === 'Bank Statement') return 'Alt Doc';
  if (product === 'CES' && (docType === '1099' || docType === 'P&L Only' || docType === 'WVOE')) return 'Alt Doc';
  return null;
}

function mapBestExDocTypeToOsb(docType: BestExDocType): SharedDocType | null {
  return docType === 'Full Doc' ? 'Full Doc' : null;
}

function mapBestExDocTypeToDeephaven(docType: BestExDocType): DeephavenDocType | null {
  if (docType === 'Full Doc') return 'Full Doc';
  if (docType === '12 Month Bank Statement' || docType === '24 Month Bank Statement' || docType === 'Bank Statement') return 'Bank Statement';
  if (docType === 'P&L Only') return 'P&L Only';
  return null;
}

function mapInvestorLabelToRuleInvestor(investorLabel: string): InvestorName | null {
  if (investorLabel === 'OSB') return 'Onslow';
  if (investorLabel === 'Arc Home') return 'Arc';
  if (investorLabel === 'Deephaven') return 'DeepHaven';
  if (investorLabel === 'Button' || investorLabel === 'Vista' || investorLabel === 'NewRez' || investorLabel === 'Verus') return investorLabel;
  return null;
}

function applyAvmOverlay(eligibility: Stage1Eligibility, investorLabel: string, input: TesterInput): Stage1Eligibility {
  const verificationProvider = input.verificationProvider;
  const verificationFsd = Number(input.verificationFsd);
  if (!verificationProvider || !Number.isFinite(verificationFsd)) {
    return { ...eligibility, avmEvaluation: null };
  }

  const investor = mapInvestorLabelToRuleInvestor(investorLabel);
  if (!investor) {
    return { ...eligibility, avmEvaluation: null };
  }

  const avmEvaluation = evaluateInvestorAvmRule(investor, verificationProvider, verificationFsd);
  if (avmEvaluation.passes) {
    return { ...eligibility, avmEvaluation };
  }

  const existingReasons = eligibility.reasons.includes(avmEvaluation.reason || '')
    ? eligibility.reasons
    : [...eligibility.reasons, avmEvaluation.reason || 'AVM confidence rule failed.'];

  return {
    ...eligibility,
    eligible: false,
    reasons: existingReasons,
    avmEvaluation,
  };
}

function sortResults(results: InvestorSummary[], effectiveManualRateOverride: number | undefined) {
  results.sort((a, b) => {
    const eligibilityOrder = (a.eligibility.eligible === b.eligibility.eligible ? 0 : a.eligibility.eligible ? -1 : 1);
    if (eligibilityOrder !== 0) return eligibilityOrder;

    if (effectiveManualRateOverride !== undefined && a.eligibility.eligible && b.eligibility.eligible) {
      return b.buyPrice - a.buyPrice || b.quote.purchasePrice - a.quote.purchasePrice || a.investor.localeCompare(b.investor);
    }

    const windowOrder = (a.windowMatched === b.windowMatched ? 0 : a.windowMatched ? -1 : 1);
    if (windowOrder !== 0) return windowOrder;

    if (a.windowMatched && b.windowMatched) {
      return a.quote.rate - b.quote.rate
        || a.discountPoints - b.discountPoints
        || a.investor.localeCompare(b.investor);
    }

    if (a.eligibility.eligible && b.eligibility.eligible) {
      return a.quote.rate - b.quote.rate
        || a.discountPoints - b.discountPoints
        || a.investor.localeCompare(b.investor);
    }

    return a.investor.localeCompare(b.investor);
  });
}

function getActiveResult(engine: PricingViewEngine, input: TesterInput, effectiveTargetPrice: number, effectiveManualRateOverride: number | undefined, tolerance: number, hasTargetPriceOverride: boolean): Stage1PricingEngineResult | null {
  if (engine === 'BestX') return null;
  if (engine === 'Button') {
    const eligibility = evaluateButtonStage1Eligibility(input as ButtonStage1Input, input.desiredLoanAmount);
    const baseQuote = calculateButtonStage1Quote(input as ButtonStage1Input, { selectedLoanAmount: input.desiredLoanAmount, rateOverride: effectiveManualRateOverride, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears, lockPeriodDays: 60 });
    const targetQuote = solveButtonStage1TargetRate(input as ButtonStage1Input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears, lockPeriodDays: 60 });
    const maxPrice = solveButtonStage1TargetRate(input as ButtonStage1Input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears, lockPeriodDays: 60 }).purchasePrice;
    const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Button', toQuote('Button', { ...baseQuote, program: 'Button', product: String(input.buttonProduct || 'HELOC') }), buildRequestedRates(3, 20), rateOverride => toQuote('Button', { ...calculateButtonStage1Quote(input as ButtonStage1Input, { selectedLoanAmount: input.desiredLoanAmount, rateOverride, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears, lockPeriodDays: 60 }), program: 'Button', product: String(input.buttonProduct || 'HELOC') }), effectiveTargetPrice, maxPrice, hasTargetPriceOverride);
    return { eligibility, quote: toQuote('Button', { ...displayQuote, program: 'Button', product: String(input.buttonProduct || 'HELOC') }), targetQuote: { ...toQuote('Button', { ...targetQuote, program: 'Button', product: String(input.buttonProduct || 'HELOC') }), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice };
  }
  if (engine === 'Arc Home') { const eligibility = evaluateArcHomeStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateArcHomeStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveArcHomeStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const maxPrice = solveArcHomeStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice; const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Arc Home', toQuote('Arc Home', baseQuote), buildRequestedRates(7.25, 9.375), rateOverride => toQuote('Arc Home', calculateArcHomeStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice, maxPrice, hasTargetPriceOverride); return { eligibility, quote: toQuote('Arc Home', displayQuote), targetQuote: { ...toQuote('Arc Home', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice }; }
  if (engine === 'Vista') { const eligibility = evaluateVistaStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateVistaStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveVistaStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const maxPrice = solveVistaStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice; const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Vista', toQuote('Vista', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('Vista', calculateVistaStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice, maxPrice, hasTargetPriceOverride); return { eligibility, quote: toQuote('Vista', displayQuote), targetQuote: { ...toQuote('Vista', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice }; }
  if (engine === 'NewRez') { const eligibility = evaluateNewRezStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateNewRezStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveNewRezStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const maxPrice = solveNewRezStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice; const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('NewRez', toQuote('NewRez', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('NewRez', calculateNewRezStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice, maxPrice, hasTargetPriceOverride); return { eligibility, quote: toQuote('NewRez', displayQuote), targetQuote: { ...toQuote('NewRez', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice }; }
  if (engine === 'Verus') { const eligibility = evaluateVerusStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateVerusStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveVerusStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const maxPrice = solveVerusStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice; const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Verus', toQuote('Verus', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('Verus', calculateVerusStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice, maxPrice, hasTargetPriceOverride); return { eligibility, quote: toQuote('Verus', displayQuote), targetQuote: { ...toQuote('Verus', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice }; }
  if (engine === 'Deephaven') { const eligibility = evaluateDeephavenStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateDeephavenStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveDeephavenStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const maxPrice = solveDeephavenStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice; const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('Deephaven', toQuote('Deephaven', baseQuote), buildRequestedRates(3, 20), rateOverride => toQuote('Deephaven', calculateDeephavenStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice, maxPrice, hasTargetPriceOverride); return { eligibility, quote: toQuote('Deephaven', displayQuote), targetQuote: { ...toQuote('Deephaven', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice }; }
  const eligibility = evaluateOsbStage1Eligibility(input, input.desiredLoanAmount); const baseQuote = calculateOsbStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride: effectiveManualRateOverride }); const targetQuote = solveOsbStage1TargetRate(input, { targetPrice: effectiveTargetPrice, tolerance, selectedLoanAmount: input.desiredLoanAmount }); const maxPrice = solveOsbStage1TargetRate(input, { targetPrice: 999, tolerance, selectedLoanAmount: input.desiredLoanAmount }).purchasePrice; const displayQuote = effectiveManualRateOverride !== undefined ? baseQuote : chooseDisplayQuote('OSB', toQuote('OSB', baseQuote), input.osbProgram === 'HELOC' ? buildRequestedRates(0.5, 8) : buildRequestedRates(3, 20), rateOverride => toQuote('OSB', calculateOsbStage1Quote(input, { selectedLoanAmount: input.desiredLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), effectiveTargetPrice, maxPrice, hasTargetPriceOverride); return { eligibility, quote: toQuote('OSB', displayQuote), targetQuote: { ...toQuote('OSB', targetQuote), targetPrice: targetQuote.targetPrice, tolerance: targetQuote.tolerance, deltaFromTarget: targetQuote.deltaFromTarget, withinTolerance: targetQuote.withinTolerance, withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage }, maxPrice };
}

export function computeStage1Pricing(request: Stage1PricingRequest): Stage1PricingResponse {
  const { engine, input } = request;
  const tolerance = request.tolerance ?? 0.125;
  const defaultBackendTargetPrice = getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0));
  const parsedTargetPriceOverride = request.targetPriceOverride?.trim()
    ? (Number.isFinite(Number(request.targetPriceOverride)) ? Number(request.targetPriceOverride) : undefined)
    : undefined;
  const hasTargetPriceOverride = parsedTargetPriceOverride !== undefined;
  const displayTargetPrice = parsedTargetPriceOverride ?? defaultBackendTargetPrice;
  const effectiveTargetPrice = hasTargetPriceOverride
    ? roundToThree(defaultBackendTargetPrice + (100 - displayTargetPrice))
    : defaultBackendTargetPrice;
  const effectiveManualRateOverride = request.manualRateOverride?.trim() ? (Number.isFinite(Number(request.manualRateOverride)) ? Number(request.manualRateOverride) : undefined) : undefined;
  const rawActiveResult = getActiveResult(engine, input, effectiveTargetPrice, effectiveManualRateOverride, tolerance, hasTargetPriceOverride);
  const activeResult = rawActiveResult
    ? {
        ...rawActiveResult,
        eligibility: applyAvmOverlay(rawActiveResult.eligibility, rawActiveResult.quote.engine, input),
      }
    : null;

  const selectedLoanAmount = Number(input.desiredLoanAmount || 0);
  const bestExProduct = input.bestExProduct ?? 'HELOC';
  const bestExDrawPeriodYears = input.bestExDrawPeriodYears ?? 5;
  const bestExTermYears = input.bestExTermYears ?? 30;
  const bestExLockPeriodDays = input.bestExLockPeriodDays ?? 30;
  const bestExDocType = input.bestExDocType ?? 'Full Doc';
  const actualLockPeriodDays = bestExLockPeriodDays + 30;
  const makeSummary = (eligibility: Stage1Eligibility, quote: Stage1ExecutionQuote, maxPrice: number, requestedRates: number[], getQuoteForRate: (rateOverride?: number) => Stage1ExecutionQuote): InvestorSummary => { const overlaidEligibility = applyAvmOverlay(eligibility, quote.engine, input); const selectionTarget = getBestXSelectionTarget(effectiveTargetPrice, maxPrice, hasTargetPriceOverride); const bestExWindowLowerBound = roundToThree(selectionTarget - BEST_EX_WINDOW_FLOOR); const bestExWindowUpperBound = roundToThree(selectionTarget + BEST_EX_WINDOW_CEILING); const rawDiscountPoints = effectiveTargetPrice - quote.purchasePrice; const discountPoints = roundBorrowerPoints(rawDiscountPoints); const buyPrice = 0; const deltaFromTarget = roundToThree(quote.purchasePrice - effectiveTargetPrice); const respectsMaxPrice = maxPrice <= 0 || quote.purchasePrice <= maxPrice + 0.0001; const windowMatched = overlaidEligibility.eligible && respectsMaxPrice && quote.purchasePrice >= bestExWindowLowerBound && quote.purchasePrice <= bestExWindowUpperBound; return { investor: quote.engine, eligibility: overlaidEligibility, quote, discountPoints, buyPrice, windowMatched, deltaFromTarget, targetPrice: displayTargetPrice, maxPrice, priceLadder: buildTargetPriceLadder(requestedRates, getQuoteForRate, quote, effectiveTargetPrice, displayTargetPrice, maxPrice) }; };
  const makeIneligible = (investor: Stage1ExecutionQuote['engine'], program: string, product: string, reason: string, maxPrice = 0): InvestorSummary => ({ investor, eligibility: applyAvmOverlay({ eligible: false, reasons: [reason], maxAvailable: 0, resultingCltv: 0, avmEvaluation: null }, investor, input), quote: { engine: investor, program, product, maxAvailable: 0, rate: 0, noteRate: 0, monthlyPayment: 0, maxLtv: 0, purchasePrice: 0, basePrice: 0, llpaAdjustment: 0, adjustments: [] }, discountPoints: 0, buyPrice: 0, windowMatched: false, deltaFromTarget: 0, targetPrice: defaultBackendTargetPrice, maxPrice, priceLadder: [] });
  const chooseBestXSummary = (eligibility: Stage1Eligibility, fallbackQuote: Stage1ExecutionQuote, requestedRates: number[], getQuote: (rateOverride?: number) => Stage1ExecutionQuote, maxPrice: number): InvestorSummary => {
    if (!eligibility.eligible) return makeSummary(eligibility, fallbackQuote, maxPrice, requestedRates, getQuote);
    const respectsMax = (summary: InvestorSummary) => summary.maxPrice <= 0 || summary.quote.purchasePrice <= summary.maxPrice + 0.0001;
    if (effectiveManualRateOverride !== undefined) {
      const manualSummary = makeSummary(eligibility, getQuote(effectiveManualRateOverride), maxPrice, requestedRates, getQuote);
      return respectsMax(manualSummary) ? manualSummary : makeSummary(eligibility, fallbackQuote, maxPrice, requestedRates, getQuote);
    }
    const candidates = new Map<string, InvestorSummary>();
    for (const requestedRate of requestedRates) {
      const summary = makeSummary(eligibility, getQuote(requestedRate), maxPrice, requestedRates, getQuote);
      candidates.set(`${summary.quote.rate}|${summary.quote.purchasePrice}|${summary.quote.product}`, summary);
    }
    const allCandidates = candidates.size ? [...candidates.values()] : [makeSummary(eligibility, fallbackQuote, maxPrice, requestedRates, getQuote)];
    const cappedCandidates = allCandidates.filter(respectsMax);
    const usableCandidates = cappedCandidates.length > 0 ? cappedCandidates : allCandidates;
    const windowCandidates = usableCandidates.filter(summary => summary.windowMatched);
    if (windowCandidates.length > 0) {
      return [...windowCandidates].sort((a, b) => a.quote.rate - b.quote.rate || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || ((a.deltaFromTarget > 0) === (b.deltaFromTarget > 0) ? 0 : a.deltaFromTarget > 0 ? 1 : -1) || a.discountPoints - b.discountPoints || a.investor.localeCompare(b.investor))[0];
    }
    return [...usableCandidates].sort((a, b) => distanceToBestExWindow(a.quote.purchasePrice, roundToThree(getBestXSelectionTarget(effectiveTargetPrice, a.maxPrice, hasTargetPriceOverride) - BEST_EX_WINDOW_FLOOR), roundToThree(getBestXSelectionTarget(effectiveTargetPrice, a.maxPrice, hasTargetPriceOverride) + BEST_EX_WINDOW_CEILING)) - distanceToBestExWindow(b.quote.purchasePrice, roundToThree(getBestXSelectionTarget(effectiveTargetPrice, b.maxPrice, hasTargetPriceOverride) - BEST_EX_WINDOW_FLOOR), roundToThree(getBestXSelectionTarget(effectiveTargetPrice, b.maxPrice, hasTargetPriceOverride) + BEST_EX_WINDOW_CEILING)) || Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget) || ((a.deltaFromTarget > 0) === (b.deltaFromTarget > 0) ? 0 : a.deltaFromTarget > 0 ? 1 : -1) || a.quote.rate - b.quote.rate || a.discountPoints - b.discountPoints || a.investor.localeCompare(b.investor))[0];
  };
  const standardRequestedRates = buildRequestedRates(3, 20); const osbHelocRequestedRates = buildRequestedRates(0.5, 8); const results: InvestorSummary[] = [];

  if (bestExProduct === 'HELOC') {
    const buttonDocType = mapBestExDocTypeToButton(bestExDocType, 'HELOC');
    if (!buttonDocType) results.push(makeIneligible('Button', 'Button', 'HELOC', `Button does not support ${bestExDocType} pricing for HELOC.`));
    else {
      const buttonInput = { ...input, buttonProduct: 'HELOC' as const, helocDrawTermYears: bestExDrawPeriodYears, buttonDocType };
      const buttonEligibility = evaluateButtonStage1Eligibility(buttonInput as ButtonStage1Input, selectedLoanAmount);
      const buttonBaseQuote = calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears, lockPeriodDays: actualLockPeriodDays });
      const buttonMaxPrice = solveButtonStage1TargetRate(buttonInput as ButtonStage1Input, { targetPrice: 999, tolerance, selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears, lockPeriodDays: actualLockPeriodDays }).purchasePrice;
      results.push(chooseBestXSummary(buttonEligibility, toQuote('Button', { ...buttonBaseQuote, program: 'Button', product: 'HELOC' }), standardRequestedRates, rateOverride => toQuote('Button', { ...calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears, rateOverride, lockPeriodDays: actualLockPeriodDays }), program: 'Button', product: 'HELOC' }), buttonMaxPrice));
    }
    results.push(makeIneligible('Vista', 'CES Only', 'HELOC', 'Vista only supports CES pricing in Best Ex.'));
    results.push(makeIneligible('NewRez', 'CES Only', 'HELOC', 'NewRez only supports CES pricing in Best Ex.'));
    results.push(makeIneligible('Deephaven', 'CES Only', 'HELOC', 'Deephaven only supports CES pricing in Best Ex.'));
    const osbDocType = mapBestExDocTypeToOsb(bestExDocType);
    if (!osbDocType) results.push(makeIneligible('OSB', 'HELOC', '30 Year Maturity', `OSB does not support ${bestExDocType} pricing in this engine.`));
    else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) results.push(makeIneligible('OSB', 'HELOC', '30 Year Maturity', `OSB HELOC only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
    else { const osbInput = { ...input, osbProgram: 'HELOC' as const, osbProduct: '30 Year Maturity' as const, osbDocType: osbDocType ?? 'Full Doc', osbLockPeriodDays: actualLockPeriodDays as OsbLockPeriod, helocDrawTermYears: bestExDrawPeriodYears }; const eligibility = evaluateOsbStage1Eligibility(osbInput, selectedLoanAmount); const baseQuote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveOsbStage1TargetRate(osbInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('OSB', baseQuote), osbHelocRequestedRates, rateOverride => toQuote('OSB', calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
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
      const buttonBaseQuote = calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, cesTermYears: bestExTermYears, lockPeriodDays: actualLockPeriodDays });
      const buttonMaxPrice = solveButtonStage1TargetRate(buttonInput as ButtonStage1Input, { targetPrice: 999, tolerance, selectedLoanAmount, cesTermYears: bestExTermYears, lockPeriodDays: actualLockPeriodDays }).purchasePrice;
      results.push(chooseBestXSummary(buttonEligibility, toQuote('Button', { ...buttonBaseQuote, program: 'Button', product: 'CES' }), standardRequestedRates, rateOverride => toQuote('Button', { ...calculateButtonStage1Quote(buttonInput as ButtonStage1Input, { selectedLoanAmount, cesTermYears: bestExTermYears, rateOverride, lockPeriodDays: actualLockPeriodDays }), program: 'Button', product: 'CES' }), buttonMaxPrice));
    }
    const vistaProducts: Partial<Record<BestExTermYears, TesterInput['vistaProduct']>> = { 10: '10yr Fixed', 15: '15yr Fixed', 20: '20yr Fixed', 30: '30yr Fixed' };
    const vistaProduct = vistaProducts[bestExTermYears];
    if (!vistaProduct) results.push(makeIneligible('Vista', 'CES', `${bestExTermYears} Year`, `Vista does not support ${bestExTermYears}-year CES pricing.`));
    else { const vistaInput = { ...input, vistaProduct, vistaDocType: mapBestExDocTypeToVista(bestExDocType) }; const eligibility = evaluateVistaStage1Eligibility(vistaInput, selectedLoanAmount); const baseQuote = calculateVistaStage1Quote(vistaInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveVistaStage1TargetRate(vistaInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('Vista', baseQuote), standardRequestedRates, rateOverride => toQuote('Vista', calculateVistaStage1Quote(vistaInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
    const newrezProducts: Partial<Record<BestExTermYears, TesterInput['newrezProduct']>> = { 15: '15 Year Fixed', 20: '20 Year Fixed', 30: '30 Year Fixed' };
    const newrezProduct = newrezProducts[bestExTermYears];
    if (!newrezProduct) results.push(makeIneligible('NewRez', 'CES', `${bestExTermYears} Year`, `NewRez does not support ${bestExTermYears}-year CES pricing.`));
    else if (bestExDocType !== 'Full Doc') results.push(makeIneligible('NewRez', 'CES', newrezProduct, 'NewRez does not support alt-doc pricing in the Home Equity workbook.'));
    else { const newrezLockPeriodDays = (actualLockPeriodDays - 30) as 15 | 30 | 45 | 60; const newrezInput = { ...input, newrezProduct, newrezLockPeriodDays }; const eligibility = evaluateNewRezStage1Eligibility(newrezInput, selectedLoanAmount); const baseQuote = calculateNewRezStage1Quote(newrezInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveNewRezStage1TargetRate(newrezInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; const newrezRateBounds = getNewRezRateBounds(newrezProduct, newrezLockPeriodDays); const newrezRequestedRates = newrezRateBounds ? buildRequestedRates(newrezRateBounds.minRate, newrezRateBounds.maxRate) : standardRequestedRates; results.push(chooseBestXSummary(eligibility, toQuote('NewRez', baseQuote), newrezRequestedRates, rateOverride => toQuote('NewRez', calculateNewRezStage1Quote(newrezInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
    const osbProducts: Partial<Record<BestExTermYears, TesterInput['osbProduct']>> = { 10: 'Fixed 10', 15: 'Fixed 15', 20: 'Fixed 20', 30: 'Fixed 30' };
    const osbProduct = osbProducts[bestExTermYears];
    const osbDocType = mapBestExDocTypeToOsb(bestExDocType);
    if (!osbProduct) results.push(makeIneligible('OSB', '2nd Liens', `${bestExTermYears} Year`, `OSB does not support ${bestExTermYears}-year CES pricing.`));
    else if (!osbDocType) results.push(makeIneligible('OSB', '2nd Liens', osbProduct, `OSB does not support ${bestExDocType} pricing in this engine.`));
    else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) results.push(makeIneligible('OSB', '2nd Liens', osbProduct, `OSB only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
    else { const osbInput = { ...input, osbProgram: '2nd Liens' as const, osbProduct, osbDocType: osbDocType ?? 'Full Doc', osbLockPeriodDays: actualLockPeriodDays as OsbLockPeriod }; const eligibility = evaluateOsbStage1Eligibility(osbInput, selectedLoanAmount); const baseQuote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveOsbStage1TargetRate(osbInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('OSB', baseQuote), standardRequestedRates, rateOverride => toQuote('OSB', calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
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
    else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) results.push(makeIneligible('Deephaven', 'Equity Advantage / Elite', deephavenProduct, `Deephaven only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
    else { const deephavenLockPeriodDays = (actualLockPeriodDays === 45 ? 15 : 30) as 15 | 30; const deephavenInput = { ...input, deephavenProduct, deephavenDocType, deephavenLockPeriodDays }; const eligibility = evaluateDeephavenStage1Eligibility(deephavenInput, selectedLoanAmount); const baseQuote = calculateDeephavenStage1Quote(deephavenInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice }); const maxPrice = solveDeephavenStage1TargetRate(deephavenInput, { targetPrice: 999, tolerance, selectedLoanAmount }).purchasePrice; results.push(chooseBestXSummary(eligibility, toQuote('Deephaven', baseQuote), standardRequestedRates, rateOverride => toQuote('Deephaven', calculateDeephavenStage1Quote(deephavenInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride })), maxPrice)); }
  }

  sortResults(results, effectiveManualRateOverride);
  return { defaultBackendTargetPrice, effectiveTargetPrice, activeResult, results };
}
