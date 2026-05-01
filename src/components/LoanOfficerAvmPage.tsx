'use client';

import { useEffect, useMemo, useState } from 'react';
import AddressAutocomplete from '@/components/quote/AddressAutocomplete';
import { getInvestorAvmRules, type AvmProviderName, type InvestorName } from '@/lib/rates/investor-confidence-rules';

type LoanOfficerPortalSession = {
  prefix: string;
  email: string;
  name?: string;
};

type BestXSidebarInvestor = {
  investor: string;
  program: string;
  product: string;
  eligible: boolean;
  reasons: string[];
  rate: number;
  discountPoints: number;
  maxAvailable: number;
  payment: number;
  maxLtv: number;
  noteRate: number;
};

type StoredScenario = {
  createdAt: string;
  officerEmail: string;
  officerPrefix: string;
  engine: string;
  investor: string;
  program: string;
  product: string;
  maxAvailable: number;
  desiredLoanAmount: number;
  combinedLtv: number;
  loanNumber?: string;
  rate?: number;
  noteRate?: number;
  monthlyPayment?: number;
  propertyState?: string;
  occupancy?: string;
  structureType?: string;
  creditScore?: number;
  verificationProvider?: string;
  verificationFsd?: number;
  propertyValue?: number;
  loanBalance?: number;
  bestXResults?: BestXSidebarInvestor[];
};

type ProviderDisplayRow = {
  provider: AvmProviderName;
  supported: boolean;
  maxFsdAllowed: number | null;
  date: string | null;
  fsd: number | null;
  fsdLabel?: string | null;
  value: number | null;
  reportLink?: string | null;
  source?: 'cache' | 'fresh' | null;
  orderStatus?: string | null;
  orderRunId?: string | null;
  providerProduct?: string | null;
  failureMessage?: string | null;
  requestedMaxFsd?: number | null;
  fsdThresholdStatus?: 'pending' | 'passed' | 'failed' | null;
  targetedInvestor?: string | null;
};

type LiveOrderResult = {
  cacheHit: boolean;
  addressId: string;
  cacheWindowDays: number;
  investor: string;
  providerRows: ProviderDisplayRow[];
  winnerProvider: AvmProviderName | null;
  latestOrderedAt: string | null;
  message: string;
};

const STORAGE_KEY = 'fal-lo-avm-scenario';
const KNOWN_PROVIDERS: AvmProviderName[] = [
  'HouseCanary',
  'Clear Capital',
  'Veros',
  'CA Value',
  'Black Knight (Valusure)',
];

const INVESTOR_NAME_MAP: Record<string, InvestorName> = {
  Button: 'Button',
  Vista: 'Vista',
  NewRez: 'NewRez',
  Verus: 'Verus',
  Deephaven: 'DeepHaven',
  'Arc Home': 'Arc',
  OSB: 'Onslow',
};

function getAvmProviderLabel(provider: AvmProviderName) {
  return provider === 'Veros' ? 'Vero Value' : provider;
}

export function LoanOfficerAvmPage({ session }: { session: LoanOfficerPortalSession }) {
  const [scenario, setScenario] = useState<StoredScenario | null>(null);
  const [selectedInvestor, setSelectedInvestor] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<AvmProviderName | null>(null);
  const [address, setAddress] = useState('');
  const [parsedCity, setParsedCity] = useState('');
  const [parsedState, setParsedState] = useState('');
  const [parsedZipcode, setParsedZipcode] = useState('');
  const [loanNumber, setLoanNumber] = useState('');
  const [liveOrderResult, setLiveOrderResult] = useState<LiveOrderResult | null>(null);
  const [orderError, setOrderError] = useState('');
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredScenario;
      setScenario(parsed);
      setSelectedInvestor(parsed.investor || parsed.bestXResults?.[0]?.investor || '');
      setLoanNumber(parsed.loanNumber || '');
    } catch {
      setScenario(null);
    }
  }, []);

  const sidebarInvestors = useMemo(() => {
    if (scenario?.bestXResults?.length) return scenario.bestXResults;
    if (!scenario) return [];
    return [{
      investor: scenario.investor,
      program: scenario.program,
      product: scenario.product,
      eligible: true,
      reasons: [],
      rate: Number(scenario.rate || 0),
      discountPoints: 0,
      maxAvailable: Number(scenario.maxAvailable || 0),
      payment: Number(scenario.monthlyPayment || 0),
      maxLtv: 0,
      noteRate: Number(scenario.noteRate || 0),
    }];
  }, [scenario]);

  const selectedSidebarInvestor = useMemo(() => {
    return sidebarInvestors.find((item) => item.investor === selectedInvestor) || sidebarInvestors[0] || null;
  }, [selectedInvestor, sidebarInvestors]);

  const selectedInvestorRuleName = useMemo(() => {
    return selectedSidebarInvestor ? INVESTOR_NAME_MAP[selectedSidebarInvestor.investor] || null : null;
  }, [selectedSidebarInvestor]);

  const baseProviderRows = useMemo<ProviderDisplayRow[]>(() => {
    if (!selectedInvestorRuleName) {
      return KNOWN_PROVIDERS.map((provider) => ({ provider, supported: false, maxFsdAllowed: null, date: null, fsd: null, value: null }));
    }
    const rules = getInvestorAvmRules(selectedInvestorRuleName);
    return KNOWN_PROVIDERS.map((provider) => {
      const rule = rules.find((entry) => entry.provider === provider) || null;
      return {
        provider,
        supported: Boolean(rule?.supported),
        maxFsdAllowed: rule?.maxFsdAllowed ?? null,
        date: null,
        fsd: null,
        value: null,
      };
    });
  }, [selectedInvestorRuleName]);

  const providerRows = useMemo<ProviderDisplayRow[]>(() => {
    const liveRows = new Map((liveOrderResult?.providerRows || []).map((row) => [row.provider, row]));
    return baseProviderRows.map((row) => ({ ...row, ...(liveRows.get(row.provider) || {}) }));
  }, [baseProviderRows, liveOrderResult]);

  useEffect(() => {
    const current = providerRows.find((row) => row.provider === selectedProvider && (row.supported || row.value !== null));
    if (current) return;
    const winner = liveOrderResult?.winnerProvider ? providerRows.find((row) => row.provider === liveOrderResult.winnerProvider) : null;
    const fallback = winner || providerRows.find((row) => row.supported) || providerRows.find((row) => row.value !== null) || null;
    setSelectedProvider(fallback?.provider || null);
  }, [providerRows, selectedProvider, liveOrderResult]);

  useEffect(() => {
    setScenario((prev) => {
      if (!prev) return prev;
      const nextLoanNumber = loanNumber.trim() || undefined;
      if (prev.loanNumber === nextLoanNumber) return prev;
      const nextScenario = { ...prev, loanNumber: nextLoanNumber };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextScenario));
      return nextScenario;
    });
  }, [loanNumber]);

  const selectedProviderRow = providerRows.find((row) => row.provider === selectedProvider) || null;
  const winnerRow = providerRows.find((row) => row.provider === (liveOrderResult?.winnerProvider || selectedProvider || '')) || selectedProviderRow;

  const displayedMaxLoanAmount = useMemo(() => {
    if (!selectedSidebarInvestor) return null;
    if (!winnerRow?.value || !selectedSidebarInvestor.maxLtv || scenario?.loanBalance === undefined) {
      return selectedSidebarInvestor.maxAvailable;
    }
    const newMaxLoan = (Number(winnerRow.value) * Number(selectedSidebarInvestor.maxLtv)) - Number(scenario.loanBalance || 0);
    return Math.max(0, newMaxLoan);
  }, [selectedSidebarInvestor, winnerRow, scenario?.loanBalance]);

  function handleAddressChange(nextAddress: string, nextState?: string, nextZipcode?: string, nextCity?: string) {
    setAddress(nextAddress);
    setParsedCity(nextCity || '');
    setParsedState(nextState || '');
    setParsedZipcode(nextZipcode || '');
    setLiveOrderResult(null);
    setOrderError('');
  }

  async function handleOrderAvm() {
    if (!selectedSidebarInvestor || !address.trim() || !parsedZipcode.trim()) {
      setOrderError('Select an investor and a full property address before ordering the AVM.');
      return;
    }

    setOrdering(true);
    setOrderError('');

    try {
      const response = await fetch('/api/lo-avm/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          city: parsedCity.trim(),
          state: parsedState.trim(),
          zipcode: parsedZipcode.trim(),
          loanNumber: loanNumber.trim(),
          investor: selectedSidebarInvestor.investor,
          engine: scenario?.engine,
          program: selectedSidebarInvestor.program,
          product: selectedSidebarInvestor.product,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setOrderError(data?.error || 'Failed to order AVM.');
        return;
      }

      setLiveOrderResult(data as LiveOrderResult);
      setSelectedProvider((data as LiveOrderResult).winnerProvider || selectedProvider || null);
    } catch {
      setOrderError('Failed to order AVM.');
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Loan Officer Portal</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">AVM workspace</h1>
              <p className="mt-2 text-sm text-slate-600">Signed in as {session.email}. BestX investors are the primary navigation here, and AVM provider eligibility updates as the user toggles investors.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">BestX investors</h2>
                <span className="text-xs font-medium text-slate-500">Click a rate to toggle</span>
              </div>
              {sidebarInvestors.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {sidebarInvestors.map((item) => {
                    const active = item.investor === (selectedSidebarInvestor?.investor || '');
                    return (
                      <button
                        key={item.investor}
                        type="button"
                        onClick={() => setSelectedInvestor(item.investor)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-sky-300 bg-sky-50 shadow-sm' : item.eligible ? 'border-slate-200 bg-white hover:border-slate-300' : 'border-slate-200 bg-slate-100 text-slate-500'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{item.investor}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.program} • {item.product}</div>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{item.eligible ? 'Eligible' : 'Ruled out'}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <MiniMetric label="BestX rate" value={item.rate ? `${item.rate.toFixed(3)}%` : '—'} />
                          <MiniMetric label="Discount points" value={formatPoints(item.discountPoints)} />
                          <MiniMetric label="Max loan" value={currency(item.maxAvailable)} />
                        </div>
                        {!item.eligible && item.reasons.length > 0 ? <div className="mt-2 text-xs text-slate-500">{item.reasons[0]}</div> : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No BestX handoff yet. Pull AVM from the LO pricer to populate this investor list.</div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Selected investor summary</h2>
              {selectedSidebarInvestor ? (
                <div className="mt-4 space-y-3">
                  <Metric label="Investor" value={selectedSidebarInvestor.investor} />
                  <Metric label="BestX rate" value={selectedSidebarInvestor.rate ? `${selectedSidebarInvestor.rate.toFixed(3)}%` : 'N/A'} />
                  <Metric label="Discount points" value={formatPoints(selectedSidebarInvestor.discountPoints)} />
                  <Metric label="Selected AVM max loan" value={currency(displayedMaxLoanAmount)} />
                  <Metric label="Current payment" value={currency(selectedSidebarInvestor.payment)} />
                </div>
              ) : (
                <div className="mt-4 text-sm text-slate-500">Select an investor after sending a scenario from the pricer.</div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Property address</h2>
                  <p className="mt-2 text-sm text-slate-600">City, state, and zip are still parsed behind the scenes from Google Places, but removed from the visible form.</p>
                </div>
                <button
                  type="button"
                  onClick={handleOrderAvm}
                  disabled={ordering || !selectedSidebarInvestor || !address.trim()}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ordering ? 'Ordering…' : 'Order AVM'}
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm md:col-span-2">
                  <div className="mb-1 font-medium text-slate-700">Street address</div>
                  <AddressAutocomplete value={address} onChange={handleAddressChange} placeholder="Start typing a property address" />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700">Loan number</div>
                  <input
                    type="text"
                    value={loanNumber}
                    onChange={e => setLoanNumber(e.target.value)}
                    placeholder="Enter loan number"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <div className="mt-1 text-xs text-slate-500">This will be sent as HouseCanary customer_order_id and Clear Capital trackingIds[0].</div>
                </label>
              </div>
              {(parsedCity || parsedState || parsedZipcode) ? <div className="mt-3 text-xs text-slate-500">Parsed: {[parsedCity, parsedState, parsedZipcode].filter(Boolean).join(', ')}</div> : null}
              {liveOrderResult ? <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${liveOrderResult.cacheHit ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{liveOrderResult.message}</div> : null}
              {orderError ? <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{orderError}</div> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Metric label="Address ID" value={liveOrderResult?.addressId || 'Pending cache / run wiring'} muted={!liveOrderResult} />
                <Metric label="Target investor" value={liveOrderResult?.investor || selectedSidebarInvestor?.investor || 'No investor yet'} muted={!selectedSidebarInvestor && !liveOrderResult?.investor} />
                <Metric label="Winner" value={winnerRow ? getAvmProviderLabel(winnerRow.provider) : 'No winner yet'} muted={!winnerRow} />
                <Metric label="Winner FSD" value={winnerRow?.fsdLabel || (winnerRow?.fsd !== null && winnerRow?.fsd !== undefined ? winnerRow.fsd.toFixed(2) : 'No winner yet')} muted={!winnerRow} />
              </div>
              {selectedProviderRow?.value !== null && selectedProviderRow?.value !== undefined ? (
                <div className={`mt-4 rounded-2xl border p-4 ${providerEligibleForInvestor(selectedProviderRow) ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Selected AVM result</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <Metric label="Provider" value={getAvmProviderLabel(selectedProviderRow.provider)} />
                    <Metric label="Value" value={currency(selectedProviderRow.value)} />
                    <Metric label="FSD" value={selectedProviderRow.fsdLabel || (selectedProviderRow.fsd !== null && selectedProviderRow.fsd !== undefined ? selectedProviderRow.fsd.toFixed(2) : '—')} />
                    <Metric label="Threshold used" value={selectedProviderRow.requestedMaxFsd !== null && selectedProviderRow.requestedMaxFsd !== undefined ? selectedProviderRow.requestedMaxFsd.toFixed(2) : '—'} />
                    <Metric label="Threshold result" value={formatThresholdStatus(selectedProviderRow.fsdThresholdStatus)} />
                    <Metric label="Max loan" value={currency(displayedMaxLoanAmount)} />
                  </div>
                  <div className={`mt-3 text-sm ${providerEligibleForInvestor(selectedProviderRow) ? 'text-emerald-800' : 'text-amber-800'}`}>{getProviderInvestorStatusMessage(selectedProviderRow)}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    Source: {selectedProviderRow.source === 'cache' ? (selectedProviderRow.orderRunId ? 'Loan officer cache' : 'Webapp cache') : selectedProviderRow.source === 'fresh' ? 'Fresh order' : '—'}
                    {selectedProviderRow.targetedInvestor ? ` • Targeted investor: ${selectedProviderRow.targetedInvestor}` : ''}
                    {selectedProviderRow.orderStatus ? ` • Order status: ${selectedProviderRow.orderStatus}` : ''}
                  </div>
                </div>
              ) : null}
              {winnerRow?.reportLink ? (
                <div className="mt-4">
                  <a href={winnerRow.reportLink} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                    Open latest report
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">AVM provider chart</h2>
                  <p className="mt-1 text-sm text-slate-600">Providers stay visible for every investor. Cached rows repopulate the grid without re-ordering the AVM when the address already exists in the 90-day window.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Cache window: reuse winner under 90 days old</div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[0.55fr,1.25fr,0.8fr,0.8fr,0.9fr,0.95fr,0.85fr] gap-0 bg-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <div>Pick</div>
                  <div>Provider</div>
                  <div>Date</div>
                  <div>FSD</div>
                  <div>Threshold</div>
                  <div>Value</div>
                  <div>Status</div>
                </div>
                <div className="divide-y divide-slate-200 bg-white">
                  {providerRows.map((row) => {
                    const rowEligible = providerEligibleForInvestor(row);
                    const checked = row.provider === selectedProvider;
                    return (
                      <div key={row.provider} className={`grid grid-cols-[0.55fr,1.25fr,0.8fr,0.8fr,0.9fr,0.95fr,0.85fr] gap-0 px-4 py-3 text-sm ${row.supported ? 'text-slate-900' : row.value !== null ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-400'} ${row.supported && !rowEligible ? 'bg-rose-50' : ''}`}>
                        <div className="flex items-center">
                          <input type="radio" checked={checked} disabled={!row.supported && row.value === null} onChange={() => setSelectedProvider(row.provider)} />
                        </div>
                        <div>
                          <div className="font-semibold">{getAvmProviderLabel(row.provider)}</div>
                          <div className="mt-1 text-xs text-slate-500">{getProviderRowSubtext(row)}</div>
                          {row.reportLink ? <a href={row.reportLink} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-medium text-sky-700 hover:text-sky-900">Open report</a> : null}
                        </div>
                        <div>{row.date || '—'}</div>
                        <div className={row.supported && !rowEligible ? 'font-semibold text-rose-700' : ''}>{row.fsdLabel || (row.fsd !== null ? row.fsd.toFixed(2) : '—')}</div>
                        <div>{row.requestedMaxFsd !== null && row.requestedMaxFsd !== undefined ? row.requestedMaxFsd.toFixed(2) : '—'}</div>
                        <div>{row.value !== null ? currency(row.value) : '—'}</div>
                        <div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${!row.supported && row.value === null ? 'bg-slate-200 text-slate-500' : row.fsdThresholdStatus === 'failed' ? 'bg-rose-100 text-rose-800' : row.fsdThresholdStatus === 'pending' ? 'bg-violet-100 text-violet-800' : !rowEligible && row.supported ? 'bg-amber-100 text-amber-800' : checked ? 'bg-sky-100 text-sky-800' : row.value !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                            {!row.supported && row.value === null ? 'Ruled out' : row.fsdThresholdStatus === 'failed' ? 'Threshold failed' : row.fsdThresholdStatus === 'pending' ? 'Threshold pending' : !rowEligible && row.supported ? 'FSD above max' : checked ? 'Selected' : row.value !== null ? (row.source === 'cache' ? 'Cached' : 'Ordered') : 'Allowed'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Scenario from /pricer</h2>
              {scenario ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Investor" value={scenario.investor} />
                  <Metric label="Program" value={scenario.program} />
                  <Metric label="Product" value={scenario.product} />
                  <Metric label="Target loan amount" value={currency(scenario.desiredLoanAmount)} />
                  <Metric label="Original balance" value={currency(scenario.loanBalance)} />
                  <Metric label="Combined CLTV" value={`${scenario.combinedLtv.toFixed(2)}%`} />
                  <Metric label="Loan number" value={scenario.loanNumber || 'Not set'} />
                  <Metric label="BestX rate" value={scenario.rate ? `${scenario.rate.toFixed(3)}%` : 'N/A'} />
                  <Metric label="Property state" value={scenario.propertyState || 'N/A'} />
                  <Metric label="Loan officer email" value={scenario.officerEmail} />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">No pricing scenario has been handed off yet. Open <span className="font-semibold">/pricer</span>, price a scenario, then click <span className="font-semibold">Pull AVM</span> on the investor you want.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function providerEligibleForInvestor(row: ProviderDisplayRow) {
  if (!row.supported) return false;
  if (row.fsd === null || row.maxFsdAllowed === null) return true;
  return row.fsd <= row.maxFsdAllowed + 0.0001;
}

function getProviderRowSubtext(row: ProviderDisplayRow) {
  const sourceLabel = row.source === 'cache'
    ? (row.orderRunId ? 'Loan officer cache' : 'Webapp cache')
    : row.source === 'fresh'
      ? 'Fresh order'
      : null;
  const thresholdLabel = row.requestedMaxFsd !== null && row.requestedMaxFsd !== undefined
    ? `Threshold ${row.requestedMaxFsd.toFixed(2)} ${formatThresholdStatus(row.fsdThresholdStatus).toLowerCase()}`
    : null;

  if (!row.supported) {
    const base = row.value !== null
      ? 'AVM result exists, but this investor does not allow that provider.'
      : 'Not allowed for this investor';
    return [base, sourceLabel].filter(Boolean).join(' • ');
  }
  if ((row.fsd !== null && row.maxFsdAllowed !== null && row.fsd > row.maxFsdAllowed + 0.0001) || row.fsdLabel) {
    return [`FSD above max for this investor: ${row.fsdLabel || `${row.fsd?.toFixed(2)} > ${row.maxFsdAllowed?.toFixed(2)}`}. A different investor may still allow it.`, sourceLabel, thresholdLabel].filter(Boolean).join(' • ');
  }
  if (row.maxFsdAllowed !== null) {
    return [`Investor max FSD ${row.maxFsdAllowed.toFixed(2)}`, sourceLabel, thresholdLabel].filter(Boolean).join(' • ');
  }
  return ['Allowed for this investor', sourceLabel, thresholdLabel].filter(Boolean).join(' • ');
}

function getProviderInvestorStatusMessage(row: ProviderDisplayRow) {
  if (!row.supported) {
    return 'This investor does not allow this AVM provider, even though an AVM result exists.';
  }
  if ((row.fsd !== null && row.maxFsdAllowed !== null && row.fsd > row.maxFsdAllowed + 0.0001) || row.fsdLabel) {
    return `This result is above the current investor max FSD, ${row.maxFsdAllowed?.toFixed(2) ?? 'n/a'}. Keep the AVM visible, but try another investor that allows a higher FSD.`;
  }
  if (row.fsdThresholdStatus === 'pending') {
    return 'This order recorded the investor threshold, but the provider result has not returned an FSD yet.';
  }
  return 'This AVM result is within the current investor FSD rule.';
}

function formatThresholdStatus(status: ProviderDisplayRow['fsdThresholdStatus']) {
  if (status === 'passed') return 'Passed';
  if (status === 'failed') return 'Failed';
  if (status === 'pending') return 'Pending';
  return '—';
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return <div className={`rounded-2xl p-4 ${muted ? 'bg-slate-100' : 'bg-slate-50'}`}><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div><div className={`mt-1 text-base font-semibold ${muted ? 'text-slate-500' : 'text-slate-900'}`}>{value}</div></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold text-slate-900">{value}</div></div>;
}

function currency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `$${Math.round(Number(value || 0)).toLocaleString()}`;
}

function formatPoints(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return Number(value).toFixed(3);
}
