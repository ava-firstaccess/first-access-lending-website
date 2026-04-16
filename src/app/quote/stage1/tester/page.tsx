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
};

type InvestorSummary = {
  investor: string;
  eligibility: Stage1Eligibility;
  quote: Stage1ExecutionQuote;
  discountPoints: number;
  buyPrice: number;
};

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
  const [engine, setEngine] = useState<'Button' | 'Vista' | 'OSB' | 'NewRez' | 'Verus' | 'Deephaven'>('Button');
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

  const activeResult = useMemo<Stage1PricingEngineResult>(() => {
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

    const buttonEligibility = evaluateButtonStage1Eligibility(input, selectedLoanAmount);
    const buttonQuote = calculateButtonStage1Quote(input, { selectedLoanAmount, cesTermYears: input.buttonTermYears, helocDrawTermYears: input.helocDrawTermYears });
    const vistaEligibility = evaluateVistaStage1Eligibility(input, selectedLoanAmount);
    const vistaQuote = calculateVistaStage1Quote(input, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
    const newrezEligibility = evaluateNewRezStage1Eligibility(input, selectedLoanAmount);
    const newrezQuote = calculateNewRezStage1Quote(input, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
    const osbEligibility = evaluateOsbStage1Eligibility(input, selectedLoanAmount);
    const osbQuote = calculateOsbStage1Quote(input, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
    const verusEligibility = evaluateVerusStage1Eligibility(input, selectedLoanAmount);
    const verusQuote = calculateVerusStage1Quote(input, { selectedLoanAmount, targetPrice: effectiveTargetPrice });
    const deephavenEligibility = evaluateDeephavenStage1Eligibility(input, selectedLoanAmount);
    const deephavenQuote = calculateDeephavenStage1Quote(input, { selectedLoanAmount, targetPrice: effectiveTargetPrice });

    const raw: Array<{ investor: string; eligibility: Stage1Eligibility; quote: Stage1ExecutionQuote }> = [
      { investor: 'Button', eligibility: buttonEligibility, quote: { engine: 'Button', program: 'Button', product: String(input.buttonProduct || 'HELOC'), maxAvailable: buttonQuote.maxAvailable, rate: buttonQuote.rate, noteRate: buttonQuote.noteRate, monthlyPayment: buttonQuote.monthlyPayment, maxLtv: buttonQuote.maxLtv, purchasePrice: buttonQuote.purchasePrice, basePrice: buttonQuote.basePrice, llpaAdjustment: buttonQuote.llpaAdjustment, adjustments: buttonQuote.adjustments } },
      { investor: 'Vista', eligibility: vistaEligibility, quote: { engine: 'Vista', program: vistaQuote.program, product: vistaQuote.product, maxAvailable: vistaQuote.maxAvailable, rate: vistaQuote.rate, noteRate: vistaQuote.noteRate, monthlyPayment: vistaQuote.monthlyPayment, maxLtv: vistaQuote.maxLtv, purchasePrice: vistaQuote.purchasePrice, basePrice: vistaQuote.basePrice, llpaAdjustment: vistaQuote.llpaAdjustment, adjustments: vistaQuote.adjustments } },
      { investor: 'NewRez', eligibility: newrezEligibility, quote: { engine: 'NewRez', program: newrezQuote.program, product: newrezQuote.product, maxAvailable: newrezQuote.maxAvailable, rate: newrezQuote.rate, noteRate: newrezQuote.noteRate, monthlyPayment: newrezQuote.monthlyPayment, maxLtv: newrezQuote.maxLtv, purchasePrice: newrezQuote.purchasePrice, basePrice: newrezQuote.basePrice, llpaAdjustment: newrezQuote.llpaAdjustment, adjustments: newrezQuote.adjustments } },
      { investor: 'OSB', eligibility: osbEligibility, quote: { engine: 'OSB', program: osbQuote.program, product: osbQuote.product, maxAvailable: osbQuote.maxAvailable, rate: osbQuote.rate, noteRate: osbQuote.noteRate, monthlyPayment: osbQuote.monthlyPayment, maxLtv: osbQuote.maxLtv, purchasePrice: osbQuote.purchasePrice, basePrice: osbQuote.basePrice, llpaAdjustment: osbQuote.llpaAdjustment, adjustments: osbQuote.adjustments } },
      { investor: 'Verus', eligibility: verusEligibility, quote: { engine: 'Verus', program: verusQuote.program, product: verusQuote.product, maxAvailable: verusQuote.maxAvailable, rate: verusQuote.rate, noteRate: verusQuote.noteRate, monthlyPayment: verusQuote.monthlyPayment, maxLtv: verusQuote.maxLtv, purchasePrice: verusQuote.purchasePrice, basePrice: verusQuote.basePrice, llpaAdjustment: verusQuote.llpaAdjustment, adjustments: verusQuote.adjustments } },
      { investor: 'Deephaven', eligibility: deephavenEligibility, quote: { engine: 'Deephaven', program: deephavenQuote.program, product: deephavenQuote.product, maxAvailable: deephavenQuote.maxAvailable, rate: deephavenQuote.rate, noteRate: deephavenQuote.noteRate, monthlyPayment: deephavenQuote.monthlyPayment, maxLtv: deephavenQuote.maxLtv, purchasePrice: deephavenQuote.purchasePrice, basePrice: deephavenQuote.basePrice, llpaAdjustment: deephavenQuote.llpaAdjustment, adjustments: deephavenQuote.adjustments } },
    ];

    return raw.map(item => {
      const discountPoints = Number((effectiveTargetPrice - item.quote.purchasePrice).toFixed(3));
      const buyPrice = Number((100 - discountPoints).toFixed(3));
      return { ...item, discountPoints, buyPrice };
    }).sort((a, b) => {
      if (a.eligibility.eligible !== b.eligibility.eligible) return a.eligibility.eligible ? -1 : 1;
      if (a.eligibility.eligible && b.eligibility.eligible) {
        if (b.buyPrice !== a.buyPrice) return b.buyPrice - a.buyPrice;
        if (a.quote.rate !== b.quote.rate) return a.quote.rate - b.quote.rate;
      }
      return a.investor.localeCompare(b.investor);
    });
  }, [input, effectiveTargetPrice]);

  const { eligibility, quote } = activeResult;
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
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">Available engines: Button, Vista, OSB, NewRez, Verus, and Deephaven</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Engine Toggle</div>
            <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
              {(['Button', 'Vista', 'OSB', 'NewRez', 'Verus', 'Deephaven'] as const).map(option => (
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

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Best execution</h2>
                  <div className="text-sm text-slate-500">Sorted best to worst</div>
                </div>
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
                          <Metric label="Discount Points" value={result.quote.purchasePrice ? (effectiveTargetPrice - result.quote.purchasePrice).toFixed(3) : result.discountPoints.toFixed(3)} />
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
              </div>

              <div className="mt-6">
                <div className="mb-2 text-sm font-medium text-slate-700">Raw JSON</div>
                <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify({ engine, input, eligibility, quote, targetQuote }, null, 2)}</pre>
              </div>
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
