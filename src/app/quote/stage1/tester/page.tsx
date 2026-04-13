'use client';

import { useMemo, useState } from 'react';
import { calculateButtonStage1Quote, solveButtonStage1TargetRate, type ButtonStage1Input } from '@/lib/rates/button';

const defaultInput: ButtonStage1Input = {
  product: 'HELOC',
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
  const [input, setInput] = useState<ButtonStage1Input>(defaultInput);
  const [targetPrice, setTargetPrice] = useState(106);
  const [tolerance, setTolerance] = useState(0.125);

  const quote = useMemo(() => calculateButtonStage1Quote(input), [input]);
  const targetQuote = useMemo(() => solveButtonStage1TargetRate(input, {
    targetPrice,
    tolerance,
    selectedLoanAmount: input.desiredLoanAmount,
  }), [input, targetPrice, tolerance]);

  function update<K extends keyof ButtonStage1Input>(key: K, value: ButtonStage1Input[K]) {
    setInput(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Stage 1 Button Pricer Tester</h1>
          <p className="mt-2 text-sm text-slate-600">
            Quick one-page harness for the current stage 1 Button-backed pricing logic.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Inputs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Product</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.product} onChange={e => update('product', e.target.value)}>
                  <option value="HELOC">HELOC</option>
                  <option value="CES">CES</option>
                </select>
              </label>

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
                <div className="mb-1 font-medium text-slate-700">Target Purchase Price</div>
                <input type="number" step="0.001" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={targetPrice} onChange={e => setTargetPrice(Number(e.target.value))} />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Tolerance</div>
                <input type="number" step="0.001" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={tolerance} onChange={e => setTolerance(Number(e.target.value))} />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Output</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Max Available" value={`$${Math.round(quote.maxAvailable).toLocaleString()}`} />
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
                <Metric label="Delta From Target" value={targetQuote.deltaFromTarget.toFixed(3)} />
                <Metric label="Within Tolerance" value={targetQuote.withinTolerance ? 'Yes' : 'No'} />
                <Metric label="Tolerance" value={targetQuote.tolerance.toFixed(3)} />
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-sm font-medium text-slate-700">Raw JSON</div>
              <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify({ input, quote, targetQuote }, null, 2)}</pre>
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
