'use client';

import { useMemo, useState } from 'react';
import { calculateButtonStage1Quote, evaluateButtonStage1Eligibility, getTargetPurchasePriceForLoanAmount, type ButtonStage1Input } from '@/lib/rates/button';
import { calculateNewRezStage1Quote, evaluateNewRezStage1Eligibility, type NewRezProduct } from '@/lib/rates/newrez';
import { calculateDeephavenStage1Quote, evaluateDeephavenStage1Eligibility, type DeephavenProduct, type DeephavenProgram } from '@/lib/rates/deephaven';
import { calculateOsbStage1Quote, evaluateOsbStage1Eligibility, type OsbLockPeriod, type OsbProduct, type OsbProgram } from '@/lib/rates/osb';
import { calculateVerusStage1Quote, evaluateVerusStage1Eligibility, type VerusDocType, type VerusDrawPeriodYears, type VerusLockPeriodDays, type VerusProduct, type VerusProgram } from '@/lib/rates/verus';
import { calculateVistaStage1Quote, evaluateVistaStage1Eligibility, type VistaProduct } from '@/lib/rates/vista';
import type { Stage1Eligibility, Stage1ExecutionQuote } from '@/lib/rates/shared';

type BestExecutionInput = ButtonStage1Input & {
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

const defaultInput: BestExecutionInput = {
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

export default function BestExecutionPage() {
  const [input, setInput] = useState<BestExecutionInput>(defaultInput);

  const effectiveTargetPrice = useMemo(() => getTargetPurchasePriceForLoanAmount(Number(input.desiredLoanAmount || 0)), [input.desiredLoanAmount]);

  const results = useMemo<InvestorSummary[]>(() => {
    const selectedLoanAmount = Number(input.desiredLoanAmount || 0);

    const buttonEligibility = evaluateButtonStage1Eligibility(input, selectedLoanAmount);
    const buttonQuote = calculateButtonStage1Quote(input, {
      selectedLoanAmount,
      cesTermYears: input.buttonTermYears,
      helocDrawTermYears: input.helocDrawTermYears,
    });

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

    return raw
      .map(item => {
        const discountPoints = Number((effectiveTargetPrice - item.quote.purchasePrice).toFixed(3));
        const buyPrice = Number((100 - discountPoints).toFixed(3));
        return { ...item, discountPoints, buyPrice };
      })
      .sort((a, b) => {
        if (a.eligibility.eligible !== b.eligibility.eligible) return a.eligibility.eligible ? -1 : 1;
        if (a.eligibility.eligible && b.eligibility.eligible) {
          if (b.buyPrice !== a.buyPrice) return b.buyPrice - a.buyPrice;
          if (a.quote.rate !== b.quote.rate) return a.quote.rate - b.quote.rate;
        }
        return a.investor.localeCompare(b.investor);
      });
  }, [input, effectiveTargetPrice]);

  function update<K extends keyof BestExecutionInput>(key: K, value: BestExecutionInput[K]) {
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
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Best Execution</h1>
          <p className="mt-2 text-sm text-slate-600">Enter the scenario once, then compare every investor side by side by rate, discount points, and LO-facing buy price.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Inputs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Property State</div>
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase" value={input.propertyState || ''} onChange={e => update('propertyState', e.target.value.toUpperCase())} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Property Value</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={Number(input.propertyValue || 0)} onChange={e => update('propertyValue', Number(e.target.value))} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Current Loan Balance</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={Number(input.loanBalance || 0)} onChange={e => update('loanBalance', Number(e.target.value))} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Desired Loan Amount</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={Number(input.desiredLoanAmount || 0)} onChange={e => update('desiredLoanAmount', Number(e.target.value))} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Credit Score</div>
                <input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={Number(input.creditScore || 0)} onChange={e => update('creditScore', Number(e.target.value))} />
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Occupancy</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.occupancy || 'Owner-Occupied'} onChange={e => update('occupancy', e.target.value)}>
                  <option value="Owner-Occupied">Owner-Occupied</option>
                  <option value="Second Home">Second Home</option>
                  <option value="Investment">Investment</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Property Type</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.structureType || 'SFR'} onChange={e => update('structureType', e.target.value)}>
                  <option value="SFR">SFR</option>
                  <option value="Condo">Condo</option>
                  <option value="Townhome">Townhome</option>
                  <option value="PUD">PUD</option>
                  <option value="2-4 Unit">2-4 Unit</option>
                </select>
              </label>
              <label className="text-sm">
                <div className="mb-1 font-medium text-slate-700">Units</div>
                <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={Number(input.numberOfUnits || 1)} onChange={e => update('numberOfUnits', Number(e.target.value))}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>

              <div className="sm:col-span-2 mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">Investor product settings</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Button Product</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.buttonProduct} onChange={e => update('buttonProduct', e.target.value)}>
                      <option value="HELOC">HELOC</option>
                      <option value="CES">CES</option>
                    </select>
                  </label>
                  {input.buttonProduct === 'CES' ? (
                    <label className="text-sm">
                      <div className="mb-1 font-medium text-slate-700">Button Term</div>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.buttonTermYears ?? 20} onChange={e => update('buttonTermYears', Number(e.target.value) as 10 | 15 | 20 | 25 | 30)}>
                        <option value={10}>10 Year</option>
                        <option value={15}>15 Year</option>
                        <option value={20}>20 Year</option>
                        <option value={25}>25 Year</option>
                        <option value={30}>30 Year</option>
                      </select>
                    </label>
                  ) : (
                    <label className="text-sm">
                      <div className="mb-1 font-medium text-slate-700">Button HELOC Draw</div>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.helocDrawTermYears ?? 5} onChange={e => update('helocDrawTermYears', Number(e.target.value) as 3 | 5 | 10)}>
                        <option value={3}>3 Years</option>
                        <option value={5}>5 Years</option>
                        <option value={10}>10 Years</option>
                      </select>
                    </label>
                  )}

                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Vista Product</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.vistaProduct ?? '30yr Fixed'} onChange={e => update('vistaProduct', e.target.value as VistaProduct)}>
                      <option value="10yr Fixed">10yr Fixed</option>
                      <option value="15yr Fixed">15yr Fixed</option>
                      <option value="20yr Fixed">20yr Fixed</option>
                      <option value="30yr Fixed">30yr Fixed</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">NewRez Product</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.newrezProduct ?? '30 Year Fixed'} onChange={e => update('newrezProduct', e.target.value as NewRezProduct)}>
                      <option value="15 Year Fixed">15 Year Fixed</option>
                      <option value="20 Year Fixed">20 Year Fixed</option>
                      <option value="30 Year Fixed">30 Year Fixed</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">OSB Program</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.osbProgram ?? 'HELOC'} onChange={e => updateOsbProgram(e.target.value as OsbProgram)}>
                      <option value="HELOC">HELOC</option>
                      <option value="2nd Liens">2nd Liens</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">OSB Product</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.osbProduct ?? '30 Year Maturity'} onChange={e => update('osbProduct', e.target.value as OsbProduct)}>
                      {(input.osbProgram === 'HELOC'
                        ? ['20 Year Maturity', '30 Year Maturity']
                        : ['Fixed 10', 'Fixed 15', 'Fixed 20', 'Fixed 30']
                      ).map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">OSB Lock</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.osbLockPeriodDays ?? 45} onChange={e => update('osbLockPeriodDays', Number(e.target.value) as OsbLockPeriod)}>
                      <option value={15}>15 day</option>
                      <option value={45}>45 day</option>
                      <option value={60}>60 day</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Verus Program</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusProgram ?? 'CES'} onChange={e => updateVerusProgram(e.target.value as VerusProgram)}>
                      <option value="CES">CES</option>
                      <option value="HELOC">HELOC</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Verus Product</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusProduct ?? '30 YR FIX'} onChange={e => update('verusProduct', e.target.value as VerusProduct)}>
                      {(input.verusProgram === 'HELOC'
                        ? ['15 YR', '20 YR', '25 YR', '30 YR']
                        : ['10 YR FIX', '15 YR FIX', '20 YR FIX', '25 YR FIX', '30 YR FIX']
                      ).map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Verus Doc Type</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusDocType ?? 'Standard'} onChange={e => update('verusDocType', e.target.value as VerusDocType)}>
                      <option value="Standard">Standard</option>
                      <option value="Alt Doc">Alt Doc</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Verus Lock</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusLockPeriodDays ?? 45} onChange={e => update('verusLockPeriodDays', Number(e.target.value) as VerusLockPeriodDays)}>
                      <option value={30}>30 days</option>
                      <option value={45}>45 days</option>
                      <option value={60}>60 days</option>
                    </select>
                  </label>
                  {input.verusProgram === 'HELOC' && (
                    <label className="text-sm">
                      <div className="mb-1 font-medium text-slate-700">Verus Draw Period</div>
                      <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusDrawPeriodYears ?? 5} onChange={e => update('verusDrawPeriodYears', Number(e.target.value) as VerusDrawPeriodYears)}>
                        <option value={2}>2 Years</option>
                        <option value={3}>3 Years</option>
                        <option value={5}>5 Years</option>
                      </select>
                    </label>
                  )}

                  <label className="text-sm">
                    <div className="mb-1 font-medium text-slate-700">Deephaven Term</div>
                    <select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.deephavenProduct ?? '30Y Fixed'} onChange={e => update('deephavenProduct', e.target.value as DeephavenProduct)}>
                      <option value="15Y Fixed">15Y Fixed</option>
                      <option value="30Y Fixed">30Y Fixed</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Ranked executions</h2>
                <div className="text-sm text-slate-500">Auto target from loan amount: {effectiveTargetPrice.toFixed(3)}</div>
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
