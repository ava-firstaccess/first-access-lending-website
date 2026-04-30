'use client';

import { useEffect, useState } from 'react';

type LoanOfficerPortalSession = {
  prefix: string;
  email: string;
  name?: string;
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
  rate?: number;
  noteRate?: number;
  monthlyPayment?: number;
  propertyState?: string;
  occupancy?: string;
  structureType?: string;
  creditScore?: number;
  verificationProvider?: string;
  verificationFsd?: number;
};

const STORAGE_KEY = 'fal-lo-avm-scenario';

export function LoanOfficerAvmPage({ session }: { session: LoanOfficerPortalSession }) {
  const [scenario, setScenario] = useState<StoredScenario | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipcode, setZipcode] = useState('');

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setScenario(JSON.parse(raw));
    } catch {
      setScenario(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Loan Officer Portal</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">AVM workspace</h1>
              <p className="mt-2 text-sm text-slate-600">Signed in as {session.email}. This page inherits pricing context from the LO pricer so AVM work can stay investor-aware.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Scenario from /pricer</h2>
            {scenario ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Metric label="Investor" value={scenario.investor} />
                <Metric label="Engine" value={scenario.engine} />
                <Metric label="Program" value={scenario.program} />
                <Metric label="Product" value={scenario.product} />
                <Metric label="Target loan amount" value={currency(scenario.desiredLoanAmount)} />
                <Metric label="Max available" value={currency(scenario.maxAvailable)} />
                <Metric label="Combined CLTV" value={`${scenario.combinedLtv.toFixed(2)}%`} />
                <Metric label="Rate" value={scenario.rate ? `${scenario.rate.toFixed(3)}%` : 'N/A'} />
                <Metric label="Property state" value={scenario.propertyState || 'N/A'} />
                <Metric label="Borrower email" value={scenario.officerEmail} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                No pricing scenario has been handed off yet. Open <span className="font-semibold">/pricer</span>, price a scenario, then click <span className="font-semibold">Pull AVM</span> on the investor you want.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Property details for AVM pull</h2>
            <p className="mt-2 text-sm text-slate-600">Pricing does not currently collect an address, so the AVM step starts here. This is where we’ll wire the valuation providers and PDF output.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Street address" value={address} onChange={setAddress} className="sm:col-span-2" />
              <Field label="City" value={city} onChange={setCity} />
              <Field label="State" value={state} onChange={setState} />
              <Field label="Zip code" value={zipcode} onChange={setZipcode} />
            </div>
            <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
              <div className="font-semibold">Next wiring already framed</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sky-900">
                <li>Use the inherited investor, CLTV, and target-loan context as AVM decision inputs.</li>
                <li>Call HouseCanary and/or Clear Capital from this page.</li>
                <li>Generate LO-facing AVM and pricing PDFs using the logged-in officer email.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`text-sm ${className}`}>
      <div className="mb-1 font-medium text-slate-700">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2" />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-base font-semibold text-slate-900">{value}</div></div>;
}

function currency(value: number) {
  return `$${Math.round(Number(value || 0)).toLocaleString()}`;
}
