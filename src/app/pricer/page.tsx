'use client';

import { useMemo, useState } from 'react';
import { calculateButtonStage1Quote, evaluateButtonStage1Eligibility, getTargetPurchasePriceForLoanAmount, solveButtonStage1TargetRate, type ButtonStage1Input } from '@/lib/rates/button';
import { calculateNewRezStage1Quote, evaluateNewRezStage1Eligibility, solveNewRezStage1TargetRate, type NewRezProduct } from '@/lib/rates/newrez';
import { calculateDeephavenStage1Quote, evaluateDeephavenStage1Eligibility, solveDeephavenStage1TargetRate, type DeephavenProduct, type DeephavenProgram } from '@/lib/rates/deephaven';
import { buildOsbStage1PricingInput, calculateOsbStage1Quote, evaluateOsbStage1Eligibility, solveOsbStage1TargetRate, type OsbLockPeriod, type OsbProduct, type OsbProgram } from '@/lib/rates/osb';
import { type Stage1PricingEngineResult } from '@/lib/rates/shared';
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

export default function Stage1LoTesterPage() {
  const [engine, setEngine] = useState<'Button' | 'Vista' | 'OSB' | 'NewRez' | 'Verus' | 'Deephaven'>('Button');
  const [input, setInput] = useState<TesterInput>(defaultInput);
  const [manualRateOverride, setManualRateOverride] = useState<string>('');
  const [tolerance, setTolerance] = useState(0.125);

  const effectiveTargetPrice = useMemo(() => {
    return getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0));
  }, [input.desiredLoanAmount]);

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

  const { eligibility, quote } = activeResult;
  const osbDerived = useMemo(() => buildOsbStage1PricingInput(input), [input]);
  const discountPoints = useMemo(() => Number((effectiveTargetPrice - quote.purchasePrice).toFixed(3)), [effectiveTargetPrice, quote.purchasePrice]);
  const loBuyPrice = useMemo(() => Number((100 - discountPoints).toFixed(3)), [discountPoints]);

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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Stage 1 LO Pricing View</h1>
            <p className="mt-2 text-sm text-slate-600">
              LO-facing pricing view with discount points and buy price, without backend purchase or margin details.
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
              {engine === 'Button' ? (
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
                <div className="mb-1 font-medium text-slate-700">Manual Rate Override</div>
                <input type="number" step="0.125" placeholder="Use engine-selected rate" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={manualRateOverride} onChange={e => setManualRateOverride(e.target.value)} />
                <div className="mt-1 text-xs text-slate-500">Overrides the quote execution rate only.</div>
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
                <Metric label="Discount Points" value={discountPoints.toFixed(3)} />
                <Metric label="Buy Price" value={loBuyPrice.toFixed(3)} />
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
                  Workbook sections in play: {input.verusProgram}, {input.verusProduct}, plus the matching Verus pricing tab for {input.verusProgram === 'HELOC' ? 'HELOC pricing' : input.verusDocType ?? 'Standard doc pricing'}.
                </div>
              )}

              {engine === 'Deephaven' && (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                  Workbook sections in play: Equity Advantage and Equity Advantage Elite, with best execution selected automatically for the chosen Deephaven term.
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                LO buy price is shown as <span className="font-semibold">100 minus discount points</span>. Backend execution and internal pricing logic stay hidden on this page.
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
