'use client';

import { useState } from 'react';
import AddressAutocomplete from '@/components/quote/AddressAutocomplete';

type PortalSession = {
  email: string;
  name?: string;
};

type OrderResult = {
  success: boolean;
  orderId: string;
  pdfUrl: string;
  address: string;
  emailedTo: string;
  value: number | null;
  fsd: number | null;
  maxFsd: number;
};

function currency(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function ProcessorAvmToolsPage({ session }: { session: PortalSession }) {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OrderResult | null>(null);

  function handleAddressChange(nextAddress: string, nextState?: string, nextZip?: string, nextCity?: string) {
    setAddress(nextAddress);
    setState(nextState || '');
    setZipcode(nextZip || '');
    setCity(nextCity || '');
    setError('');
    setResult(null);
  }

  async function handleSubmit() {
    if (!address.trim() || !city.trim() || !state.trim() || !zipcode.trim()) {
      setError('Select a full address from autocomplete so city, state, and ZIP are captured.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/lo-avm/clear-capital-order-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zipcode: zipcode.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || 'Failed to create Clear Capital PDF order.');
        return;
      }

      setResult(data as OrderResult);
    } catch {
      setError('Failed to create Clear Capital PDF order.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Loan Processor Portal</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">AVM Tools</h1>
              <p className="mt-2 text-sm text-slate-600">Signed in as {session.email}. Enter an address to create a Clear Capital order, fetch the PDF, email the link, and present the download here.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Order PDF</h2>
            <p className="mt-2 text-sm text-slate-600">This uses the Clear Capital Property Analytics API with the proven Postman flow and the current default max FSD.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Property address</label>
                <AddressAutocomplete value={address} onChange={handleAddressChange} placeholder="Start typing a property address" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">State</label>
                  <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase text-slate-900 outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">ZIP</label>
                  <input value={zipcode} onChange={(e) => setZipcode(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500" />
                </div>
              </div>

              {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Ordering PDF…' : 'Order PDF'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Current defaults</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>• Flow: Property Analytics order → order PDF URL</li>
                <li>• Email delivery: automatic to {session.email}</li>
                <li>• PDF link: shown in UI after success</li>
              </ul>
            </div>

            {result ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-emerald-950">PDF ready</h2>
                <div className="mt-4 space-y-3 text-sm text-emerald-900">
                  <div><span className="font-semibold">Address:</span> {result.address}</div>
                  <div><span className="font-semibold">Order ID:</span> {result.orderId}</div>
                  <div><span className="font-semibold">Estimated value:</span> {currency(result.value)}</div>
                  <div><span className="font-semibold">Returned FSD:</span> {result.fsd !== null ? result.fsd.toFixed(2) : '—'}</div>
                  <div><span className="font-semibold">Emailed to:</span> {result.emailedTo}</div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={result.pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Download PDF</a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
