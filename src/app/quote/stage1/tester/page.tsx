'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateButtonStage1Quote, evaluateButtonStage1Eligibility, getTargetPurchasePriceForLoanAmount, solveButtonStage1TargetRate, type ButtonStage1Input } from '@/lib/rates/button';
import { calculateNewRezStage1Quote, evaluateNewRezStage1Eligibility, solveNewRezStage1TargetRate, type NewRezProduct } from '@/lib/rates/newrez';
import { calculateDeephavenStage1Quote, evaluateDeephavenStage1Eligibility, solveDeephavenStage1TargetRate, type DeephavenProduct, type DeephavenProgram } from '@/lib/rates/deephaven';
import { buildOsbStage1PricingInput, calculateOsbStage1Quote, evaluateOsbStage1Eligibility, solveOsbStage1TargetRate, type OsbLockPeriod, type OsbProduct, type OsbProgram } from '@/lib/rates/osb';
import { type Stage1Eligibility, type Stage1ExecutionQuote, type Stage1PricingEngineResult } from '@/lib/rates/shared';
import { calculateVerusStage1Quote, evaluateVerusStage1Eligibility, solveVerusStage1TargetRate, type VerusDocType, type VerusDrawPeriodYears, type VerusLockPeriodDays, type VerusProduct, type VerusProgram } from '@/lib/rates/verus';
import { calculateVistaStage1Quote, evaluateVistaStage1Eligibility, solveVistaStage1TargetRate, type VistaProduct } from '@/lib/rates/vista';

type TesterInput = ButtonStage1Input & {
  vistaProduct?: VistaProduct;
  newrezProduct?: NewRezProduct;
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
  helocDrawTermYears?: 3 | 5 | 10;
  buttonTermYears?: 10 | 15 | 20 | 25 | 30;
  bestExProduct?: BestExProduct;
  bestExDrawPeriodYears?: BestExDrawPeriodYears;
  bestExTermYears?: BestExTermYears;
  bestExLockPeriodDays?: BestExLockPeriodDays;
  bestExDocType?: VerusDocType;
};

type InvestorSummary = {
  investor: string;
  eligibility: Stage1Eligibility;
  quote: Stage1ExecutionQuote;
  discountPoints: number;
  buyPrice: number;
  windowMatched: boolean;
  deltaFromTarget: number;
};

type BestExProduct = 'HELOC' | 'CES';
type BestExDrawPeriodYears = 3 | 5 | 10;
type BestExTermYears = 10 | 15 | 25 | 30;
type BestExLockPeriodDays = 15 | 30 | 45;

const BEST_EX_WINDOW_FLOOR = 0.375;
const BEST_EX_WINDOW_CEILING = 0.125;

function roundToThree(value: number) {
  return Number(value.toFixed(3));
}

function buildRequestedRates(min: number, max: number, step = 0.125) {
  const values: number[] = [];
  for (let rate = min; rate <= max + 0.0001; rate += step) {
    values.push(roundToThree(rate));
  }
  return values;
}

function distanceToBestExWindow(deltaFromTarget: number) {
  if (deltaFromTarget < -BEST_EX_WINDOW_FLOOR) return roundToThree((-BEST_EX_WINDOW_FLOOR) - deltaFromTarget);
  if (deltaFromTarget > BEST_EX_WINDOW_CEILING) return roundToThree(deltaFromTarget - BEST_EX_WINDOW_CEILING);
  return 0;
}

const TESTER_GATE_STORAGE_KEY = 'fal-stage1-tester-unlocked';
const TESTER_GATE_PASSWORD = 'faltester';

const defaultInput: TesterInput = {
  buttonProduct: 'HELOC',
  vistaProduct: '30yr Fixed',
  newrezProduct: '30 Year Fixed',
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
  helocDrawTermYears: 5,
  buttonTermYears: 20,
  bestExProduct: 'HELOC',
  bestExDrawPeriodYears: 5,
  bestExTermYears: 30,
  bestExLockPeriodDays: 45,
  bestExDocType: 'Standard',
  propertyState: 'CA',
  propertyValue: 750000,
  loanBalance: 250000,
  desiredLoanAmount: 100000,
  creditScore: 740,
  occupancy: 'Owner-Occupied',
  structureType: 'SFR',
  numberOfUnits: 1,
  cashOut: true,
};

export default function Stage1TesterPage() {
  const [gateChecked, setGateChecked] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [engine, setEngine] = useState<'BestX' | 'Button' | 'Vista' | 'OSB' | 'NewRez' | 'Verus' | 'Deephaven'>('BestX');
  const [input, setInput] = useState<TesterInput>(defaultInput);
  const [targetPriceOverride, setTargetPriceOverride] = useState<string>('');
  const [manualRateOverride, setManualRateOverride] = useState<string>('');
  const [tolerance, setTolerance] = useState(0.125);

  useEffect(() => {
    const unlocked = window.localStorage.getItem(TESTER_GATE_STORAGE_KEY) === 'true';
    setIsUnlocked(unlocked);
    setGateChecked(true);
  }, []);

  const effectiveTargetPrice = useMemo(() => {
    if (targetPriceOverride.trim()) return Number(targetPriceOverride);
    return getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0));
  }, [input.desiredLoanAmount, targetPriceOverride]);

  const effectiveManualRateOverride = useMemo(() => {
    if (!manualRateOverride.trim()) return undefined;
    const parsed = Number(manualRateOverride);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [manualRateOverride]);

  const activeResult = useMemo<Stage1PricingEngineResult | null>(() => {
    if (engine === 'BestX') {
      return null;
    }

    if (engine === 'Button') {
      const eligibility = evaluateButtonStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateButtonStage1Quote(input, {
        selectedLoanAmount: input.desiredLoanAmount,
        rateOverride: effectiveManualRateOverride,
        cesTermYears: input.buttonTermYears,
        helocDrawTermYears: input.helocDrawTermYears,
      });
      const targetQuote = solveButtonStage1TargetRate(input, {
        targetPrice: effectiveTargetPrice,
        tolerance,
        selectedLoanAmount: input.desiredLoanAmount,
        cesTermYears: input.buttonTermYears,
        helocDrawTermYears: input.helocDrawTermYears,
      });

      return {
        eligibility,
        quote: {
          engine: 'Button',
          program: 'Button',
          product: String(input.buttonProduct || 'HELOC'),
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: quote.adjustments,
        },
        targetQuote: {
          engine: 'Button',
          program: 'Button',
          product: String(input.buttonProduct || 'HELOC'),
          maxAvailable: targetQuote.maxAvailable,
          rate: targetQuote.rate,
          noteRate: targetQuote.noteRate,
          monthlyPayment: targetQuote.monthlyPayment,
          maxLtv: targetQuote.maxLtv,
          purchasePrice: targetQuote.purchasePrice,
          basePrice: targetQuote.basePrice,
          llpaAdjustment: targetQuote.llpaAdjustment,
          adjustments: targetQuote.adjustments,
          targetPrice: targetQuote.targetPrice,
          tolerance: targetQuote.tolerance,
          deltaFromTarget: targetQuote.deltaFromTarget,
          withinTolerance: targetQuote.withinTolerance,
          withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage,
        },
      };
    }

    if (engine === 'Vista') {
      const eligibility = evaluateVistaStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateVistaStage1Quote(input, {
        selectedLoanAmount: input.desiredLoanAmount,
        targetPrice: effectiveTargetPrice,
        rateOverride: effectiveManualRateOverride,
      });
      const targetQuote = solveVistaStage1TargetRate(input, {
        targetPrice: effectiveTargetPrice,
        tolerance,
        selectedLoanAmount: input.desiredLoanAmount,
      });

      return {
        eligibility,
        quote: {
          engine: 'Vista',
          program: quote.program,
          product: quote.product,
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: quote.adjustments,
        },
        targetQuote: {
          engine: 'Vista',
          program: targetQuote.program,
          product: targetQuote.product,
          maxAvailable: targetQuote.maxAvailable,
          rate: targetQuote.rate,
          noteRate: targetQuote.noteRate,
          monthlyPayment: targetQuote.monthlyPayment,
          maxLtv: targetQuote.maxLtv,
          purchasePrice: targetQuote.purchasePrice,
          basePrice: targetQuote.basePrice,
          llpaAdjustment: targetQuote.llpaAdjustment,
          adjustments: targetQuote.adjustments,
          targetPrice: targetQuote.targetPrice,
          tolerance: targetQuote.tolerance,
          deltaFromTarget: targetQuote.deltaFromTarget,
          withinTolerance: targetQuote.withinTolerance,
          withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage,
        },
      };
    }

    if (engine === 'NewRez') {
      const eligibility = evaluateNewRezStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateNewRezStage1Quote(input, {
        selectedLoanAmount: input.desiredLoanAmount,
        targetPrice: effectiveTargetPrice,
        rateOverride: effectiveManualRateOverride,
      });
      const targetQuote = solveNewRezStage1TargetRate(input, {
        targetPrice: effectiveTargetPrice,
        tolerance,
        selectedLoanAmount: input.desiredLoanAmount,
      });

      return {
        eligibility,
        quote: {
          engine: 'NewRez',
          program: quote.program,
          product: quote.product,
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: quote.adjustments,
        },
        targetQuote: {
          engine: 'NewRez',
          program: targetQuote.program,
          product: targetQuote.product,
          maxAvailable: targetQuote.maxAvailable,
          rate: targetQuote.rate,
          noteRate: targetQuote.noteRate,
          monthlyPayment: targetQuote.monthlyPayment,
          maxLtv: targetQuote.maxLtv,
          purchasePrice: targetQuote.purchasePrice,
          basePrice: targetQuote.basePrice,
          llpaAdjustment: targetQuote.llpaAdjustment,
          adjustments: targetQuote.adjustments,
          targetPrice: targetQuote.targetPrice,
          tolerance: targetQuote.tolerance,
          deltaFromTarget: targetQuote.deltaFromTarget,
          withinTolerance: targetQuote.withinTolerance,
          withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage,
        },
      };
    }

    if (engine === 'Verus') {
      const eligibility = evaluateVerusStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateVerusStage1Quote(input, {
        selectedLoanAmount: input.desiredLoanAmount,
        targetPrice: effectiveTargetPrice,
        rateOverride: effectiveManualRateOverride,
      });
      const targetQuote = solveVerusStage1TargetRate(input, {
        targetPrice: effectiveTargetPrice,
        tolerance,
        selectedLoanAmount: input.desiredLoanAmount,
      });

      return {
        eligibility,
        quote: {
          engine: 'Verus',
          program: quote.program,
          product: quote.product,
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: quote.adjustments,
        },
        targetQuote: {
          engine: 'Verus',
          program: targetQuote.program,
          product: targetQuote.product,
          maxAvailable: targetQuote.maxAvailable,
          rate: targetQuote.rate,
          noteRate: targetQuote.noteRate,
          monthlyPayment: targetQuote.monthlyPayment,
          maxLtv: targetQuote.maxLtv,
          purchasePrice: targetQuote.purchasePrice,
          basePrice: targetQuote.basePrice,
          llpaAdjustment: targetQuote.llpaAdjustment,
          adjustments: targetQuote.adjustments,
          targetPrice: targetQuote.targetPrice,
          tolerance: targetQuote.tolerance,
          deltaFromTarget: targetQuote.deltaFromTarget,
          withinTolerance: targetQuote.withinTolerance,
          withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage,
        },
      };
    }

    if (engine === 'Deephaven') {
      const eligibility = evaluateDeephavenStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateDeephavenStage1Quote(input, {
        selectedLoanAmount: input.desiredLoanAmount,
        targetPrice: effectiveTargetPrice,
        rateOverride: effectiveManualRateOverride,
      });
      const targetQuote = solveDeephavenStage1TargetRate(input, {
        targetPrice: effectiveTargetPrice,
        tolerance,
        selectedLoanAmount: input.desiredLoanAmount,
      });

      return {
        eligibility,
        quote: {
          engine: 'Deephaven',
          program: quote.program,
          product: quote.product,
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: quote.adjustments,
        },
        targetQuote: {
          engine: 'Deephaven',
          program: targetQuote.program,
          product: targetQuote.product,
          maxAvailable: targetQuote.maxAvailable,
          rate: targetQuote.rate,
          noteRate: targetQuote.noteRate,
          monthlyPayment: targetQuote.monthlyPayment,
          maxLtv: targetQuote.maxLtv,
          purchasePrice: targetQuote.purchasePrice,
          basePrice: targetQuote.basePrice,
          llpaAdjustment: targetQuote.llpaAdjustment,
          adjustments: targetQuote.adjustments,
          targetPrice: targetQuote.targetPrice,
          tolerance: targetQuote.tolerance,
          deltaFromTarget: targetQuote.deltaFromTarget,
          withinTolerance: targetQuote.withinTolerance,
          withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage,
        },
      };
    }

    const eligibility = evaluateOsbStage1Eligibility(input, input.desiredLoanAmount);
    const quote = calculateOsbStage1Quote(input, {
      selectedLoanAmount: input.desiredLoanAmount,
      targetPrice: effectiveTargetPrice,
      rateOverride: effectiveManualRateOverride,
    });
    const targetQuote = solveOsbStage1TargetRate(input, {
      targetPrice: effectiveTargetPrice,
      tolerance,
      selectedLoanAmount: input.desiredLoanAmount,
    });

    return {
      eligibility,
      quote: {
        engine: 'OSB',
        program: quote.program,
        product: quote.product,
        maxAvailable: quote.maxAvailable,
        rate: quote.rate,
        noteRate: quote.noteRate,
        monthlyPayment: quote.monthlyPayment,
        maxLtv: quote.maxLtv,
        purchasePrice: quote.purchasePrice,
        basePrice: quote.basePrice,
        llpaAdjustment: quote.llpaAdjustment,
        adjustments: quote.adjustments,
      },
      targetQuote: {
        engine: 'OSB',
        program: targetQuote.program,
        product: targetQuote.product,
        maxAvailable: targetQuote.maxAvailable,
        rate: targetQuote.rate,
        noteRate: targetQuote.noteRate,
        monthlyPayment: targetQuote.monthlyPayment,
        maxLtv: targetQuote.maxLtv,
        purchasePrice: targetQuote.purchasePrice,
        basePrice: targetQuote.basePrice,
        llpaAdjustment: targetQuote.llpaAdjustment,
        adjustments: targetQuote.adjustments,
        targetPrice: targetQuote.targetPrice,
        tolerance: targetQuote.tolerance,
        deltaFromTarget: targetQuote.deltaFromTarget,
        withinTolerance: targetQuote.withinTolerance,
        withinToleranceAllowOverage: targetQuote.withinToleranceAllowOverage,
      },
    };
  }, [engine, input, effectiveTargetPrice, effectiveManualRateOverride, tolerance]);

  const results = useMemo<InvestorSummary[]>(() => {
    const selectedLoanAmount = Number(input.desiredLoanAmount || 0);
    const bestExProduct = input.bestExProduct ?? 'HELOC';
    const bestExDrawPeriodYears = input.bestExDrawPeriodYears ?? 5;
    const bestExTermYears = input.bestExTermYears ?? 30;
    const bestExLockPeriodDays = input.bestExLockPeriodDays ?? 45;
    const bestExDocType = input.bestExDocType ?? 'Standard';
    const actualLockPeriodDays = bestExLockPeriodDays + 30;

    const makeSummary = (eligibility: Stage1Eligibility, quote: Stage1ExecutionQuote): InvestorSummary => {
      const discountPoints = effectiveTargetPrice - quote.purchasePrice;
      const buyPrice = Number((100 - discountPoints).toFixed(3));
      const deltaFromTarget = roundToThree(quote.purchasePrice - effectiveTargetPrice);
      const windowMatched = eligibility.eligible && deltaFromTarget >= -BEST_EX_WINDOW_FLOOR && deltaFromTarget <= BEST_EX_WINDOW_CEILING;
      return { investor: quote.engine, eligibility, quote, discountPoints, buyPrice, windowMatched, deltaFromTarget };
    };

    const makeIneligible = (
      investor: Stage1ExecutionQuote['engine'],
      program: string,
      product: string,
      reason: string,
    ): InvestorSummary => ({
      investor,
      eligibility: {
        eligible: false,
        reasons: [reason],
        maxAvailable: 0,
        resultingCltv: 0,
      },
      quote: {
        engine: investor,
        program,
        product,
        maxAvailable: 0,
        rate: 0,
        noteRate: 0,
        monthlyPayment: 0,
        maxLtv: 0,
        purchasePrice: 0,
        basePrice: 0,
        llpaAdjustment: 0,
        adjustments: [],
      },
      discountPoints: 0,
      buyPrice: 0,
      windowMatched: false,
      deltaFromTarget: 0,
    });

    const chooseBestXSummary = (
      eligibility: Stage1Eligibility,
      fallbackQuote: Stage1ExecutionQuote,
      requestedRates: number[],
      getQuote: (rateOverride?: number) => Stage1ExecutionQuote,
    ): InvestorSummary => {
      if (!eligibility.eligible) return makeSummary(eligibility, fallbackQuote);

      const candidates = new Map<string, InvestorSummary>();
      for (const requestedRate of requestedRates) {
        const summary = makeSummary(eligibility, getQuote(requestedRate));
        candidates.set(`${summary.quote.rate}|${summary.quote.purchasePrice}|${summary.quote.product}`, summary);
      }

      const allCandidates = candidates.size ? [...candidates.values()] : [makeSummary(eligibility, fallbackQuote)];
      const windowCandidates = allCandidates.filter(summary => summary.windowMatched);

      if (windowCandidates.length > 0) {
        return [...windowCandidates].sort((a, b) => {
          if (a.quote.rate !== b.quote.rate) return a.quote.rate - b.quote.rate;
          if (Math.abs(a.deltaFromTarget) !== Math.abs(b.deltaFromTarget)) return Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget);
          if ((a.deltaFromTarget > 0) !== (b.deltaFromTarget > 0)) return a.deltaFromTarget > 0 ? 1 : -1;
          if (b.buyPrice !== a.buyPrice) return b.buyPrice - a.buyPrice;
          return a.investor.localeCompare(b.investor);
        })[0];
      }

      return [...allCandidates].sort((a, b) => {
        const aDistance = distanceToBestExWindow(a.deltaFromTarget);
        const bDistance = distanceToBestExWindow(b.deltaFromTarget);
        if (aDistance !== bDistance) return aDistance - bDistance;
        if (Math.abs(a.deltaFromTarget) !== Math.abs(b.deltaFromTarget)) return Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget);
        if (a.quote.rate !== b.quote.rate) return a.quote.rate - b.quote.rate;
        if (b.buyPrice !== a.buyPrice) return b.buyPrice - a.buyPrice;
        return a.investor.localeCompare(b.investor);
      })[0];
    };

    const standardRequestedRates = buildRequestedRates(3, 20);
    const osbHelocRequestedRates = buildRequestedRates(0.5, 8);
    const summaries: InvestorSummary[] = [];

    if (bestExProduct === 'HELOC') {
      const buttonInput = { ...input, buttonProduct: 'HELOC' as const, helocDrawTermYears: bestExDrawPeriodYears };
      const buttonEligibility = evaluateButtonStage1Eligibility(buttonInput, selectedLoanAmount);
      const buttonBaseQuote = calculateButtonStage1Quote(buttonInput, { selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears });
      summaries.push(chooseBestXSummary(buttonEligibility, {
        engine: 'Button',
        program: 'Button',
        product: 'HELOC',
        maxAvailable: buttonBaseQuote.maxAvailable,
        rate: buttonBaseQuote.rate,
        noteRate: buttonBaseQuote.noteRate,
        monthlyPayment: buttonBaseQuote.monthlyPayment,
        maxLtv: buttonBaseQuote.maxLtv,
        purchasePrice: buttonBaseQuote.purchasePrice,
        basePrice: buttonBaseQuote.basePrice,
        llpaAdjustment: buttonBaseQuote.llpaAdjustment,
        adjustments: buttonBaseQuote.adjustments,
      }, standardRequestedRates, rateOverride => {
        const quote = calculateButtonStage1Quote(buttonInput, { selectedLoanAmount, helocDrawTermYears: bestExDrawPeriodYears, rateOverride });
        return {
          engine: 'Button',
          program: 'Button',
          product: 'HELOC',
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: quote.adjustments,
        };
      }));

      summaries.push(makeIneligible('Vista', 'CES Only', 'HELOC', 'Vista only supports CES pricing in Best Ex.'));
      summaries.push(makeIneligible('NewRez', 'CES Only', 'HELOC', 'NewRez only supports CES pricing in Best Ex.'));
      summaries.push(makeIneligible('Deephaven', 'CES Only', 'HELOC', 'Deephaven only supports CES pricing in Best Ex.'));

      if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) {
        summaries.push(makeIneligible('OSB', 'HELOC', '30 Year Maturity', `OSB HELOC only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
      } else {
        const osbInput = {
          ...input,
          osbProgram: 'HELOC' as const,
          osbProduct: '30 Year Maturity' as const,
          osbLockPeriodDays: actualLockPeriodDays as OsbLockPeriod,
          helocDrawTermYears: bestExDrawPeriodYears,
        };
        const osbEligibility = evaluateOsbStage1Eligibility(osbInput, selectedLoanAmount);
        const osbBaseQuote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
        summaries.push(chooseBestXSummary(osbEligibility, {
          engine: 'OSB',
          program: osbBaseQuote.program,
          product: osbBaseQuote.product,
          maxAvailable: osbBaseQuote.maxAvailable,
          rate: osbBaseQuote.rate,
          noteRate: osbBaseQuote.noteRate,
          monthlyPayment: osbBaseQuote.monthlyPayment,
          maxLtv: osbBaseQuote.maxLtv,
          purchasePrice: osbBaseQuote.purchasePrice,
          basePrice: osbBaseQuote.basePrice,
          llpaAdjustment: osbBaseQuote.llpaAdjustment,
          adjustments: osbBaseQuote.adjustments,
        }, osbHelocRequestedRates, rateOverride => {
          const quote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride });
          return {
            engine: 'OSB',
            program: quote.program,
            product: quote.product,
            maxAvailable: quote.maxAvailable,
            rate: quote.rate,
            noteRate: quote.noteRate,
            monthlyPayment: quote.monthlyPayment,
            maxLtv: quote.maxLtv,
            purchasePrice: quote.purchasePrice,
            basePrice: quote.basePrice,
            llpaAdjustment: quote.llpaAdjustment,
            adjustments: quote.adjustments,
          };
        }));
      }

      if (bestExDrawPeriodYears === 10) {
        summaries.push(makeIneligible('Verus', 'HELOC', '30 YR', 'Verus HELOC supports 3 or 5 year draw periods only.'));
      } else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) {
        summaries.push(makeIneligible('Verus', 'HELOC', '30 YR', `Verus HELOC only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
      } else {
        const verusInput = {
          ...input,
          verusProgram: 'HELOC' as const,
          verusProduct: '30 YR' as const,
          verusDocType: bestExDocType,
          verusDrawPeriodYears: bestExDrawPeriodYears as Exclude<VerusDrawPeriodYears, 2>,
          verusLockPeriodDays: actualLockPeriodDays as VerusLockPeriodDays,
        };
        const verusEligibility = evaluateVerusStage1Eligibility(verusInput, selectedLoanAmount);
        const verusBaseQuote = calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
        summaries.push(chooseBestXSummary(verusEligibility, {
          engine: 'Verus',
          program: verusBaseQuote.program,
          product: verusBaseQuote.product,
          maxAvailable: verusBaseQuote.maxAvailable,
          rate: verusBaseQuote.rate,
          noteRate: verusBaseQuote.noteRate,
          monthlyPayment: verusBaseQuote.monthlyPayment,
          maxLtv: verusBaseQuote.maxLtv,
          purchasePrice: verusBaseQuote.purchasePrice,
          basePrice: verusBaseQuote.basePrice,
          llpaAdjustment: verusBaseQuote.llpaAdjustment,
          adjustments: verusBaseQuote.adjustments,
        }, standardRequestedRates, rateOverride => {
          const quote = calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride });
          return {
            engine: 'Verus',
            program: quote.program,
            product: quote.product,
            maxAvailable: quote.maxAvailable,
            rate: quote.rate,
            noteRate: quote.noteRate,
            monthlyPayment: quote.monthlyPayment,
            maxLtv: quote.maxLtv,
            purchasePrice: quote.purchasePrice,
            basePrice: quote.basePrice,
            llpaAdjustment: quote.llpaAdjustment,
            adjustments: quote.adjustments,
          };
        }));
      }
    } else {
      const buttonInput = { ...input, buttonProduct: 'CES' as const, buttonTermYears: bestExTermYears };
      const buttonEligibility = evaluateButtonStage1Eligibility(buttonInput, selectedLoanAmount);
      const buttonBaseQuote = calculateButtonStage1Quote(buttonInput, { selectedLoanAmount, cesTermYears: bestExTermYears });
      summaries.push(chooseBestXSummary(buttonEligibility, {
        engine: 'Button',
        program: 'Button',
        product: 'CES',
        maxAvailable: buttonBaseQuote.maxAvailable,
        rate: buttonBaseQuote.rate,
        noteRate: buttonBaseQuote.noteRate,
        monthlyPayment: buttonBaseQuote.monthlyPayment,
        maxLtv: buttonBaseQuote.maxLtv,
        purchasePrice: buttonBaseQuote.purchasePrice,
        basePrice: buttonBaseQuote.basePrice,
        llpaAdjustment: buttonBaseQuote.llpaAdjustment,
        adjustments: buttonBaseQuote.adjustments,
      }, standardRequestedRates, rateOverride => {
        const quote = calculateButtonStage1Quote(buttonInput, { selectedLoanAmount, cesTermYears: bestExTermYears, rateOverride });
        return {
          engine: 'Button',
          program: 'Button',
          product: 'CES',
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: quote.adjustments,
        };
      }));

      const vistaProducts: Partial<Record<BestExTermYears, VistaProduct>> = {
        10: '10yr Fixed',
        15: '15yr Fixed',
        30: '30yr Fixed',
      };
      const vistaProduct = vistaProducts[bestExTermYears];
      if (!vistaProduct) {
        summaries.push(makeIneligible('Vista', 'CES', `${bestExTermYears} Year`, `Vista does not support ${bestExTermYears}-year CES pricing.`));
      } else {
        const vistaInput = { ...input, vistaProduct };
        const vistaEligibility = evaluateVistaStage1Eligibility(vistaInput, selectedLoanAmount);
        const vistaBaseQuote = calculateVistaStage1Quote(vistaInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
        summaries.push(chooseBestXSummary(vistaEligibility, {
          engine: 'Vista',
          program: vistaBaseQuote.program,
          product: vistaBaseQuote.product,
          maxAvailable: vistaBaseQuote.maxAvailable,
          rate: vistaBaseQuote.rate,
          noteRate: vistaBaseQuote.noteRate,
          monthlyPayment: vistaBaseQuote.monthlyPayment,
          maxLtv: vistaBaseQuote.maxLtv,
          purchasePrice: vistaBaseQuote.purchasePrice,
          basePrice: vistaBaseQuote.basePrice,
          llpaAdjustment: vistaBaseQuote.llpaAdjustment,
          adjustments: vistaBaseQuote.adjustments,
        }, standardRequestedRates, rateOverride => {
          const quote = calculateVistaStage1Quote(vistaInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride });
          return {
            engine: 'Vista',
            program: quote.program,
            product: quote.product,
            maxAvailable: quote.maxAvailable,
            rate: quote.rate,
            noteRate: quote.noteRate,
            monthlyPayment: quote.monthlyPayment,
            maxLtv: quote.maxLtv,
            purchasePrice: quote.purchasePrice,
            basePrice: quote.basePrice,
            llpaAdjustment: quote.llpaAdjustment,
            adjustments: quote.adjustments,
          };
        }));
      }

      const newrezProducts: Partial<Record<BestExTermYears, NewRezProduct>> = {
        15: '15 Year Fixed',
        30: '30 Year Fixed',
      };
      const newrezProduct = newrezProducts[bestExTermYears];
      if (!newrezProduct) {
        summaries.push(makeIneligible('NewRez', 'CES', `${bestExTermYears} Year`, `NewRez does not support ${bestExTermYears}-year CES pricing.`));
      } else {
        const newrezInput = { ...input, newrezProduct };
        const newrezEligibility = evaluateNewRezStage1Eligibility(newrezInput, selectedLoanAmount);
        const newrezBaseQuote = calculateNewRezStage1Quote(newrezInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
        summaries.push(chooseBestXSummary(newrezEligibility, {
          engine: 'NewRez',
          program: newrezBaseQuote.program,
          product: newrezBaseQuote.product,
          maxAvailable: newrezBaseQuote.maxAvailable,
          rate: newrezBaseQuote.rate,
          noteRate: newrezBaseQuote.noteRate,
          monthlyPayment: newrezBaseQuote.monthlyPayment,
          maxLtv: newrezBaseQuote.maxLtv,
          purchasePrice: newrezBaseQuote.purchasePrice,
          basePrice: newrezBaseQuote.basePrice,
          llpaAdjustment: newrezBaseQuote.llpaAdjustment,
          adjustments: newrezBaseQuote.adjustments,
        }, standardRequestedRates, rateOverride => {
          const quote = calculateNewRezStage1Quote(newrezInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride });
          return {
            engine: 'NewRez',
            program: quote.program,
            product: quote.product,
            maxAvailable: quote.maxAvailable,
            rate: quote.rate,
            noteRate: quote.noteRate,
            monthlyPayment: quote.monthlyPayment,
            maxLtv: quote.maxLtv,
            purchasePrice: quote.purchasePrice,
            basePrice: quote.basePrice,
            llpaAdjustment: quote.llpaAdjustment,
            adjustments: quote.adjustments,
          };
        }));
      }

      const osbProducts: Partial<Record<BestExTermYears, OsbProduct>> = {
        10: 'Fixed 10',
        15: 'Fixed 15',
        30: 'Fixed 30',
      };
      const osbProduct = osbProducts[bestExTermYears];
      if (!osbProduct) {
        summaries.push(makeIneligible('OSB', '2nd Liens', `${bestExTermYears} Year`, `OSB does not support ${bestExTermYears}-year CES pricing.`));
      } else if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) {
        summaries.push(makeIneligible('OSB', '2nd Liens', osbProduct, `OSB only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
      } else {
        const osbInput = {
          ...input,
          osbProgram: '2nd Liens' as const,
          osbProduct,
          osbLockPeriodDays: actualLockPeriodDays as OsbLockPeriod,
        };
        const osbEligibility = evaluateOsbStage1Eligibility(osbInput, selectedLoanAmount);
        const osbBaseQuote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
        summaries.push(chooseBestXSummary(osbEligibility, {
          engine: 'OSB',
          program: osbBaseQuote.program,
          product: osbBaseQuote.product,
          maxAvailable: osbBaseQuote.maxAvailable,
          rate: osbBaseQuote.rate,
          noteRate: osbBaseQuote.noteRate,
          monthlyPayment: osbBaseQuote.monthlyPayment,
          maxLtv: osbBaseQuote.maxLtv,
          purchasePrice: osbBaseQuote.purchasePrice,
          basePrice: osbBaseQuote.basePrice,
          llpaAdjustment: osbBaseQuote.llpaAdjustment,
          adjustments: osbBaseQuote.adjustments,
        }, standardRequestedRates, rateOverride => {
          const quote = calculateOsbStage1Quote(osbInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride });
          return {
            engine: 'OSB',
            program: quote.program,
            product: quote.product,
            maxAvailable: quote.maxAvailable,
            rate: quote.rate,
            noteRate: quote.noteRate,
            monthlyPayment: quote.monthlyPayment,
            maxLtv: quote.maxLtv,
            purchasePrice: quote.purchasePrice,
            basePrice: quote.basePrice,
            llpaAdjustment: quote.llpaAdjustment,
            adjustments: quote.adjustments,
          };
        }));
      }

      const verusProducts: Record<BestExTermYears, VerusProduct> = {
        10: '10 YR FIX',
        15: '15 YR FIX',
        25: '25 YR FIX',
        30: '30 YR FIX',
      };
      if (actualLockPeriodDays !== 45 && actualLockPeriodDays !== 60) {
        summaries.push(makeIneligible('Verus', 'CES', verusProducts[bestExTermYears], `Verus only supports padded lock pricing at 45 or 60 days, not ${actualLockPeriodDays}.`));
      } else {
        const verusInput = {
          ...input,
          verusProgram: 'CES' as const,
          verusProduct: verusProducts[bestExTermYears],
          verusDocType: bestExDocType,
          verusLockPeriodDays: actualLockPeriodDays as VerusLockPeriodDays,
        };
        const verusEligibility = evaluateVerusStage1Eligibility(verusInput, selectedLoanAmount);
        const verusBaseQuote = calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
        summaries.push(chooseBestXSummary(verusEligibility, {
          engine: 'Verus',
          program: verusBaseQuote.program,
          product: verusBaseQuote.product,
          maxAvailable: verusBaseQuote.maxAvailable,
          rate: verusBaseQuote.rate,
          noteRate: verusBaseQuote.noteRate,
          monthlyPayment: verusBaseQuote.monthlyPayment,
          maxLtv: verusBaseQuote.maxLtv,
          purchasePrice: verusBaseQuote.purchasePrice,
          basePrice: verusBaseQuote.basePrice,
          llpaAdjustment: verusBaseQuote.llpaAdjustment,
          adjustments: verusBaseQuote.adjustments,
        }, standardRequestedRates, rateOverride => {
          const quote = calculateVerusStage1Quote(verusInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride });
          return {
            engine: 'Verus',
            program: quote.program,
            product: quote.product,
            maxAvailable: quote.maxAvailable,
            rate: quote.rate,
            noteRate: quote.noteRate,
            monthlyPayment: quote.monthlyPayment,
            maxLtv: quote.maxLtv,
            purchasePrice: quote.purchasePrice,
            basePrice: quote.basePrice,
            llpaAdjustment: quote.llpaAdjustment,
            adjustments: quote.adjustments,
          };
        }));
      }

      const deephavenProducts: Partial<Record<BestExTermYears, DeephavenProduct>> = {
        15: '15Y Fixed',
        30: '30Y Fixed',
      };
      const deephavenProduct = deephavenProducts[bestExTermYears];
      if (!deephavenProduct) {
        summaries.push(makeIneligible('Deephaven', 'Equity Advantage / Elite', `${bestExTermYears} Year`, `Deephaven does not support ${bestExTermYears}-year CES pricing.`));
      } else {
        const deephavenInput = { ...input, deephavenProduct };
        const deephavenEligibility = evaluateDeephavenStage1Eligibility(deephavenInput, selectedLoanAmount);
        const deephavenBaseQuote = calculateDeephavenStage1Quote(deephavenInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
        summaries.push(chooseBestXSummary(deephavenEligibility, {
          engine: 'Deephaven',
          program: deephavenBaseQuote.program,
          product: deephavenBaseQuote.product,
          maxAvailable: deephavenBaseQuote.maxAvailable,
          rate: deephavenBaseQuote.rate,
          noteRate: deephavenBaseQuote.noteRate,
          monthlyPayment: deephavenBaseQuote.monthlyPayment,
          maxLtv: deephavenBaseQuote.maxLtv,
          purchasePrice: deephavenBaseQuote.purchasePrice,
          basePrice: deephavenBaseQuote.basePrice,
          llpaAdjustment: deephavenBaseQuote.llpaAdjustment,
          adjustments: deephavenBaseQuote.adjustments,
        }, standardRequestedRates, rateOverride => {
          const quote = calculateDeephavenStage1Quote(deephavenInput, { selectedLoanAmount, targetPrice: effectiveTargetPrice, rateOverride });
          return {
            engine: 'Deephaven',
            program: quote.program,
            product: quote.product,
            maxAvailable: quote.maxAvailable,
            rate: quote.rate,
            noteRate: quote.noteRate,
            monthlyPayment: quote.monthlyPayment,
            maxLtv: quote.maxLtv,
            purchasePrice: quote.purchasePrice,
            basePrice: quote.basePrice,
            llpaAdjustment: quote.llpaAdjustment,
            adjustments: quote.adjustments,
          };
        }));
      }
    }

    return summaries.sort((a, b) => {
      if (a.eligibility.eligible !== b.eligibility.eligible) return a.eligibility.eligible ? -1 : 1;
      if (a.windowMatched !== b.windowMatched) return a.windowMatched ? -1 : 1;
      if (a.windowMatched && b.windowMatched) {
        if (a.quote.rate !== b.quote.rate) return a.quote.rate - b.quote.rate;
        if (Math.abs(a.deltaFromTarget) !== Math.abs(b.deltaFromTarget)) return Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget);
        if ((a.deltaFromTarget > 0) !== (b.deltaFromTarget > 0)) return a.deltaFromTarget > 0 ? 1 : -1;
        if (b.buyPrice !== a.buyPrice) return b.buyPrice - a.buyPrice;
      } else if (a.eligibility.eligible && b.eligibility.eligible) {
        const aDistance = distanceToBestExWindow(a.deltaFromTarget);
        const bDistance = distanceToBestExWindow(b.deltaFromTarget);
        if (aDistance !== bDistance) return aDistance - bDistance;
        if (Math.abs(a.deltaFromTarget) !== Math.abs(b.deltaFromTarget)) return Math.abs(a.deltaFromTarget) - Math.abs(b.deltaFromTarget);
        if (a.quote.rate !== b.quote.rate) return a.quote.rate - b.quote.rate;
        if (b.buyPrice !== a.buyPrice) return b.buyPrice - a.buyPrice;
      }
      return a.investor.localeCompare(b.investor);
    });
  }, [input, effectiveTargetPrice]);

  const eligibility = activeResult?.eligibility;
  const quote = activeResult?.quote;
  const targetQuote = activeResult?.targetQuote;
  const osbDerived = useMemo(() => buildOsbStage1PricingInput(input), [input]);

  function update<K extends keyof TesterInput>(key: K, value: TesterInput[K]) {
    setInput(prev => ({ ...prev, [key]: value }));
  }

  function updateOsbProgram(program: OsbProgram) {
    setInput(prev => ({
      ...prev,
      osbProgram: program,
      osbProduct: program === 'HELOC' ? '30 Year Maturity' : 'Fixed 30',
    }));
  }

  function updateVerusProgram(program: VerusProgram) {
    setInput(prev => ({
      ...prev,
      verusProgram: program,
      verusProduct: program === 'HELOC' ? '30 YR' : '30 YR FIX',
    }));
  }

  function unlockTester() {
    if (password !== TESTER_GATE_PASSWORD) {
      setGateError('Incorrect password');
      return;
    }
    window.localStorage.setItem(TESTER_GATE_STORAGE_KEY, 'true');
    setIsUnlocked(true);
    setGateError('');
  }

  if (!gateChecked) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!isUnlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Stage 1 Tester</h1>
          <p className="mt-2 text-sm text-slate-600">Internal page. Enter the shared password once on this browser to continue.</p>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (gateError) setGateError('');
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') unlockTester();
              }}
              placeholder="Password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {gateError ? <div className="text-sm text-rose-700">{gateError}</div> : null}
            <button
              type="button"
              onClick={unlockTester}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Unlock tester
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Stage 1 Pricing Tester</h1>
            <p className="mt-2 text-sm text-slate-600">
              Internal harness for workbook-driven stage 1 pricing. Button, Vista, OSB, NewRez, Verus, and Deephaven all adapt into the same execution contract.
            </p>
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">Available engines: BestX, Button, Vista, OSB, NewRez, Verus, and Deephaven</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Engine Toggle</div>
            <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
              {(['BestX', 'Button', 'Vista', 'OSB', 'NewRez', 'Verus', 'Deephaven'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setEngine(option)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${engine === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Inputs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
                            {engine === 'BestX' ? (
                <div className="space-y-4 text-sm sm:col-span-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                    Best Ex uses one normalized scenario, then prices each investor and marks unsupported combinations ineligible.
                  </div>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Product</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExProduct ?? 'HELOC'} onChange={e => update('bestExProduct', e.target.value as BestExProduct)}>
                      <option value="HELOC">HELOC</option>
                      <option value="CES">CES</option>
                    </select>
                  </label>
                  {input.bestExProduct === 'HELOC' ? (
                    <label className="text-sm">
                      <div className="mb-1 font-medium text-slate-700">Draw Period</div>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExDrawPeriodYears ?? 5} onChange={e => update('bestExDrawPeriodYears', Number(e.target.value) as BestExDrawPeriodYears)}>
                        <option value={3}>3 Years</option>
                        <option value={5}>5 Years</option>
                        <option value={10}>10 Years</option>
                      </select>
                    </label>
                  ) : (
                    <label className="text-sm">
                      <div className="mb-1 font-medium text-slate-700">Term</div>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExTermYears ?? 30} onChange={e => update('bestExTermYears', Number(e.target.value) as BestExTermYears)}>
                        <option value={10}>10 Years</option>
                        <option value={15}>15 Years</option>
                        <option value={25}>25 Years</option>
                        <option value={30}>30 Years</option>
                      </select>
                    </label>
                  )}
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Lock Period</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExLockPeriodDays ?? 45} onChange={e => update('bestExLockPeriodDays', Number(e.target.value) as BestExLockPeriodDays)}>
                      <option value={15}>15 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={45}>45 Days</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Doc Type</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExDocType ?? 'Standard'} onChange={e => update('bestExDocType', e.target.value as VerusDocType)}>
                      <option value="Standard">Standard</option>
                      <option value="Alt Doc">Alt Doc</option>
                    </select>
                  </label>
                </div>
              ) : engine === 'Button' ? (
                <>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Product</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.buttonProduct} onChange={e => update('buttonProduct', e.target.value)}>
                      <option value="HELOC">HELOC</option>
                      <option value="CES">CES</option>
                    </select>
                  </label>
                  {input.buttonProduct === 'CES' && (
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="mb-1 font-medium text-slate-700">Button Term</div>
                        <TermToggle
                          label="Button Term"
                          value={String(input.buttonTermYears ?? 20)}
                          options={[
                            { value: '10', label: '10 Year' },
                            { value: '15', label: '15 Year' },
                            { value: '20', label: '20 Year' },
                            { value: '25', label: '25 Year' },
                            { value: '30', label: '30 Year' },
                          ]}
                          onChange={value => update('buttonTermYears', Number(value) as 10 | 15 | 20 | 25 | 30)}
                        />
                      </div>
                    </div>
                  )}
                  {input.buttonProduct === 'HELOC' && (
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="mb-1 font-medium text-slate-700">Button Draw Period</div>
                        <TermToggle
                          label="Button Draw Period"
                          value={String(input.helocDrawTermYears ?? 5)}
                          options={[
                            { value: '3', label: '3 Year' },
                            { value: '5', label: '5 Year' },
                            { value: '10', label: '10 Year' },
                          ]}
                          onChange={value => update('helocDrawTermYears', Number(value) as 3 | 5 | 10)}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : engine === 'Vista' ? (
                <div className="space-y-3 text-sm sm:col-span-2">
                  <div>
                    <div className="mb-1 font-medium text-slate-700">Vista Product</div>
                    <TermToggle
                      label="Vista Term"
                      value={input.vistaProduct ?? '30yr Fixed'}
                      options={[
                        { value: '30yr Fixed', label: '30 Fixed' },
                        { value: '20yr Fixed', label: '20 Fixed' },
                        { value: '15yr Fixed', label: '15 Fixed' },
                        { value: '10yr Fixed', label: '10 Fixed' },
                      ]}
                      onChange={value => update('vistaProduct', value as VistaProduct)}
                    />
                  </div>
                </div>
              ) : engine === 'NewRez' ? (
                <div className="space-y-3 text-sm sm:col-span-2">
                  <div>
                    <div className="mb-1 font-medium text-slate-700">NewRez Product</div>
                    <TermToggle
                      label="NewRez Term"
                      value={input.newrezProduct ?? '30 Year Fixed'}
                      options={[
                        { value: '30 Year Fixed', label: '30 Year' },
                        { value: '20 Year Fixed', label: '20 Year' },
                        { value: '15 Year Fixed', label: '15 Year' },
                      ]}
                      onChange={value => update('newrezProduct', value as NewRezProduct)}
                    />
                  </div>
                </div>
              ) : engine === 'Verus' ? (
                <>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Verus Program</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusProgram} onChange={e => updateVerusProgram(e.target.value as VerusProgram)}>
                      <option value="CES">Closed End Second</option>
                      <option value="HELOC">HELOC</option>
                    </select>
                  </label>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 font-medium text-slate-700">Verus Product</div>
                      <TermToggle
                        label="Verus Term"
                        value={input.verusProduct ?? (input.verusProgram === 'HELOC' ? '30 YR' : '30 YR FIX')}
                        options={input.verusProgram === 'HELOC'
                          ? [
                              { value: '15 YR', label: '15 Year' },
                              { value: '20 YR', label: '20 Year' },
                              { value: '25 YR', label: '25 Year' },
                              { value: '30 YR', label: '30 Year' },
                            ]
                          : [
                              { value: '10 YR FIX', label: '10 Year' },
                              { value: '15 YR FIX', label: '15 Year' },
                              { value: '20 YR FIX', label: '20 Year' },
                              { value: '25 YR FIX', label: '25 Year' },
                              { value: '30 YR FIX', label: '30 Year' },
                            ]}
                        onChange={value => update('verusProduct', value as VerusProduct)}
                      />
                    </div>
                  </div>
                </>
              ) : engine === 'Deephaven' ? (
                <div className="space-y-3 text-sm sm:col-span-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    Deephaven prices both <span className="font-semibold">Equity Advantage</span> and <span className="font-semibold">Equity Advantage Elite</span> automatically, then uses the best execution.
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-slate-700">Deephaven Product</div>
                    <TermToggle
                      label="Deephaven Term"
                      value={input.deephavenProduct ?? '30Y Fixed'}
                      options={[
                        { value: '15Y Fixed', label: '15 Year' },
                        { value: '30Y Fixed', label: '30 Year' },
                      ]}
                      onChange={value => update('deephavenProduct', value as DeephavenProduct)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">OSB Program</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.osbProgram} onChange={e => updateOsbProgram(e.target.value as OsbProgram)}>
                      <option value="HELOC">HELOC</option>
                      <option value="2nd Liens">2nd Liens</option>
                    </select>
                  </label>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 font-medium text-slate-700">OSB Product</div>
                      <TermToggle
                        label="OSB Term"
                        value={input.osbProduct ?? (input.osbProgram === 'HELOC' ? '30 Year Maturity' : 'Fixed 30')}
                        options={input.osbProgram === 'HELOC'
                          ? [
                              { value: '20 Year Maturity', label: '20 Year' },
                              { value: '30 Year Maturity', label: '30 Year' },
                            ]
                          : [
                              { value: 'Fixed 10', label: '10 Year' },
                              { value: 'Fixed 15', label: '15 Year' },
                              { value: 'Fixed 20', label: '20 Year' },
                              { value: 'Fixed 30', label: '30 Year' },
                            ]}
                        onChange={value => update('osbProduct', value as OsbProduct)}
                      />
                    </div>
                  </div>
                </>
              )}

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">State</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.propertyState ?? ''} onChange={e => update('propertyState', e.target.value.toUpperCase())} />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Property Value</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.propertyValue ?? 0} onChange={e => update('propertyValue', Number(e.target.value))} />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Current Loan Balance</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.loanBalance ?? 0} onChange={e => update('loanBalance', Number(e.target.value))} />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Desired New Money</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.desiredLoanAmount ?? 0} onChange={e => update('desiredLoanAmount', Number(e.target.value))} />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Credit Score</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.creditScore ?? 0} onChange={e => update('creditScore', Number(e.target.value))} />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Occupancy</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.occupancy ?? ''} onChange={e => update('occupancy', e.target.value)}>
                  <option value="Owner-Occupied">Owner-Occupied</option>
                  <option value="Second Home">Second Home</option>
                  <option value="Investment">Investment</option>
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Structure Type</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.structureType ?? ''} onChange={e => update('structureType', e.target.value)}>
                  <option value="SFR">SFR</option>
                  <option value="Condo">Condo</option>
                  <option value="Townhome">Townhome</option>
                  <option value="PUD">PUD</option>
                  <option value="2-4 Unit">2-4 Unit</option>
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Number of Units</div>
                <input type="number" min={1} max={4} className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.numberOfUnits ?? 1} onChange={e => update('numberOfUnits', Number(e.target.value))} />
              </label>

              {engine === 'OSB' && input.osbProgram === 'HELOC' && (
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">HELOC Draw Term</div>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.helocDrawTermYears ?? 5} onChange={e => update('helocDrawTermYears', Number(e.target.value) as 3 | 5 | 10)}>
                    <option value={10}>10 Years</option>
                    <option value={5}>5 Years</option>
                    <option value={3}>3 Years</option>
                  </select>
                </label>
              )}

              {engine === 'Verus' && (
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">Verus Doc Type</div>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusDocType ?? 'Standard'} onChange={e => update('verusDocType', e.target.value as VerusDocType)}>
                    <option value="Standard">Standard</option>
                    <option value="Alt Doc">Alt Doc</option>
                  </select>
                </label>
              )}

              {engine === 'Verus' && (
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">Verus Lock Period</div>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusLockPeriodDays ?? 45} onChange={e => update('verusLockPeriodDays', Number(e.target.value) as VerusLockPeriodDays)}>
                    <option value={30}>30 days</option>
                    <option value={45}>45 days</option>
                    <option value={60}>60 days</option>
                  </select>
                </label>
              )}

              {engine === 'Verus' && input.verusProgram === 'HELOC' && (
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">Verus Draw Period</div>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusDrawPeriodYears ?? 5} onChange={e => update('verusDrawPeriodYears', Number(e.target.value) as VerusDrawPeriodYears)}>
                    <option value={2}>2 Years</option>
                    <option value={3}>3 Years</option>
                    <option value={5}>5 Years</option>
                  </select>
                </label>
              )}

              {engine === 'OSB' && (
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">Lock Period</div>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.osbLockPeriodDays ?? 45} onChange={e => update('osbLockPeriodDays', Number(e.target.value) as OsbLockPeriod)}>
                    <option value={15}>15 day</option>
                    <option value={45}>45 day</option>
                    <option value={60}>60 day</option>
                  </select>
                </label>
              )}

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Target Price</div>
                <input type="number" step="0.001" placeholder={String(getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0)))} className="w-full rounded-lg border border-slate-300 px-3 py-2" value={targetPriceOverride} onChange={e => setTargetPriceOverride(e.target.value)} />
                <div className="mt-1 text-xs text-slate-500">Auto target from loan amount: {effectiveTargetPrice.toFixed(3)}</div>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Target Rate</div>
                <input type="number" step="0.125" placeholder="Use engine-selected rate" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={manualRateOverride} onChange={e => setManualRateOverride(e.target.value)} />
                <div className="mt-1 text-xs text-slate-500">Overrides the quote execution rate only. Target solver stays on purchase price.</div>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Tolerance</div>
                <input type="number" step="0.001" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={tolerance} onChange={e => setTolerance(Number(e.target.value))} />
              </label>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Output</h2>
              {engine === 'BestX' ? (
                <div className="space-y-3">
                  {results.map((result, index) => (
                    <div key={result.investor} className={`rounded-2xl border p-4 ${result.eligibility.eligible ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-lg font-semibold text-slate-900">{result.investor}</div>
                            {result.eligibility.eligible ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">#{index + 1}</span> : <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Ineligible</span>}
                          </div>
                          <div className="mt-1 text-sm text-slate-600">{result.quote.program} • {result.quote.product}</div>
                        </div>
                        <div className="grid min-w-[280px] gap-3 sm:grid-cols-3">
                          <Metric label="Rate" value={`${result.quote.rate.toFixed(3)}%`} />
                          <Metric label="Discount Points" value={result.discountPoints.toFixed(3)} />
                          <Metric label="Buy Price" value={result.buyPrice.toFixed(3)} />
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-slate-600">
                        Max available: ${Math.round(result.eligibility.maxAvailable).toLocaleString()} • Max LTV: {(result.quote.maxLtv * 100).toFixed(1)}% • Payment: ${Math.round(result.quote.monthlyPayment).toLocaleString()}
                      </div>
                      {!result.eligibility.eligible && result.eligibility.reasons.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-700">
                          {result.eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : eligibility && quote && targetQuote ? (
              <>
              <div className={`mb-4 rounded-2xl border p-4 ${eligibility.eligible ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className={`text-sm font-semibold ${eligibility.eligible ? 'text-emerald-900' : 'text-red-900'}`}>
                  {eligibility.eligible ? 'Eligible' : 'Ineligible'}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Resulting CLTV: {(eligibility.resultingCltv * 100).toFixed(2)}% • Max Available: ${Math.round(eligibility.maxAvailable).toLocaleString()}
                </div>
                {!eligibility.eligible && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
                    {eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}
                  </ul>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Engine" value={quote.engine} />
                <Metric label="Program" value={quote.program} />
                <Metric label="Product" value={quote.product} />
                <Metric label="Max Available" value={`$${Math.round(quote.maxAvailable).toLocaleString()}`} />
                <Metric label="Rate" value={`${quote.rate.toFixed(3)}%`} />
                <Metric label="Note Rate Selected" value={`${quote.noteRate.toFixed(3)}%`} />
                <Metric label="Monthly Payment" value={`$${Math.round(quote.monthlyPayment).toLocaleString()}`} />
                <Metric label="Max LTV" value={`${(quote.maxLtv * 100).toFixed(1)}%`} />
                <Metric label="Purchase Price" value={quote.purchasePrice.toFixed(3)} />
                <Metric label="Base Price" value={quote.basePrice.toFixed(3)} />
                <Metric label="LLPA Adj" value={quote.llpaAdjustment.toFixed(3)} />
              </div>

              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="mb-3 text-sm font-semibold text-orange-900">Target Margin Solver</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Target Price" value={targetQuote.targetPrice.toFixed(3)} />
                  <Metric label="Solved Rate" value={`${targetQuote.rate.toFixed(3)}%`} />
                  <Metric label="Solved Note Rate" value={`${targetQuote.noteRate.toFixed(3)}%`} />
                  <Metric label="Solved Purchase Price" value={targetQuote.purchasePrice.toFixed(3)} />
                  <Metric label="Base Price @ Solved Rate" value={targetQuote.basePrice.toFixed(3)} />
                  <Metric label="LLPA Adj @ Solved Rate" value={targetQuote.llpaAdjustment.toFixed(3)} />
                  <Metric label="Delta From Target" value={targetQuote.deltaFromTarget.toFixed(3)} />
                  <Metric label="Within Tolerance (Under Only)" value={targetQuote.withinTolerance ? 'Yes' : 'No'} />
                  <Metric label="Within Tolerance (+/-)" value={targetQuote.withinToleranceAllowOverage ? 'Yes' : 'No'} />
                  <Metric label="Tolerance" value={targetQuote.tolerance.toFixed(3)} />
                </div>
              </div>

              {quote.adjustments.length > 0 && (
                <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-sky-900">Execution Details</div>
                  <div className="space-y-2">
                    {quote.adjustments.map(row => (
                      <div key={`${row.label}-${row.value}`} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-sm">
                        <span className="text-slate-700">{row.label}</span>
                        <span className={`font-semibold ${row.value > 0 ? 'text-emerald-700' : row.value < 0 ? 'text-rose-700' : 'text-slate-600'}`}>{row.value.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {engine === 'Button' && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  Workbook sections in play: Button pricing ladder, FICO / CLTV matrix, occupancy, unit count, cash-out, and {input.buttonProduct === 'HELOC' ? `${input.helocDrawTermYears ?? 5} year draw period` : `${input.buttonTermYears ?? 20} year term`} adjustments.
                </div>
              )}

              {engine === 'OSB' && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  Workbook sections in play: {osbDerived.program}, {quote.product}, credit / CLTV matrix, loan amount LLPAs, loan type LLPAs, property LLPAs, and {input.osbLockPeriodDays} day lock adjustment.
                </div>
              )}

              {engine === 'NewRez' && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  Workbook sections in play: {input.newrezProduct}, note-rate / end-seconds price ladder, FICO / CLTV matrix, occupancy, condo, self-employed, DTI, and loan amount adjustments from the Home Equity sheet.
                </div>
              )}

              {engine === 'Verus' && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  Workbook sections in play: {input.verusProgram}, {input.verusProduct}, plus the matching Verus pricing tab for {input.verusProgram === 'HELOC' ? 'HELOC margins' : input.verusDocType ?? 'Standard doc pricing'}.
                </div>
              )}

              {engine === 'Deephaven' && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  Workbook sections in play: Equity Advantage and Equity Advantage Elite, with best execution selected automatically for the chosen Deephaven term.
                </div>
              )}


              <div className="mt-6">
                <div className="mb-2 text-sm font-medium text-slate-700">Raw JSON</div>
                <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify({ engine, input, eligibility, quote, targetQuote }, null, 2)}</pre>
              </div>
              </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TermToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${value === option.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
