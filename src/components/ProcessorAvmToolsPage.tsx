'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

type PciOrderRow = {
  orderId: string;
  referenceIdentifier: string | null;
  status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  orderedByEmail: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  estimatedCompletionDate: string | null;
  inspectionDate: string | null;
  holdReason: string | null;
  lastMessage: string | null;
  lastMessageUrgent: boolean;
  exportUrl: string | null;
  updatedAt: string | null;
};

type ReportResult = {
  success: boolean;
  orderId: string;
  reportUrl: string | null;
  reportDocumentId: string | null;
  reportDocumentType: string | null;
  reportFileName: string | null;
  exportUrl: string | null;
  exportAvailable: boolean;
};

function currency(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function statusLabel(value: string | null) {
  if (!value) return 'Unknown';
  return value.replace(/_/g, ' ');
}

function statusClasses(value: string | null) {
  switch (value) {
    case 'completed': return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'accepted':
    case 'assigned':
    case 'inspection_scheduled':
    case 'inspection_completed': return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'hold_added':
    case 'under_review':
    case 'eta_changed':
    case 'message_added': return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'declined':
    case 'canceled':
    case 'revision_denied': return 'border-rose-200 bg-rose-50 text-rose-800';
    default: return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

export function ProcessorAvmToolsPage({ session, initialPciOrders }: { session: PortalSession; initialPciOrders: PciOrderRow[] }) {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OrderResult | null>(null);
  const [search, setSearch] = useState('');
  const [reportLoadingOrderId, setReportLoadingOrderId] = useState<string | null>(null);
  const [reportError, setReportError] = useState('');

  const filteredPciOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return initialPciOrders;
    return initialPciOrders.filter((order) => [
      order.orderId,
      order.referenceIdentifier || '',
      order.status || '',
      order.address || '',
      order.city || '',
      order.state || '',
      order.zip || '',
      order.orderedByEmail || '',
      order.lastEventType || '',
      order.holdReason || '',
      order.lastMessage || '',
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [initialPciOrders, search]);

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

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  async function handleDownloadReport(orderId: string) {
    setReportLoadingOrderId(orderId);
    setReportError('');

    try {
      const response = await fetch(`/api/clear-capital/pci-report?orderId=${encodeURIComponent(orderId)}`, {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setReportError(data?.error || 'Failed to retrieve the PCI report.');
        return;
      }

      const payload = data as ReportResult;
      const nextUrl = payload.reportUrl || payload.exportUrl;
      if (!nextUrl) {
        setReportError('No PCI report URL is available yet for this order.');
        return;
      }

      window.open(nextUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setReportError('Failed to retrieve the PCI report.');
    } finally {
      setReportLoadingOrderId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Loan Processor Portal</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">AVM Tools</h1>
              <p className="mt-2 text-sm text-slate-600">Signed in as {session.email}. PDF orders stay one-and-done. PCI orders now have live webhook tracking, email alerts, and a searchable status table below.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
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
              <h2 className="text-lg font-semibold text-slate-900">PCI tracking</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>• Webhook receiver: live for Clear Capital valuation events</li>
                <li>• Email alerts: automatic to the stored processor email on each new status event</li>
                <li>• Searchable order table: below, with latest event, ETA, hold reasons, and export link when provided</li>
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

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">PCI orders</h2>
              <p className="mt-1 text-sm text-slate-600">Search by order ID, status, address, reference ID, processor email, hold reason, or webhook message.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PCI orders"
                className="w-full min-w-[260px] rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <button type="button" onClick={handleRefresh} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {reportError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{reportError}</div> : null}

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Latest event</th>
                    <th className="px-4 py-3">Timing</th>
                    <th className="px-4 py-3">Report</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredPciOrders.length ? filteredPciOrders.map((order) => (
                    <tr key={order.orderId} className="align-top">
                      <td className="px-4 py-4 text-slate-900">
                        <div className="font-semibold">{order.orderId}</div>
                        <div className="mt-1 text-xs text-slate-500">{order.referenceIdentifier || 'No reference ID'}</div>
                        <div className="mt-1 text-xs text-slate-500">{order.orderedByEmail || 'No processor email stored'}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="font-medium text-slate-900">{order.address || 'Awaiting order metadata'}</div>
                        <div className="mt-1 text-xs text-slate-500">{[order.city, order.state, order.zip].filter(Boolean).join(', ') || 'No address yet'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClasses(order.status)}`}>
                          {statusLabel(order.status)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="font-medium text-slate-900">{order.lastEventType || '—'}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(order.lastEventAt || order.updatedAt)}</div>
                        {order.exportUrl ? <a href={order.exportUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-sky-700 hover:text-sky-900">Open export</a> : null}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div>ETA: <span className="text-slate-900">{formatDateTime(order.estimatedCompletionDate)}</span></div>
                        <div className="mt-1">Inspection: <span className="text-slate-900">{formatDateTime(order.inspectionDate)}</span></div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <button
                          type="button"
                          onClick={() => handleDownloadReport(order.orderId)}
                          disabled={reportLoadingOrderId === order.orderId || order.status !== 'completed'}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {reportLoadingOrderId === order.orderId ? 'Loading…' : 'Download report'}
                        </button>
                        <div className="mt-2 text-xs text-slate-500">Fetches a fresh report URL from Clear Capital.</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {order.holdReason ? <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{order.holdReason}</div> : null}
                        {order.lastMessage ? <div className={`rounded-xl px-3 py-2 text-xs ${order.lastMessageUrgent ? 'border border-rose-200 bg-rose-50 text-rose-900' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>{order.lastMessage}</div> : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No PCI orders matched this search yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
