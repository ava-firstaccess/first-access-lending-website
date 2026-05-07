'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AddressAutocomplete from '@/components/quote/AddressAutocomplete';

type PortalSession = {
  email: string;
  name?: string;
};

type PdfOrderResult = {
  success: boolean;
  orderId: string;
  pdfUrl: string;
  address: string;
  emailedTo: string;
  value: number | null;
  fsd: number | null;
  maxFsd: number;
};

type PciOrderResult = {
  success: boolean;
  orderId: string;
  address: string;
  productCode: string;
  referenceIdentifier: string;
  orderedByEmail: string;
};

type PciOrderRow = {
  orderId: string;
  referenceIdentifier: string | null;
  productCode: string | null;
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
  createdAt: string | null;
  updatedAt: string | null;
};

type PdfOrderRow = {
  runId: string;
  orderId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  orderedByEmail: string | null;
  requestedMaxFsd: number | null;
  cacheHit: boolean;
  value: number | null;
  fsd: number | null;
  completedSuccessfully: boolean | null;
  failureMessage: string | null;
  createdAt: string | null;
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

function eventLabel(value: string | null) {
  if (!value) return '—';
  if (value === 'OrderPlaced') return 'Order Placed';
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

function statusClasses(value: string | null) {
  switch (value) {
    case 'completed': return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'placed':
    case 'accepted':
    case 'assigned':
    case 'inspection_scheduled':
    case 'inspection_completed': return 'border-sky-200 bg-sky-50 text-sky-800';
    case 'cancel_requested':
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

export function ProcessorAvmToolsPage({ session, initialPciOrders, initialPdfOrders }: { session: PortalSession; initialPciOrders: PciOrderRow[]; initialPdfOrders: PdfOrderRow[] }) {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pciLoading, setPciLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formError, setFormError] = useState('');
  const [pdfResult, setPdfResult] = useState<PdfOrderResult | null>(null);
  const [pciResult, setPciResult] = useState<PciOrderResult | null>(null);
  const [search, setSearch] = useState('');
  const [reportLoadingOrderId, setReportLoadingOrderId] = useState<string | null>(null);
  const [cancelLoadingOrderId, setCancelLoadingOrderId] = useState<string | null>(null);
  const [reportError, setReportError] = useState('');

  const filteredPciOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return initialPciOrders;
    return initialPciOrders.filter((order) => [
      order.orderId,
      order.referenceIdentifier || '',
      order.productCode || '',
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

  const filteredPdfOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return initialPdfOrders;
    return initialPdfOrders.filter((order) => [
      order.runId,
      order.orderId || '',
      order.address || '',
      order.city || '',
      order.state || '',
      order.zip || '',
      order.orderedByEmail || '',
      order.failureMessage || '',
      order.cacheHit ? 'cache hit' : 'new order',
      order.completedSuccessfully === true ? 'success' : order.completedSuccessfully === false ? 'failed' : '',
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [initialPdfOrders, search]);

  const pdfSuccessCount = filteredPdfOrders.filter((order) => order.completedSuccessfully === true).length;
  const pdfFailureCount = filteredPdfOrders.filter((order) => order.completedSuccessfully === false).length;
  const pdfCacheHitCount = filteredPdfOrders.filter((order) => order.cacheHit).length;

  function handleAddressChange(nextAddress: string, nextState?: string, nextZip?: string, nextCity?: string) {
    setAddress(nextAddress);
    setState(nextState || '');
    setZipcode(nextZip || '');
    setCity(nextCity || '');
    setFormError('');
    setPdfResult(null);
    setPciResult(null);
  }

  function validateParsedAddress() {
    if (!address.trim() || !city.trim() || !state.trim() || !zipcode.trim()) {
      setFormError('Select a full property address from Google autocomplete so city, state, and ZIP are parsed automatically.');
      return false;
    }
    return true;
  }

  async function handleOrderPdf() {
    if (!validateParsedAddress()) return;

    setPdfLoading(true);
    setFormError('');
    setPdfResult(null);
    setPciResult(null);

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
        setFormError(data?.error || 'Failed to create Clear Capital PDF order.');
        return;
      }

      setPdfResult(data as PdfOrderResult);
    } catch {
      setFormError('Failed to create Clear Capital PDF order.');
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleOrderPci() {
    if (!validateParsedAddress()) return;

    setPciLoading(true);
    setFormError('');
    setPdfResult(null);
    setPciResult(null);

    try {
      const response = await fetch('/api/lo-avm/clear-capital-order-pci', {
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
        setFormError(data?.error || 'Failed to place Clear Capital PCI order.');
        return;
      }

      setPciResult(data as PciOrderResult);
      router.refresh();
    } catch {
      setFormError('Failed to place Clear Capital PCI order.');
    } finally {
      setPciLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  async function handleCancelOrder(orderId: string) {
    const confirmed = window.confirm('Cancel this PCI order? Clear Capital says cancellation depends on current order state.');
    if (!confirmed) return;

    setCancelLoadingOrderId(orderId);
    setReportError('');

    try {
      const response = await fetch('/api/clear-capital/pci-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setReportError(data?.error || 'Failed to cancel the PCI order.');
        return;
      }

      router.refresh();
    } catch {
      setReportError('Failed to cancel the PCI order.');
    } finally {
      setCancelLoadingOrderId(null);
    }
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
              <p className="mt-2 text-sm text-slate-600">Signed in as {session.email}. Use one Google-parsed property address to place either a one-and-done PDF order or a live PCI order that starts with Order Placed and then updates from webhook events.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Order Clear Capital report</h2>
            <p className="mt-2 text-sm text-slate-600">Use the Google address field only. City, state, and ZIP are parsed automatically from the selected property.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Property address</label>
                <AddressAutocomplete value={address} onChange={handleAddressChange} placeholder="Start typing a property address" />
                {(city || state || zipcode) ? (
                  <div className="mt-2 text-xs text-slate-500">Parsed: {[city, state, zipcode].filter(Boolean).join(', ')}</div>
                ) : null}
              </div>

              {formError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{formError}</div> : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleOrderPdf}
                  disabled={pdfLoading || pciLoading}
                  className="rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pdfLoading ? 'Ordering PDF…' : 'Order CC AVM PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleOrderPci}
                  disabled={pciLoading || pdfLoading}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pciLoading ? 'Placing PCI order…' : 'Order PCI'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Reporting visibility</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>• PDF orders and PCI orders both show up below for managers and processors.</li>
                <li>• Use <span className="font-semibold">Refresh</span> to pull the latest server-side state on demand.</li>
                <li>• PCI remains webhook-driven underneath, so refresh is just for visibility, not the actual status source.</li>
              </ul>
            </div>

            {pdfResult ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-emerald-950">PDF ready</h2>
                <div className="mt-4 space-y-3 text-sm text-emerald-900">
                  <div><span className="font-semibold">Address:</span> {pdfResult.address}</div>
                  <div><span className="font-semibold">Order ID:</span> {pdfResult.orderId}</div>
                  <div><span className="font-semibold">Estimated value:</span> {currency(pdfResult.value)}</div>
                  <div><span className="font-semibold">Returned FSD:</span> {pdfResult.fsd !== null ? pdfResult.fsd.toFixed(2) : '—'}</div>
                  <div><span className="font-semibold">Emailed to:</span> {pdfResult.emailedTo}</div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={pdfResult.pdfUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Download PDF</a>
                </div>
              </div>
            ) : null}

            {pciResult ? (
              <div className="rounded-3xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-sky-950">PCI order placed</h2>
                <div className="mt-4 space-y-3 text-sm text-sky-900">
                  <div><span className="font-semibold">Address:</span> {pciResult.address}</div>
                  <div><span className="font-semibold">Order ID:</span> {pciResult.orderId}</div>
                  <div><span className="font-semibold">Product:</span> {pciResult.productCode}</div>
                  <div><span className="font-semibold">Reference ID:</span> {pciResult.referenceIdentifier}</div>
                  <div><span className="font-semibold">Processor:</span> {pciResult.orderedByEmail}</div>
                </div>
                <p className="mt-4 text-sm text-sky-900">Latest Event is now <span className="font-semibold">Order Placed</span>. The next updates should come from Clear Capital webhook pings.</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Clear Capital reporting</h2>
              <p className="mt-1 text-sm text-slate-600">One shared visibility card for PDF AVM orders and PCI orders. Search by order ID, property, status, processor email, or notes.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Clear Capital orders"
                className="w-full min-w-[260px] rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500"
              />
              <button type="button" onClick={handleRefresh} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700">
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDF orders shown</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{filteredPdfOrders.length}</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">PDF successes</div>
              <div className="mt-2 text-2xl font-bold text-emerald-950">{pdfSuccessCount}</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">PDF cache hits</div>
              <div className="mt-2 text-2xl font-bold text-amber-950">{pdfCacheHitCount}</div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">PDF failures</div>
              <div className="mt-2 text-2xl font-bold text-rose-950">{pdfFailureCount}</div>
            </div>
          </div>

          {reportError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{reportError}</div> : null}

          <div className="mt-6">
            <h3 className="text-base font-semibold text-slate-900">PDF AVM orders</h3>
            <p className="mt-1 text-sm text-slate-600">These are the requests sent through the Clear Capital Property Analytics PDF flow, including cache hits and failures.</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Processor</th>
                      <th className="px-4 py-3">Result</th>
                      <th className="px-4 py-3">Value / FSD</th>
                      <th className="px-4 py-3">Requested FSD</th>
                      <th className="px-4 py-3">Ordered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredPdfOrders.length ? filteredPdfOrders.map((order) => (
                      <tr key={order.runId} className="align-top">
                        <td className="px-4 py-4 text-slate-900">
                          <div className="font-semibold">{order.orderId || 'No vendor order ID'}</div>
                          <div className="mt-1 text-xs text-slate-500">Run {order.runId.slice(0, 8)}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div className="font-medium text-slate-900">{order.address || 'No property stored'}</div>
                          <div className="mt-1 text-xs text-slate-500">{[order.city, order.state, order.zip].filter(Boolean).join(', ') || 'No city/state/zip stored'}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{order.orderedByEmail || 'Unknown'}</td>
                        <td className="px-4 py-4 text-slate-700">
                          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${order.completedSuccessfully === true ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : order.completedSuccessfully === false ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            {order.completedSuccessfully === true ? (order.cacheHit ? 'Cache hit' : 'Success') : order.completedSuccessfully === false ? 'Failed' : 'Unknown'}
                          </div>
                          {order.failureMessage ? <div className="mt-2 text-xs text-rose-700">{order.failureMessage}</div> : null}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div>Value: <span className="text-slate-900">{currency(order.value)}</span></div>
                          <div className="mt-1">FSD: <span className="text-slate-900">{order.fsd !== null ? order.fsd.toFixed(2) : '—'}</span></div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{order.requestedMaxFsd !== null ? order.requestedMaxFsd.toFixed(2) : '—'}</td>
                        <td className="px-4 py-4 text-slate-700">{formatDateTime(order.createdAt)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No PDF orders matched this search yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-base font-semibold text-slate-900">PCI orders</h3>
            <p className="mt-1 text-sm text-slate-600">Webhook-backed Property Valuation orders with current status, notes, ETA, and report retrieval.</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Latest event</th>
                      <th className="px-4 py-3">Date ordered</th>
                      <th className="px-4 py-3">ETA / inspection</th>
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
                          {order.productCode ? <div className="mt-1 text-xs text-slate-500">{order.productCode}</div> : null}
                        </td>
                        <td className="px-4 py-4">
                          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClasses(order.status)}`}>
                            {statusLabel(order.status)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div className="font-medium text-slate-900">{eventLabel(order.lastEventType)}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDateTime(order.lastEventAt || order.updatedAt)}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div className="text-slate-900">{formatDateTime(order.createdAt)}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div>ETA: <span className="text-slate-900">{formatDateTime(order.estimatedCompletionDate)}</span></div>
                          <div className="mt-1">Inspection: <span className="text-slate-900">{formatDateTime(order.inspectionDate)}</span></div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => handleDownloadReport(order.orderId)}
                              disabled={reportLoadingOrderId === order.orderId || order.status !== 'completed'}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {reportLoadingOrderId === order.orderId ? 'Loading…' : 'Download report'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(order.orderId)}
                              disabled={cancelLoadingOrderId === order.orderId || ['completed', 'canceled', 'declined', 'cancel_requested'].includes(order.status || '')}
                              className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {cancelLoadingOrderId === order.orderId ? 'Canceling…' : 'Cancel order'}
                            </button>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">Download fetches a fresh report URL. Cancel submits a Clear Capital cancellation request.</div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {order.holdReason ? <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{order.holdReason}</div> : null}
                          {order.lastMessage ? <div className={`rounded-xl px-3 py-2 text-xs ${order.lastMessageUrgent ? 'border border-rose-200 bg-rose-50 text-rose-900' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>{order.lastMessage}</div> : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No PCI orders matched this search yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
