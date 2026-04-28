'use client';

import { useEffect, useMemo, useState } from 'react';
import { SSNField } from '@/components/quote/FormField';
import {
  getRepresentativeMeridianLinkScore,
  isMortgageLiability,
  parseMeridianLinkResponseXml,
  type MeridianLinkParsedReport,
} from '@/lib/meridianlink-report';

interface CreditApiMetadata {
  approvedProdTestBorrower?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    suffixName?: string;
    dob?: string;
    ssnLast4?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    preferredResponseFormat?: string;
    fileNumber?: string;
  };
}

interface LookupForm {
  fileNumber: string;
  firstName: string;
  lastName: string;
  middleName: string;
  suffixName: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export default function CreditFileLookupPage() {
  const [form, setForm] = useState<LookupForm>({
    fileNumber: '',
    firstName: '',
    lastName: '',
    middleName: '',
    suffixName: '',
    ssn: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseXml, setResponseXml] = useState('');
  const [report, setReport] = useState<MeridianLinkParsedReport | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [vendorOrderId, setVendorOrderId] = useState<string | null>(null);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const res = await fetch('/api/credit/softpull');
        if (!res.ok) return;
        const payload: CreditApiMetadata = await res.json();
        const approved = payload.approvedProdTestBorrower;
        if (!approved) return;
        setForm((prev) => ({
          ...prev,
          fileNumber: approved.fileNumber || prev.fileNumber,
          firstName: approved.firstName || prev.firstName,
          lastName: approved.lastName || prev.lastName,
          middleName: approved.middleName || prev.middleName,
          suffixName: approved.suffixName || prev.suffixName,
          address: approved.address || prev.address,
          city: approved.city || prev.city,
          state: approved.state || prev.state,
          zip: approved.zip || prev.zip,
        }));
      } catch {
        // ignore
      }
    };

    void loadDefaults();
  }, []);

  const summary = useMemo(() => {
    if (!report) return null;
    const scores = report.scores.length;
    const liabilities = report.liabilities.length;
    const mortgages = report.liabilities.filter(isMortgageLiability).length;
    return {
      representativeScore: getRepresentativeMeridianLinkScore(report.scores),
      scores,
      liabilities,
      mortgages,
    };
  }, [report]);

  const ready = Boolean(
    form.fileNumber && form.firstName && form.lastName && form.ssn && form.address && form.city && form.state && form.zip
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">MeridianLink File Lookup</h1>
          <p className="mt-2 text-gray-600">Retrieve a previously created MeridianLink file by file number. Exact borrower details still matter.</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-md">
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
            Use this as a separate testing portal. For future LO use, they can enter a MeridianLink file number plus the matching borrower details and pull the XML directly.
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">File Number</label>
              <input value={form.fileNumber} onChange={(e) => setForm((p) => ({ ...p, fileNumber: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">First Name</label>
              <input value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Middle Name</label>
              <input value={form.middleName} onChange={(e) => setForm((p) => ({ ...p, middleName: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Last Name</label>
              <input value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Suffix</label>
              <input value={form.suffixName} onChange={(e) => setForm((p) => ({ ...p, suffixName: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <SSNField label="Social Security Number" name="lookup-ssn" value={form.ssn} onChange={(_, v) => setForm((p) => ({ ...p, ssn: v }))} required />
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700">Street Address</label>
              <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">City</label>
              <input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">State</label>
              <input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))} maxLength={2} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">ZIP Code</label>
              <input value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 focus:border-blue-600 focus:outline-none" />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={!ready || loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                setResponseXml('');
                setReport(null);
                setStatus(null);
                setVendorOrderId(null);
                try {
                  const res = await fetch('/api/credit/softpull', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      mode: 'production-retrieve',
                      fileNumber: form.fileNumber,
                      borrower: {
                        ...form,
                        preferredResponseFormat: 'Xml',
                      },
                    }),
                  });
                  const payload = await res.json();
                  if (!res.ok || !payload?.responseXml) {
                    throw new Error(payload?.error || 'MeridianLink retrieve failed.');
                  }
                  setStatus(payload.status || null);
                  setVendorOrderId(payload.vendorOrderIdentifier || null);
                  setResponseXml(String(payload.responseXml || ''));
                  setReport(parseMeridianLinkResponseXml(String(payload.responseXml || '')));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Lookup failed.');
                } finally {
                  setLoading(false);
                }
              }}
              className={`rounded-xl px-5 py-3 text-sm font-semibold text-white ${ready && !loading ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
            >
              {loading ? 'Retrieving...' : 'Retrieve File XML'}
            </button>
          </div>

          {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          {summary ? (
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="text-xs text-gray-500">Representative Score</div><div className="mt-1 text-2xl font-bold text-gray-900">{summary.representativeScore ?? '—'}</div></div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="text-xs text-gray-500">Scores</div><div className="mt-1 text-2xl font-bold text-gray-900">{summary.scores}</div></div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="text-xs text-gray-500">Liabilities</div><div className="mt-1 text-2xl font-bold text-gray-900">{summary.liabilities}</div></div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="text-xs text-gray-500">Mortgages</div><div className="mt-1 text-2xl font-bold text-gray-900">{summary.mortgages}</div></div>
            </div>
          ) : null}

          {responseXml ? (
            <div className="mt-8">
              <div className="mb-2 text-sm font-medium text-gray-700">Retrieved XML {status ? `(${status})` : ''} {vendorOrderId ? `· ${vendorOrderId}` : ''}</div>
              <pre className="max-h-[500px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{responseXml}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
