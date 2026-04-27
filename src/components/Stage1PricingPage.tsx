'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ArcHomeLockPeriodDays, ArcHomeProduct, BestExDrawPeriodYears, BestExLockPeriodDays, BestExProduct, BestExTermYears, ButtonDocType, DeephavenDocType, DeephavenLockPeriodDays, DeephavenProduct, InvestorSummary, NewRezProduct, OsbLockPeriod, OsbProduct, OsbProgram, PricingViewEngine, SharedDocType, Stage1PricingResponse, TesterInput, VerusDocType, VerusDrawPeriodYears, VerusLockPeriodDays, VerusProduct, VerusProgram, VistaDocType, VistaProduct } from '@/lib/stage1-pricing/types';
import { defaultInput } from '@/lib/stage1-pricing/types';

type Mode = 'pricer' | 'tester';

type DraftForm = {
  propertyState: string;
  propertyValue: string;
  loanBalance: string;
  desiredLoanAmount: string;
  combinedLtv: string;
  creditScore: string;
  dti: string;
  targetPriceOverride: string;
  manualRateOverride: string;
  tolerance: string;
};

type PointsAndFeesAlert = {
  isOverLimit: boolean;
  totalUpfrontCostPct: number;
  capPct: number | null;
  note: string | null;
};

const TESTER_GATE_STORAGE_KEY = 'fal-stage1-tester-unlocked';
const STATE_POINTS_AND_FEES_CAPS: Partial<Record<string, number>> = {
  FL: 4,
  MD: 4,
};

function roundToThree(value: number) { return Number(value.toFixed(3)); }
function roundUpToEighth(value: number) {
  if (value >= 0) return Number((Math.ceil(value * 8) / 8).toFixed(3));
  return Number((Math.floor(value * 8) / 8).toFixed(3));
}
function getPointsAndFeesProgram(program: string, product: string): 'CES' | 'HELOC' | null {
  const combined = `${program} ${product}`.toUpperCase();
  if (combined.includes('HELOC') || combined.includes('HELPC')) return 'HELOC';
  if (combined.includes('ARC HOME') || combined.includes('CES') || combined.includes('2ND') || combined.includes('FIX') || combined.includes('SECOND') || combined.includes('MATURITY') || combined.includes('EQUITY ADVANTAGE')) return 'CES';
  return null;
}
function getPointsAndFeesAlert(propertyState: string | undefined, program: string, product: string, pointsLabel: string, pointsValue: number): PointsAndFeesAlert {
  const normalizedState = String(propertyState || '').trim().toUpperCase();
  const normalizedPointsLabel = pointsLabel.toUpperCase();
  const normalizedProgram = getPointsAndFeesProgram(program, product);
  const stateCapPct = normalizedState ? STATE_POINTS_AND_FEES_CAPS[normalizedState] ?? null : null;
  const totalUpfrontCostPct = normalizedPointsLabel === 'DISCOUNT POINTS' ? pointsValue : 0;
  const capPct = normalizedProgram === 'CES'
    ? (stateCapPct === null ? 3 : Math.min(3, stateCapPct))
    : normalizedProgram === 'HELOC'
      ? stateCapPct
      : null;
  const isOverLimit = capPct !== null && totalUpfrontCostPct > capPct + 0.0001;
  if (!isOverLimit) return { isOverLimit, totalUpfrontCostPct, capPct, note: null };
  const scope = normalizedProgram === 'CES'
    ? 'CES points-and-fees cap'
    : `${normalizedState || 'State'} HELOC points-and-fees cap`;
  return {
    isOverLimit,
    totalUpfrontCostPct,
    capPct,
    note: `Total upfront cost ${totalUpfrontCostPct.toFixed(3)}% exceeds the ${capPct.toFixed(3)}% ${scope}.`,
  };
}
function toDraftForm(input: TesterInput, targetPriceOverride = '', manualRateOverride = '', tolerance = 0.125): DraftForm {
  const propertyValue = Number(input.propertyValue || 0);
  const combinedLtv = propertyValue > 0 ? (((Number(input.loanBalance || 0) + Number(input.desiredLoanAmount || 0)) / propertyValue) * 100) : 0;
  return {
    propertyState: input.propertyState ?? '',
    propertyValue: String(input.propertyValue ?? 0),
    loanBalance: String(input.loanBalance ?? 0),
    desiredLoanAmount: String(input.desiredLoanAmount ?? 0),
    combinedLtv: combinedLtv.toFixed(3),
    creditScore: String(input.creditScore ?? 0),
    dti: String(input.dti ?? 35),
    targetPriceOverride,
    manualRateOverride,
    tolerance: String(tolerance),
  };
}

export function Stage1PricingPage({ mode }: { mode: Mode }) {
  const [gateChecked, setGateChecked] = useState(mode === 'pricer');
  const [isUnlocked, setIsUnlocked] = useState(mode === 'pricer');
  const [password, setPassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [engine, setEngine] = useState<PricingViewEngine>('BestX');
  const [input, setInput] = useState<TesterInput>(defaultInput);
  const [draft, setDraft] = useState<DraftForm>(() => toDraftForm(defaultInput));
  const [lastEditedAmount, setLastEditedAmount] = useState<'desiredLoanAmount' | 'combinedLtv'>('desiredLoanAmount');
  const [response, setResponse] = useState<Stage1PricingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedBestX, setExpandedBestX] = useState<Record<string, boolean>>({});
  const [unlockingTester, setUnlockingTester] = useState(false);

  useEffect(() => {
    if (mode !== 'tester') return;
    const unlocked = window.localStorage.getItem(TESTER_GATE_STORAGE_KEY) === 'true';
    setIsUnlocked(unlocked);
    setGateChecked(true);
  }, [mode]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setInput(prev => {
        const propertyValue = Number(draft.propertyValue || 0);
        const loanBalance = Number(draft.loanBalance || 0);
        const desiredLoanAmount = lastEditedAmount === 'combinedLtv'
          ? Math.max(0, roundToThree((propertyValue * (Number(draft.combinedLtv || 0) / 100)) - loanBalance))
          : Math.max(0, Number(draft.desiredLoanAmount || 0));
        return {
          ...prev,
          propertyState: draft.propertyState.toUpperCase(),
          propertyValue,
          loanBalance,
          desiredLoanAmount,
          creditScore: Number(draft.creditScore || 0),
          dti: Number(draft.dti || 0),
        };
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [draft, lastEditedAmount]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const endpoint = mode === 'pricer' ? '/api/pricer-stage1-pricing' : '/api/stage1-pricing';
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ engine, input, targetPriceOverride: draft.targetPriceOverride, manualRateOverride: draft.manualRateOverride, tolerance: Number(draft.tolerance || 0.125) }) });
        const data = await res.json();
        if (!cancelled) setResponse(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [engine, input, draft.targetPriceOverride, draft.manualRateOverride, draft.tolerance]);

  const activeResult = response?.activeResult ?? null;
  const eligibility = activeResult?.eligibility;
  const quote = activeResult?.quote;
  const targetQuote = activeResult?.targetQuote;
  const defaultBackendTargetPrice = response?.defaultBackendTargetPrice ?? 100;
  const maxPrice = activeResult?.maxPrice ?? 0;
  const combinedLtv = useMemo(() => {
    const propertyValue = Number(input.propertyValue || 0);
    if (propertyValue <= 0) return 0;
    return roundToThree((((Number(input.loanBalance || 0) + Number(input.desiredLoanAmount || 0)) / propertyValue) * 100));
  }, [input.loanBalance, input.desiredLoanAmount, input.propertyValue]);
  const pointsDelta = useMemo(() => roundToThree((quote?.purchasePrice ?? 0) - (response?.defaultBackendTargetPrice ?? 100)), [response?.defaultBackendTargetPrice, quote?.purchasePrice]);
  const pointsMetricLabel = pointsDelta >= 0 ? 'Rebate Points' : 'Discount Points';
  const pointsMetricValue = useMemo(() => roundUpToEighth(Math.abs(pointsDelta)), [pointsDelta]);
  const pointsAndFeesAlert = useMemo(() => {
    if (!quote) return null;
    return getPointsAndFeesAlert(input.propertyState, quote.program, quote.product, pointsMetricLabel, pointsMetricValue);
  }, [input.propertyState, pointsMetricLabel, pointsMetricValue, quote]);

  useEffect(() => {
    setDraft(prev => ({ ...prev, combinedLtv: combinedLtv.toFixed(3), desiredLoanAmount: String(input.desiredLoanAmount ?? 0) }));
  }, [combinedLtv, input.desiredLoanAmount]);

  function update<K extends keyof TesterInput>(key: K, value: TesterInput[K]) { setInput(prev => ({ ...prev, [key]: value })); }
  function updateDraft<K extends keyof DraftForm>(key: K, value: DraftForm[K]) { setDraft(prev => ({ ...prev, [key]: value })); }
  function updateButtonProduct(product: TesterInput['buttonProduct']) { setInput(prev => ({ ...prev, buttonProduct: product, buttonDocType: product === 'HELOC' ? 'Full Doc' : (prev.buttonDocType === 'Full Doc' || prev.buttonDocType === 'Bank Statement' || prev.buttonDocType === 'Asset Depletion' ? prev.buttonDocType : 'Full Doc') })); }
  function updateOsbProgram(program: OsbProgram) { setInput(prev => ({ ...prev, osbProgram: program, osbProduct: program === 'HELOC' ? '30 Year Maturity' : 'Fixed 30' })); }
  function updateVerusProgram(program: VerusProgram) { setInput(prev => ({ ...prev, verusProgram: program, verusProduct: program === 'HELOC' ? '30 YR' : '30 YR FIX' })); }
  async function unlockTester() {
    setUnlockingTester(true);
    setGateError('');
    try {
      const res = await fetch('/api/site-access-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGateError(data?.error || 'Unable to unlock tester.');
        return;
      }
      window.localStorage.setItem(TESTER_GATE_STORAGE_KEY, 'true');
      setIsUnlocked(true);
    } catch {
      setGateError('Unable to unlock tester.');
    } finally {
      setUnlockingTester(false);
    }
  }

  if (!gateChecked) return <div className="min-h-screen bg-slate-50" />;
  if (!isUnlocked) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-slate-900">Stage 1 Tester</h1><p className="mt-2 text-sm text-slate-600">Internal page. Enter the shared site-access password once on this browser to continue.</p><div className="mt-4 space-y-3"><input type="password" value={password} onChange={e => { setPassword(e.target.value); if (gateError) setGateError(''); }} onKeyDown={e => { if (e.key === 'Enter') unlockTester(); }} placeholder="Password" className="w-full rounded-lg border border-slate-300 px-3 py-2" />{gateError ? <div className="text-sm text-rose-700">{gateError}</div> : null}<button type="button" onClick={unlockTester} disabled={unlockingTester} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{unlockingTester ? 'Unlocking…' : 'Unlock tester'}</button></div></div></div>;

  return <div className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-6xl space-y-6"><div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between"><div><h1 className="text-3xl font-bold text-slate-900">{mode === 'tester' ? 'Stage 1 Pricing Tester' : 'Stage 1 LO Pricing View'}</h1><p className="mt-2 text-sm text-slate-600">{mode === 'tester' ? 'Internal harness for workbook-driven stage 1 pricing. Button, Arc Home, Vista, OSB, NewRez, Verus, and Deephaven all adapt into the same execution contract.' : 'LO-facing pricing view with discount points and buy price, without backend purchase or margin details.'}</p><div className="mt-3 text-xs font-semibold uppercase tracking-wide text-sky-700">Available engines: BestX, Button, Arc Home, Vista, OSB, NewRez, Verus, and Deephaven</div></div><div className="flex min-w-0 flex-col gap-1"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">Engine Toggle</div><div className="overflow-x-auto"><div className="flex w-max min-w-full gap-2 rounded-2xl bg-slate-100 p-1">{(['BestX', 'Button', 'Arc Home', 'Vista', 'OSB', 'NewRez', 'Verus', 'Deephaven'] as const).map(option => <button key={option} onClick={() => setEngine(option)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition ${engine === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{option}</button>)}</div></div></div></div><div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold text-slate-900">Inputs</h2><div className="grid gap-4 sm:grid-cols-2">{renderEngineFields(engine, input, update, updateButtonProduct, updateOsbProgram, updateVerusProgram)}<label className="text-sm"><div className="mb-1 font-medium text-slate-700">State</div><input className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.propertyState} onChange={e => updateDraft('propertyState', e.target.value)} /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Property Value</div><input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.propertyValue} onChange={e => updateDraft('propertyValue', e.target.value)} /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Current Loan Balance</div><input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.loanBalance} onChange={e => updateDraft('loanBalance', e.target.value)} /></label><div className="grid gap-4 sm:col-span-2 sm:grid-cols-2"><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Desired New Money</div><input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.desiredLoanAmount} onChange={e => { setLastEditedAmount('desiredLoanAmount'); updateDraft('desiredLoanAmount', e.target.value); }} /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">LTV</div><input type="number" step="0.001" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.combinedLtv} onChange={e => { setLastEditedAmount('combinedLtv'); updateDraft('combinedLtv', e.target.value); }} /></label></div><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Credit Score</div><input type="number" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.creditScore} onChange={e => updateDraft('creditScore', e.target.value)} /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">DTI</div><input type="number" step="0.01" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.dti} onChange={e => updateDraft('dti', e.target.value)} /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Occupancy</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.occupancy ?? ''} onChange={e => update('occupancy', e.target.value)}><option value="Owner-Occupied">Owner-Occupied</option><option value="Second Home">Second Home</option><option value="Investment">Investment</option></select></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Structure Type</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.structureType ?? ''} onChange={e => update('structureType', e.target.value)}><option value="SFR">SFR</option><option value="Condo">Condo</option><option value="Townhome">Townhome</option><option value="PUD">PUD</option><option value="2-4 Unit">2-4 Unit</option></select></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Number of Units</div><input type="number" min={1} max={4} className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.numberOfUnits ?? 1} onChange={e => update('numberOfUnits', Number(e.target.value))} /></label>{engine === 'Arc Home' && <><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Arc Home Term</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.arcHomeProduct ?? '30 Year Maturity'} onChange={e => update('arcHomeProduct', e.target.value as ArcHomeProduct)}><option value="10 Year Maturity">10 Year Maturity</option><option value="15 Year Maturity">15 Year Maturity</option><option value="20 Year Maturity">20 Year Maturity</option><option value="30 Year Maturity">30 Year Maturity</option></select></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Arc Home Lock Period</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.arcHomeLockPeriodDays ?? 45} onChange={e => update('arcHomeLockPeriodDays', Number(e.target.value) as ArcHomeLockPeriodDays)}><option value={15}>15 day</option><option value={30}>30 day</option><option value={45}>45 day</option><option value={60}>60 day</option><option value={75}>75 day</option><option value={90}>90 day</option></select></label></>}{engine === 'OSB' && input.osbProgram === 'HELOC' && <label className="text-sm"><div className="mb-1 font-medium text-slate-700">HELOC Draw Term</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.helocDrawTermYears ?? 5} onChange={e => update('helocDrawTermYears', Number(e.target.value) as 3 | 5 | 10)}><option value={10}>10 Years</option><option value={5}>5 Years</option><option value={3}>3 Years</option></select></label>}{engine === 'Verus' && <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Verus Doc Type</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusDocType ?? 'Standard'} onChange={e => update('verusDocType', e.target.value as VerusDocType)}><option value="Standard">Standard</option><option value="Alt Doc">Alt Doc</option></select></label>}{engine === 'Verus' && <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Verus Lock Period</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusLockPeriodDays ?? 45} onChange={e => update('verusLockPeriodDays', Number(e.target.value) as VerusLockPeriodDays)}><option value={30}>30 days</option><option value={45}>45 days</option><option value={60}>60 days</option></select></label>}{engine === 'Verus' && input.verusProgram === 'HELOC' && <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Verus Draw Period</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusDrawPeriodYears ?? 5} onChange={e => update('verusDrawPeriodYears', Number(e.target.value) as VerusDrawPeriodYears)}><option value={2}>2 Years</option><option value={3}>3 Years</option><option value={5}>5 Years</option></select></label>}{engine === 'OSB' && <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Lock Period</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.osbLockPeriodDays ?? 45} onChange={e => update('osbLockPeriodDays', Number(e.target.value) as OsbLockPeriod)}><option value={30}>30 day</option><option value={45}>45 day</option><option value={60}>60 day</option></select></label>}<label className="text-sm"><div className="mb-1 font-medium text-slate-700">Target Price</div><input type="number" step="0.001" placeholder="100" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.targetPriceOverride} onChange={e => updateDraft('targetPriceOverride', e.target.value)} /></label><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Target Rate</div><input type="number" step="0.125" placeholder="Use engine-selected rate" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.manualRateOverride} onChange={e => updateDraft('manualRateOverride', e.target.value)} /><div className="mt-1 text-xs text-slate-500">{mode === 'tester' ? 'Overrides the quote execution rate only. Target solver stays on purchase price.' : 'Leave blank to use normal BestX and engine-selected pricing. Enter a rate to show that rate across investors with the resulting discount points.'}</div></label>{mode === 'tester' && <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Tolerance</div><input type="number" step="0.001" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={draft.tolerance} onChange={e => updateDraft('tolerance', e.target.value)} /></label>}</div></div><div className="space-y-6"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Output</h2>{loading ? <div className="text-xs text-slate-500">Updating…</div> : null}</div>{engine === 'BestX' ? <div className="space-y-3">{(response?.results ?? []).map((result, index) => <BestXInvestorCard key={result.investor} result={result} index={index} mode={mode} propertyState={input.propertyState} expanded={Boolean(expandedBestX[result.investor])} onToggle={() => setExpandedBestX(prev => ({ ...prev, [result.investor]: !prev[result.investor] }))} />)}</div> : eligibility && quote ? <>{mode === 'pricer' ? <><div className={`mb-4 rounded-2xl border p-4 ${eligibility.eligible ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><div className={`text-sm font-semibold ${eligibility.eligible ? 'text-emerald-900' : 'text-red-900'}`}>{eligibility.eligible ? 'Eligible' : 'Ineligible'}</div><div className="mt-1 text-sm text-slate-700">Resulting CLTV: {(eligibility.resultingCltv * 100).toFixed(2)}% • Max Available: ${Math.round(eligibility.maxAvailable).toLocaleString()}</div>{!eligibility.eligible && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">{eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}</div><div className="grid gap-3 sm:grid-cols-2"><Metric label="Engine" value={quote.engine} /><Metric label="Program" value={quote.program} /><Metric label="Product" value={quote.product} /><Metric label="Max Available" value={`$${Math.round(quote.maxAvailable).toLocaleString()}`} /><Metric label="Rate" value={`${quote.rate.toFixed(3)}%`} /><Metric label="Note Rate Selected" value={`${quote.noteRate.toFixed(3)}%`} /><Metric label="Monthly Payment" value={`$${Math.round(quote.monthlyPayment).toLocaleString()}`} /><Metric label="Max LTV" value={`${(quote.maxLtv * 100).toFixed(1)}%`} /><Metric label={pointsMetricLabel} value={pointsMetricValue.toFixed(3)} alert={Boolean(pointsAndFeesAlert?.isOverLimit)} note={pointsAndFeesAlert?.note ?? undefined} /></div></> : <><div className={`mb-4 rounded-2xl border p-4 ${eligibility.eligible ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><div className={`text-sm font-semibold ${eligibility.eligible ? 'text-emerald-900' : 'text-red-900'}`}>{eligibility.eligible ? 'Eligible' : 'Ineligible'}</div><div className="mt-1 text-sm text-slate-700">Resulting CLTV: {(eligibility.resultingCltv * 100).toFixed(2)}% • Max Available: ${Math.round(eligibility.maxAvailable).toLocaleString()}</div>{!eligibility.eligible && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">{eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}</div><div className="grid gap-3 sm:grid-cols-2"><Metric label="Engine" value={quote.engine} /><Metric label="Program" value={quote.program} /><Metric label="Product" value={quote.product} /><Metric label="Max Available" value={`$${Math.round(quote.maxAvailable).toLocaleString()}`} /><Metric label="Rate" value={`${quote.rate.toFixed(3)}%`} /><Metric label="Note Rate Selected" value={`${quote.noteRate.toFixed(3)}%`} /><Metric label="Monthly Payment" value={`$${Math.round(quote.monthlyPayment).toLocaleString()}`} /><Metric label="Max LTV" value={`${(quote.maxLtv * 100).toFixed(1)}%`} /><Metric label="Target" value={defaultBackendTargetPrice.toFixed(3)} /><Metric label="Max" value={maxPrice.toFixed(3)} /><Metric label={pointsMetricLabel} value={pointsMetricValue.toFixed(3)} alert={Boolean(pointsAndFeesAlert?.isOverLimit)} note={pointsAndFeesAlert?.note ?? undefined} /><Metric label="Purchase Price" value={quote.purchasePrice.toFixed(3)} /><Metric label="Base Price" value={quote.basePrice.toFixed(3)} /><Metric label="LLPA Adj" value={quote.llpaAdjustment.toFixed(3)} /></div>{targetQuote && <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4"><div className="mb-3 text-sm font-semibold text-orange-900">Target Margin Solver</div><div className="grid gap-3 sm:grid-cols-2"><Metric label="Target Price" value={targetQuote.targetPrice.toFixed(3)} /><Metric label="Solved Rate" value={`${targetQuote.rate.toFixed(3)}%`} /><Metric label="Solved Note Rate" value={`${targetQuote.noteRate.toFixed(3)}%`} /><Metric label="Solved Purchase Price" value={targetQuote.purchasePrice.toFixed(3)} /><Metric label="Base Price @ Solved Rate" value={targetQuote.basePrice.toFixed(3)} /><Metric label="LLPA Adj @ Solved Rate" value={targetQuote.llpaAdjustment.toFixed(3)} /><Metric label="Delta From Target" value={targetQuote.deltaFromTarget.toFixed(3)} /><Metric label="Within Tolerance (Under Only)" value={targetQuote.withinTolerance ? 'Yes' : 'No'} /><Metric label="Within Tolerance (+/-)" value={targetQuote.withinToleranceAllowOverage ? 'Yes' : 'No'} /><Metric label="Tolerance" value={targetQuote.tolerance.toFixed(3)} /></div></div>}</>}{quote.adjustments.length > 0 && <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="mb-3 text-sm font-semibold text-sky-900">Execution Details</div><div className="space-y-2">{quote.adjustments.map(row => <div key={`${row.label}-${row.value}`} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-sm"><span className="text-slate-700">{row.label}</span><span className={`font-semibold ${row.value > 0 ? 'text-emerald-700' : row.value < 0 ? 'text-rose-700' : 'text-slate-600'}`}>{row.value.toFixed(3)}</span></div>)}</div></div>}{engine === 'Button' && <InfoBlock>Workbook sections in play: Button pricing ladder, FICO / CLTV matrix, occupancy, unit count, cash-out, and {input.buttonProduct === 'HELOC' ? `${input.helocDrawTermYears ?? 5} year draw period` : `${input.buttonTermYears ?? 20} year term`} adjustments.</InfoBlock>}{engine === 'Arc Home' && <InfoBlock>Workbook sections in play: Arc Home closed-end second lien base pricing, term, FICO / CLTV, loan amount, occupancy, DTI, property type, and lock-period pricing.</InfoBlock>}{engine === 'OSB' && <InfoBlock>Workbook sections in play: {input.osbProgram}, {quote.product}, credit / CLTV matrix, loan amount LLPAs, loan type LLPAs, property LLPAs, and {input.osbLockPeriodDays} day lock adjustment.</InfoBlock>}{engine === 'NewRez' && <InfoBlock>Workbook sections in play: {input.newrezProduct}, note-rate / end-seconds price ladder, FICO / CLTV matrix, occupancy, condo, self-employed, DTI, and loan amount adjustments from the Home Equity sheet.</InfoBlock>}{engine === 'Verus' && <InfoBlock>Workbook sections in play: {input.verusProgram}, {input.verusProduct}, plus the matching Verus pricing tab for {input.verusProgram === 'HELOC' ? (mode === 'tester' ? 'HELOC margins' : 'HELOC pricing') : input.verusDocType ?? 'Standard doc pricing'}.</InfoBlock>}{engine === 'Deephaven' && <InfoBlock>Workbook sections in play: Equity Advantage and Equity Advantage Elite, with best execution selected automatically for the chosen Deephaven term.</InfoBlock>}{mode === 'pricer' ? null : <div className="mt-6"><div className="mb-2 text-sm font-medium text-slate-700">Raw JSON</div><pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">{JSON.stringify({ engine, input, eligibility, quote, targetQuote, defaultBackendTargetPrice }, null, 2)}</pre></div>}</> : null}</div></div></div></div></div>;
}

function renderEngineFields(engine: PricingViewEngine, input: TesterInput, update: <K extends keyof TesterInput>(key: K, value: TesterInput[K]) => void, updateButtonProduct: (product: TesterInput['buttonProduct']) => void, updateOsbProgram: (program: OsbProgram) => void, updateVerusProgram: (program: VerusProgram) => void) {
  if (engine === 'BestX') return <div className="space-y-4 text-sm sm:col-span-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">Best Ex uses one normalized scenario, then prices each investor and marks unsupported combinations ineligible.</div><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Product</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExProduct ?? 'HELOC'} onChange={e => update('bestExProduct', e.target.value as BestExProduct)}><option value="HELOC">HELOC</option><option value="CES">CES</option></select></label>{input.bestExProduct === 'HELOC' ? <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Draw Period</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExDrawPeriodYears ?? 5} onChange={e => update('bestExDrawPeriodYears', Number(e.target.value) as BestExDrawPeriodYears)}><option value={3}>3 Years</option><option value={5}>5 Years</option><option value={10}>10 Years</option></select></label> : <label className="text-sm"><div className="mb-1 font-medium text-slate-700">Term</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.bestExTermYears ?? 30} onChange={e => update('bestExTermYears', Number(e.target.value) as BestExTermYears)}><option value={10}>10 Years</option><option value={15}>15 Years</option><option value={20}>20 Years</option><option value={25}>25 Years</option><option value={30}>30 Years</option></select></label>}<ToggleField label="Lock Period" value={String(input.bestExLockPeriodDays ?? 30)} options={[["15","15 Days"],["30","30 Days"],["45","45 Days"]]} onChange={value => update('bestExLockPeriodDays', Number(value) as BestExLockPeriodDays)} /><ToggleField label="Doc Type" value={input.bestExDocType ?? 'Full Doc'} options={[["Full Doc","Full Doc"],["Bank Statement","Bank Statement"],["1099","1099"],["Asset Depletion","Asset Depletion"],["P&L Only","P&L Only"],["WVOE","WVOE"]]} onChange={value => update('bestExDocType', value as SharedDocType)} colSpan /></div>;
  if (engine === 'Button') return <><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Product</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.buttonProduct} onChange={e => updateButtonProduct(e.target.value as TesterInput['buttonProduct'])}><option value="HELOC">HELOC</option><option value="CES">CES</option></select></label>{input.buttonProduct === 'CES' ? <ToggleField label="Button Term" value={String(input.buttonTermYears ?? 20)} options={[['10','10 Year'],['15','15 Year'],['20','20 Year'],['25','25 Year'],['30','30 Year']]} onChange={value => update('buttonTermYears', Number(value) as 10 | 15 | 20 | 25 | 30)} /> : <ToggleField label="Button Draw Period" value={String(input.helocDrawTermYears ?? 5)} options={[['3','3 Year'],['5','5 Year'],['10','10 Year']]} onChange={value => update('helocDrawTermYears', Number(value) as 3 | 5 | 10)} />}{input.buttonProduct === 'HELOC' ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Button HELOC is full-doc only. Alt-doc pricing is limited to CES.</div> : <ToggleField label="Button Doc Type" value={input.buttonDocType ?? 'Full Doc'} options={[['Full Doc','Full Doc'],['Bank Statement','Bank Statement'],['Asset Depletion','Asset Depletion']]} onChange={value => update('buttonDocType', value as ButtonDocType)} />}</>;
  if (engine === 'Vista') return <><ToggleField label="Vista Term" value={input.vistaProduct ?? '30yr Fixed'} options={[['30yr Fixed','30 Fixed'],['20yr Fixed','20 Fixed'],['15yr Fixed','15 Fixed'],['10yr Fixed','10 Fixed']]} onChange={value => update('vistaProduct', value as VistaProduct)} /><ToggleField label="Vista Doc Type" value={input.vistaDocType ?? 'Full Doc'} options={[['Full Doc','Full Doc'],['Bank Statement','Bank Statement'],['1099','1099'],['Asset Depletion','Asset Depletion'],['P&L Only','P&L Only'],['WVOE','WVOE']]} onChange={value => update('vistaDocType', value as VistaDocType)} /><ToggleField label="Vista Lock Period" value={String(input.vistaLockPeriodDays ?? 45)} options={[['30','30 day'],['45','45 day'],['60','60 day']]} onChange={value => update('vistaLockPeriodDays', Number(value) as 30 | 45 | 60)} /></>;
  if (engine === 'NewRez') return <><ToggleField label="NewRez Term" value={input.newrezProduct ?? '30 Year Fixed'} options={[['30 Year Fixed','30 Year'],['20 Year Fixed','20 Year'],['15 Year Fixed','15 Year']]} onChange={value => update('newrezProduct', value as NewRezProduct)} colSpan /><ToggleField label="NewRez Lock Period" value={String(input.newrezLockPeriodDays ?? 30)} options={[['15','15 Day'],['30','30 Day'],['45','45 Day'],['60','60 Day']]} onChange={value => update('newrezLockPeriodDays', Number(value) as 15 | 30 | 45 | 60)} colSpan /></>;
  if (engine === 'Verus') return <><label className="text-sm"><div className="mb-1 font-medium text-slate-700">Verus Program</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.verusProgram} onChange={e => updateVerusProgram(e.target.value as VerusProgram)}><option value="CES">Closed End Second</option><option value="HELOC">HELOC</option></select></label><ToggleField label="Verus Term" value={input.verusProduct ?? (input.verusProgram === 'HELOC' ? '30 YR' : '30 YR FIX')} options={input.verusProgram === 'HELOC' ? [['15 YR','15 Year'],['20 YR','20 Year'],['25 YR','25 Year'],['30 YR','30 Year']] : [['10 YR FIX','10 Year'],['15 YR FIX','15 Year'],['20 YR FIX','20 Year'],['25 YR FIX','25 Year'],['30 YR FIX','30 Year']]} onChange={value => update('verusProduct', value as VerusProduct)} /></>;
  if (engine === 'Deephaven') return <div className="space-y-3 text-sm sm:col-span-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Deephaven prices both <span className="font-semibold">Equity Advantage</span> and <span className="font-semibold">Equity Advantage Elite</span> automatically. Full Doc is standard, and workbook-backed adjustments are applied separately for Bank Statement and P&amp;L Only where available.</div><ToggleField label="Deephaven Term" value={input.deephavenProduct ?? '30Y Fixed'} options={[['15Y Fixed','15 Year'],['20Y Fixed','20 Year'],['30Y Fixed','30 Year']]} onChange={value => update('deephavenProduct', value as DeephavenProduct)} /><ToggleField label="Deephaven Doc Type" value={input.deephavenDocType ?? 'Full Doc'} options={[['Full Doc','Full Doc'],['Bank Statement','Bank Statement'],['P&L Only','P&L Only']]} onChange={value => update('deephavenDocType', value as DeephavenDocType)} /><ToggleField label="Deephaven Lock Period" value={String(input.deephavenLockPeriodDays ?? 30)} options={[['15','15 day pad'],['30','30 day pad']]} onChange={value => update('deephavenLockPeriodDays', Number(value) as DeephavenLockPeriodDays)} /></div>;
  if (engine === 'Arc Home') return <div className="space-y-3 text-sm sm:col-span-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">Arc Home uses the closed-end second lien base pricing matrix with term, FICO / CLTV, loan amount, occupancy, DTI, property type, and lock-period adjustments.</div><ToggleField label="Arc Home Term" value={input.arcHomeProduct ?? '30 Year Maturity'} options={[['10 Year Maturity','10 Year'],['15 Year Maturity','15 Year'],['20 Year Maturity','20 Year'],['30 Year Maturity','30 Year']]} onChange={value => update('arcHomeProduct', value as ArcHomeProduct)} /><ToggleField label="Arc Home Lock Period" value={String(input.arcHomeLockPeriodDays ?? 45)} options={[['15','15 day'],['30','30 day'],['45','45 day'],['60','60 day'],['75','75 day'],['90','90 day']]} onChange={value => update('arcHomeLockPeriodDays', Number(value) as ArcHomeLockPeriodDays)} /></div>;
  return <><label className="text-sm"><div className="mb-1 font-medium text-slate-700">OSB Program</div><select className="w-full rounded-lg border border-slate-300 px-3 py-2" value={input.osbProgram} onChange={e => updateOsbProgram(e.target.value as OsbProgram)}><option value="HELOC">HELOC</option><option value="2nd Liens">2nd Liens</option></select></label><ToggleField label="OSB Term" value={input.osbProduct ?? (input.osbProgram === 'HELOC' ? '30 Year Maturity' : 'Fixed 30')} options={input.osbProgram === 'HELOC' ? [['20 Year Maturity','20 Year'],['30 Year Maturity','30 Year']] : [['Fixed 10','10 Year'],['Fixed 15','15 Year'],['Fixed 20','20 Year'],['Fixed 30','30 Year']]} onChange={value => update('osbProduct', value as OsbProduct)} /></>;
}

function Metric({ label, value, alert = false, note }: { label: string; value: string; alert?: boolean; note?: string }) { return <div className={`rounded-xl p-3 ${alert ? 'border border-rose-200 bg-rose-50' : 'bg-slate-50'}`}><div className={`text-xs font-medium uppercase tracking-wide ${alert ? 'text-rose-700' : 'text-slate-500'}`}>{label}</div><div className={`mt-1 text-lg font-semibold ${alert ? 'text-rose-700' : 'text-slate-900'}`}>{value}</div>{note ? <div className={`mt-2 text-xs ${alert ? 'text-rose-700' : 'text-slate-500'}`}>{note}</div> : null}</div>; }
function InfoBlock({ children }: { children: React.ReactNode }) { return <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">{children}</div>; }
function BestXInvestorCard({ result, index, mode, propertyState, expanded, onToggle }: { result: InvestorSummary; index: number; mode: Mode; propertyState: string | undefined; expanded: boolean; onToggle: () => void; }) { const pointsLabel = result.deltaFromTarget >= 0 ? 'Rebate Points' : 'Discount Points'; const alert = getPointsAndFeesAlert(propertyState, result.quote.program, result.quote.product, pointsLabel, result.discountPoints); const hasLadder = result.priceLadder.length > 0; return <div className={`rounded-2xl border p-4 ${result.eligibility.eligible ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-slate-50'}`}><div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="min-w-0 break-words text-lg font-semibold text-slate-900">{result.investor}</div>{result.eligibility.eligible ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">#{index + 1}</span> : <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Ineligible</span>}</div><div className="mt-1 text-sm text-slate-600">{result.quote.program} • {result.quote.product}</div></div><div className="grid w-full gap-3 sm:min-w-[280px] sm:w-auto sm:grid-cols-2"><Metric label="Rate" value={`${result.quote.rate.toFixed(3)}%`} /><Metric label={pointsLabel} value={result.discountPoints.toFixed(3)} alert={alert.isOverLimit} note={alert.note ?? undefined} /></div></div><div className="mt-3 text-sm text-slate-600">Max available: ${Math.round(result.eligibility.maxAvailable).toLocaleString()} • Max LTV: {(result.quote.maxLtv * 100).toFixed(1)}% • Payment: ${Math.round(result.quote.monthlyPayment).toLocaleString()}</div>{mode === 'tester' && <div className="mt-2 text-sm text-slate-600">Target: {result.targetPrice.toFixed(3)} • Max: {result.maxPrice.toFixed(3)}</div>}{hasLadder && <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50"><button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900"><span>Pricing ladder, 97 - 103</span><span className="text-xs font-medium text-slate-500">{expanded ? 'Hide' : 'Show'}</span></button>{expanded && <div className="border-t border-slate-200 p-3"><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="grid grid-cols-[1.1fr,0.8fr,0.9fr,1fr] gap-0 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><div>Target</div><div>Rate</div><div>Note Rate</div><div>Discount / Rebate</div></div><div className="divide-y divide-slate-200">{result.priceLadder.map(row => <div key={`${result.investor}-${row.targetPrice}`} className={`grid grid-cols-[1.1fr,0.8fr,0.9fr,1fr] gap-0 px-3 py-2 text-sm ${row.highlighted ? 'bg-amber-50' : 'bg-white'}`}><div className="font-semibold text-slate-900">{row.targetPrice.toFixed(0)}{row.cappedTargetPrice !== row.targetPrice ? <span className="ml-2 text-xs font-medium text-slate-500">(capped to {row.cappedTargetPrice.toFixed(3)})</span> : null}</div><div>{row.rate.toFixed(3)}%</div><div>{row.noteRate.toFixed(3)}%</div><div className={`font-semibold ${row.pointsLabel === 'Rebate' ? 'text-emerald-700' : 'text-rose-700'}`}>{row.pointsValue.toFixed(3)} {row.pointsLabel} Points</div></div>)}</div></div></div>}</div>}{result.quote.adjustments.length > 0 && <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="mb-3 text-sm font-semibold text-sky-900">Execution Details</div><div className="space-y-2">{result.quote.adjustments.map(row => <div key={`${result.investor}-${row.label}-${row.value}`} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-sm"><span className="text-slate-700">{row.label}</span><span className={`font-semibold ${row.value > 0 ? 'text-emerald-700' : row.value < 0 ? 'text-rose-700' : 'text-slate-600'}`}>{row.value.toFixed(3)}</span></div>)}</div></div>}{!result.eligibility.eligible && result.eligibility.reasons.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-700">{result.eligibility.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}</div>; }
function ToggleField({ label, value, options, onChange, colSpan = false }: { label: string; value: string; options: string[][]; onChange: (value: string) => void; colSpan?: boolean }) { return <div className={`space-y-3 text-sm ${colSpan ? 'sm:col-span-2' : ''}`}><div><div className="mb-1 font-medium text-slate-700">{label}</div><div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100 p-1">{options.map(([optionValue, optionLabel]) => <button key={optionValue} type="button" onClick={() => onChange(optionValue)} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${value === optionValue ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{optionLabel}</button>)}</div></div></div>; }
