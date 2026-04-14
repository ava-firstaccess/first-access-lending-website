'use client';

import { useMemo, useState } from 'react';
import { calculateButtonStage1Quote, evaluateButtonStage1Eligibility, getTargetPurchasePriceForLoanAmount, solveButtonStage1TargetRate, type ButtonStage1Input } from '@/lib/rates/button';
import { calculateVistaStage1Quote, evaluateVistaStage1Eligibility, solveVistaStage1TargetRate, type VistaProduct } from '@/lib/rates/vista';

type PricingEngine = 'Button' | 'Vista';
type TesterInput = ButtonStage1Input & { vistaProduct?: VistaProduct };

const defaultInput: TesterInput = {
  product: 'HELOC',
  vistaProduct: '30yr Fixed',
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
  const [engine, setEngine] = useState<PricingEngine>('Button');
  const [input, setInput] = useState<TesterInput>(defaultInput);
  const [targetPriceOverride, setTargetPriceOverride] = useState<string>('');
  const [tolerance, setTolerance] = useState(0.125);

  const effectiveTargetPrice = useMemo(() => {
    if (targetPriceOverride.trim()) return Number(targetPriceOverride);
    return getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0));
  }, [input.desiredLoanAmount, targetPriceOverride]);

  const buttonEligibility = useMemo(() => evaluateButtonStage1Eligibility(input, input.desiredLoanAmount), [input]);
  const buttonQuote = useMemo(() => calculateButtonStage1Quote(input), [input]);
  const buttonTargetQuote = useMemo(() => solveButtonStage1TargetRate(input, {
    targetPrice: effectiveTargetPrice,
    tolerance,
    selectedLoanAmount: input.desiredLoanAmount,
  }), [input, effectiveTargetPrice, tolerance]);

  const vistaEligibility = useMemo(() => evaluateVistaStage1Eligibility(input, input.desiredLoanAmount), [input]);
  const vistaQuote = useMemo(() => calculateVistaStage1Quote(input, {
    selectedLoanAmount: input.desiredLoanAmount,
    targetPrice: effectiveTargetPrice,
  }), [input, effectiveTargetPrice]);
  const vistaTargetQuote = useMemo(() => solveVistaStage1TargetRate(input, {
    targetPrice: effectiveTargetPrice,
    tolerance,
    selectedLoanAmount: input.desiredLoanAmount,
  }), [input, effectiveTargetPrice, tolerance]);

  const eligibility = engine === 'Button' ? buttonEligibility : vistaEligibility;
  const quote = engine === 'Button' ? buttonQuote : vistaQuote;
  const targetQuote = engine === 'Button' ? buttonTargetQuote : vistaTargetQuote;

  function update<K extends keyof TesterInput>(key: K, value: TesterInput[K]) {
    setInput(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Stage 1 Pricing Tester</h1>
            <p className="mt-2 text-sm text-slate-600">
              Internal harness for stage 1 pricing logic. Button stays intact, and Vista now runs off parsed workbook pricing plus real Second OO and Second NOO LLPAs.
            </p>
            <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">Available engines: Button and Vista</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Engine Toggle</div>
            <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
              {(['Button', 'Vista'] as PricingEngine[]).map(option => (
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
              ) : (
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">Vista Product</div>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.vistaProduct} onChange={e => update('vistaProduct', e.target.value as VistaProduct)}>
                    <option value="30yr Fixed">30yr Fixed</option>
                    <option value="20yr Fixed">20yr Fixed</option>
                    <option value="15yr Fixed">15yr Fixed</option>
                    <option value="10yr Fixed">10yr Fixed</option>
                    <option value="30/15yr Balloon">30/15yr Balloon</option>
                    <option value="40/15yr Balloon">40/15yr Balloon</option>
                  </select>
                </label>
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
                <Metric label="Max Available" value={`$${Math.round(quote.maxAvailable).toLocaleString()}`} />
                <Metric label="Program" value={engine === 'Vista' && 'program' in quote ? String(quote.program) : 'Button'} />
                <Metric label="Rate" value={`${quote.rate.toFixed(3)}%`} />
                <Metric label="Monthly Payment" value={`$${Math.round(quote.monthlyPayment).toLocaleString()}`} />
                <Metric label="Max LTV" value={`${(quote.maxLtv * 100).toFixed(1)}%`} />
                <Metric label="Note Rate" value={`${quote.noteRate.toFixed(3)}%`} />
                <Metric label="Purchase Price" value={quote.purchasePrice.toFixed(3)} />
                <Metric label="Base Price" value={quote.basePrice.toFixed(3)} />
                <Metric label="LLPA Adj" value={quote.llpaAdjustment.toFixed(3)} />
              </div>

              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                <div className="mb-3 text-sm font-semibold text-orange-900">Target Margin Solver</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Target Price" value={targetQuote.targetPrice.toFixed(3)} />
                  <Metric label="Solved Rate" value={`${targetQuote.rate.toFixed(3)}%`} />
                  <Metric label="Solved Purchase Price" value={targetQuote.purchasePrice.toFixed(3)} />
                  <Metric label="Base Price @ Solved Rate" value={targetQuote.basePrice.toFixed(3)} />
                  <Metric label="LLPA Adj @ Solved Rate" value={targetQuote.llpaAdjustment.toFixed(3)} />
                  <Metric label="Delta From Target" value={targetQuote.deltaFromTarget.toFixed(3)} />
                  <Metric label="Within Tolerance" value={targetQuote.withinTolerance ? 'Yes' : 'No'} />
                  <Metric label="Tolerance" value={targetQuote.tolerance.toFixed(3)} />
                </div>
              </div>

              {engine === 'Vista' && (
                <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-sky-900">Vista Execution Details</div>
                  <div className="space-y-2">
                    {vistaQuote.adjustments.map(row => (
                      <div key={`${row.label}-${row.value}`} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-sm">
                        <span className="text-slate-700">{row.label}</span>
                        <span className={`font-semibold ${row.value > 0 ? 'text-emerald-700' : row.value < 0 ? 'text-rose-700' : 'text-slate-600'}`}>{row.value.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>
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
