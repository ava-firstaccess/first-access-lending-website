'use client';

import { useMemo, useState } from 'react';
import { calculateButtonStage1Quote, evaluateButtonStage1Eligibility, getTargetPurchasePriceForLoanAmount, solveButtonStage1TargetRate, type ButtonStage1Input } from '@/lib/rates/button';
import { calculateNewRezStage1Quote, evaluateNewRezStage1Eligibility, solveNewRezStage1TargetRate, type NewRezProduct } from '@/lib/rates/newrez';
import { buildOsbStage1PricingInput, calculateOsbStage1Quote, evaluateOsbStage1Eligibility, solveOsbStage1TargetRate, type OsbLockPeriod, type OsbProduct, type OsbProgram } from '@/lib/rates/osb';
import { type Stage1PricingEngineResult } from '@/lib/rates/shared';
import { calculateVistaStage1Quote, evaluateVistaStage1Eligibility, solveVistaStage1TargetRate, type VistaProduct } from '@/lib/rates/vista';

type TesterInput = ButtonStage1Input & {
  vistaProduct?: VistaProduct;
  newrezProduct?: NewRezProduct;
  osbProgram?: OsbProgram;
  osbProduct?: OsbProduct;
  osbLockPeriodDays?: OsbLockPeriod;
  helocDrawTermYears?: 3 | 5 | 10;
};

const defaultInput: TesterInput = {
  product: 'HELOC',
  vistaProduct: '30yr Fixed',
  newrezProduct: '30 Year Fixed',
  osbProgram: 'HELOC',
  osbProduct: '30 Year Maturity',
  osbLockPeriodDays: 45,
  helocDrawTermYears: 5,
  propertyState: 'CA',
  propertyValue: 750000,
  loanBalance: 250000,
  desiredLoanAmount: 100000,
  creditScore: 740,
  occupancy: 'Owner-Occupied',
  structureType: 'SFR',
  numberOfUnits: 1,
  cashOut: false,
};

export default function Stage1TesterPage() {
  const [engine, setEngine] = useState<'Button' | 'Vista' | 'OSB' | 'NewRez'>('Button');
  const [input, setInput] = useState<TesterInput>(defaultInput);
  const [targetPriceOverride, setTargetPriceOverride] = useState<string>('');
  const [tolerance, setTolerance] = useState(0.125);

  const effectiveTargetPrice = useMemo(() => {
    if (targetPriceOverride.trim()) return Number(targetPriceOverride);
    return getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0));
  }, [input.desiredLoanAmount, targetPriceOverride]);

  const activeResult = useMemo<Stage1PricingEngineResult>(() => {
    if (engine === 'Button') {
      const eligibility = evaluateButtonStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateButtonStage1Quote(input);
      const targetQuote = solveButtonStage1TargetRate(input, {
        targetPrice: effectiveTargetPrice,
        tolerance,
        selectedLoanAmount: input.desiredLoanAmount,
      });

      return {
        eligibility,
        quote: {
          engine: 'Button',
          program: 'Button',
          product: String(input.product || 'HELOC'),
          maxAvailable: quote.maxAvailable,
          rate: quote.rate,
          noteRate: quote.noteRate,
          monthlyPayment: quote.monthlyPayment,
          maxLtv: quote.maxLtv,
          purchasePrice: quote.purchasePrice,
          basePrice: quote.basePrice,
          llpaAdjustment: quote.llpaAdjustment,
          adjustments: [],
        },
        targetQuote: {
          engine: 'Button',
          program: 'Button',
          product: String(input.product || 'HELOC'),
          maxAvailable: targetQuote.maxAvailable,
          rate: targetQuote.rate,
          noteRate: targetQuote.noteRate,
          monthlyPayment: targetQuote.monthlyPayment,
          maxLtv: targetQuote.maxLtv,
          purchasePrice: targetQuote.purchasePrice,
          basePrice: targetQuote.basePrice,
          llpaAdjustment: targetQuote.llpaAdjustment,
          adjustments: [],
          targetPrice: targetQuote.targetPrice,
          tolerance: targetQuote.tolerance,
          deltaFromTarget: targetQuote.deltaFromTarget,
          withinTolerance: targetQuote.withinTolerance,
        },
      };
    }

    if (engine === 'Vista') {
      const eligibility = evaluateVistaStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateVistaStage1Quote(input, {
        selectedLoanAmount: input.desiredLoanAmount,
        targetPrice: effectiveTargetPrice,
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
        },
      };
    }

    if (engine === 'NewRez') {
      const eligibility = evaluateNewRezStage1Eligibility(input, input.desiredLoanAmount);
      const quote = calculateNewRezStage1Quote(input, {
        selectedLoanAmount: input.desiredLoanAmount,
        targetPrice: effectiveTargetPrice,
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
        },
      };
    }

    const eligibility = evaluateOsbStage1Eligibility(input, input.desiredLoanAmount);
    const quote = calculateOsbStage1Quote(input, {
      selectedLoanAmount: input.desiredLoanAmount,
      targetPrice: effectiveTargetPrice,
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
      },
    };
  }, [engine, input, effectiveTargetPrice, tolerance]);

  const { eligibility, quote, targetQuote } = activeResult;
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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Stage 1 Pricing Tester</h1>
            <p className="mt-2 text-sm text-slate-600">
              Internal harness for workbook-driven stage 1 pricing. Button, Vista, OSB, and NewRez all adapt into the same execution contract.
            </p>
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">Available engines: Button, Vista, OSB, and NewRez</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Engine Toggle</div>
            <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
              {(['Button', 'Vista', 'OSB', 'NewRez'] as const).map(option => (
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
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">Product</div>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.product} onChange={e => update('product', e.target.value)}>
                    <option value="HELOC">HELOC</option>
                    <option value="CES">CES</option>
                  </select>
                </label>
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
                        { value: '30/15yr Balloon', label: '30/15 Balloon' },
                        { value: '40/15yr Balloon', label: '40/15 Balloon' },
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

              <label className="flex items-center gap-2 pt-7 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={Boolean(input.cashOut)} onChange={e => update('cashOut', e.target.checked)} />
                Cash out
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Target Purchase Price Override</div>
                <input type="number" step="0.001" placeholder={String(getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0)))} className="w-full rounded-lg border border-slate-300 px-3 py-2" value={targetPriceOverride} onChange={e => setTargetPriceOverride(e.target.value)} />
                <div className="mt-1 text-xs text-slate-500">Auto target from loan amount: {effectiveTargetPrice.toFixed(3)}</div>
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
                  <Metric label="Within Tolerance" value={targetQuote.withinTolerance ? 'Yes' : 'No'} />
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
