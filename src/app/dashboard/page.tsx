import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { canAccessPortalRole, canAccessProcessorWorkspace, getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type SeedOrderRow = {
  external_order_id: string | null;
  loan_officer_email: string | null;
  investor: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  ordered_at: string | null;
  response_payload: unknown;
};

type ClearCapitalLiveRow = {
  orderId: string;
  orderedAt: string | null;
  loanOfficerEmail: string | null;
  investor: string | null;
  address: string;
  liveStatus: 'completed' | 'threshold_failed' | 'error' | 'unknown';
  value: number | null;
  fsd: number | null;
  lowValue: number | null;
  highValue: number | null;
  effectiveDate: string | null;
  runDate: string | null;
  confidenceScore: number | string | null;
  errorMessage: string | null;
};

type ClearCapitalReportingData = {
  rows: ClearCapitalLiveRow[];
  summary: {
    recentCount: number;
    completedCount: number;
    thresholdFailureCount: number;
    errorCount: number;
  };
  error: string | null;
};

function getClearCapitalConfig() {
  const apiKey = process.env.CLEARCAPITAL_PAA_API_KEY;
  const baseUrl = process.env.CLEARCAPITAL_PAA_BASE_URL || 'https://api.clearcapital.com/property-analytics-api';
  if (!apiKey) throw new Error('Clear Capital Property Analytics credentials are not configured.');
  return { apiKey, baseUrl };
}

async function fetchClearCapitalOrder(orderId: string) {
  const { apiKey, baseUrl } = getClearCapitalConfig();
  const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    headers: {
      accept: 'application/json',
      'x-api-key': apiKey,
    },
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      errorMessage: `Clear Capital GET /orders/${orderId} failed (${response.status}).`,
      raw: data,
    };
  }

  return {
    ok: true,
    raw: data,
  };
}

function currency(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatAddress(address: string | null, city: string | null, state: string | null, zipcode: string | null) {
  return [address, [city, state].filter(Boolean).join(', '), zipcode].filter(Boolean).join(' ');
}

function statusTone(status: ClearCapitalLiveRow['liveStatus']) {
  if (status === 'completed') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  if (status === 'threshold_failed') return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  if (status === 'error') return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  return 'border-slate-400/30 bg-slate-500/10 text-slate-100';
}

function statusLabel(status: ClearCapitalLiveRow['liveStatus']) {
  if (status === 'completed') return 'Completed';
  if (status === 'threshold_failed') return 'Threshold fail';
  if (status === 'error') return 'Error';
  return 'Unknown';
}

function normalizeLiveRow(seed: SeedOrderRow, live: Record<string, unknown>): ClearCapitalLiveRow {
  const payload = live as {
    clearAvm?: {
      result?: {
        marketValue?: number;
        forecastStdDev?: number;
        lowValue?: number;
        highValue?: number;
        runDate?: string;
        confidenceScore?: number | string;
      };
    };
    errorMessage?: string;
    effectiveDate?: string;
  };
  const result = payload.clearAvm?.result;
  const errorMessage = typeof payload.errorMessage === 'string' ? payload.errorMessage : null;
  const marketValue = typeof result?.marketValue === 'number' ? Math.round(result.marketValue) : null;
  const forecastStdDev = typeof result?.forecastStdDev === 'number' ? result.forecastStdDev : null;
  const lowValue = typeof result?.lowValue === 'number' ? Math.round(result.lowValue) : null;
  const highValue = typeof result?.highValue === 'number' ? Math.round(result.highValue) : null;
  const liveStatus: ClearCapitalLiveRow['liveStatus'] = marketValue !== null
    ? 'completed'
    : errorMessage && errorMessage.toLowerCase().includes('supplied thresholds')
      ? 'threshold_failed'
      : errorMessage
        ? 'error'
        : 'unknown';

  return {
    orderId: String(seed.external_order_id),
    orderedAt: seed.ordered_at,
    loanOfficerEmail: seed.loan_officer_email,
    investor: seed.investor,
    address: formatAddress(seed.address, seed.city, seed.state, seed.zipcode) || 'Unknown property',
    liveStatus,
    value: marketValue,
    fsd: forecastStdDev,
    lowValue,
    highValue,
    effectiveDate: typeof payload.effectiveDate === 'string' ? payload.effectiveDate : null,
    runDate: typeof result?.runDate === 'string' ? result.runDate : null,
    confidenceScore: result?.confidenceScore ?? null,
    errorMessage,
  };
}

async function loadClearCapitalReportingData(): Promise<ClearCapitalReportingData> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('loan_officer_avm_order_log')
      .select('external_order_id, loan_officer_email, investor, address, city, state, zipcode, ordered_at, response_payload')
      .eq('provider', 'clearcapital')
      .not('external_order_id', 'is', null)
      .order('ordered_at', { ascending: false })
      .limit(25);

    if (error) throw new Error(`Failed to load seeded Clear Capital orders: ${error.message}`);

    const seen = new Set<string>();
    const seeds = ((data || []) as SeedOrderRow[])
      .filter((row) => row.external_order_id && !seen.has(String(row.external_order_id)) && seen.add(String(row.external_order_id)))
      .slice(0, 8);

    const rows = await Promise.all(seeds.map(async (seed) => {
      const orderId = String(seed.external_order_id);
      const live = await fetchClearCapitalOrder(orderId);
      if (!live.ok) {
        return {
          orderId,
          orderedAt: seed.ordered_at,
          loanOfficerEmail: seed.loan_officer_email,
          investor: seed.investor,
          address: formatAddress(seed.address, seed.city, seed.state, seed.zipcode) || 'Unknown property',
          liveStatus: 'error' as const,
          value: null,
          fsd: null,
          lowValue: null,
          highValue: null,
          effectiveDate: null,
          runDate: null,
          confidenceScore: null,
          errorMessage: live.errorMessage ?? null,
        };
      }
      return normalizeLiveRow(seed, live.raw);
    }));

    return {
      rows,
      summary: {
        recentCount: rows.length,
        completedCount: rows.filter((row) => row.liveStatus === 'completed').length,
        thresholdFailureCount: rows.filter((row) => row.liveStatus === 'threshold_failed').length,
        errorCount: rows.filter((row) => row.liveStatus === 'error').length,
      },
      error: null,
    };
  } catch (error) {
    console.error('Failed to load live Clear Capital reporting data:', error);
    return {
      rows: [],
      summary: {
        recentCount: 0,
        completedCount: 0,
        thresholdFailureCount: 0,
        errorCount: 0,
      },
      error: error instanceof Error ? error.message : 'Failed to load live Clear Capital reporting.',
    };
  }
}

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const portalRole = resolvePortalRoleFromHost(host);

  if (!portalRole) {
    redirect('/pricer');
  }

  const session = await getLoanOfficerPortalSession();
  if (!session) {
    if (await hasTrustedLoanOfficerBrowser()) {
      redirect('/api/lo-auth/bootstrap-session?next=%2Fdashboard');
    }
    const title = portalRole === 'loan_processor' ? 'Loan Processor Portal' : 'Loan Officer Portal';
    return <LoanOfficerPortalGate nextPath="/dashboard" title={title} subtitle="Login with your email prefix, then verify the code sent to your work email to access your internal dashboard." />;
  }

  if (!canAccessPortalRole(session.position, portalRole)) {
    redirect('/api/lo-auth/bootstrap-session?next=%2Fdashboard');
  }

  const isLoanProcessor = canAccessProcessorWorkspace(session.position);
  const clearCapitalReporting = await loadClearCapitalReportingData();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">First Access Lending</div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Portal dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Welcome back{session.name ? `, ${session.name}` : ''}.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              <div className="font-semibold text-white">{session.email}</div>
              <div className="mt-1">Position: {session.position}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="group rounded-[28px] border border-sky-400/20 bg-white/5 p-7 shadow-xl shadow-slate-950/30 backdrop-blur transition hover:-translate-y-0.5 hover:border-sky-300/40 hover:bg-white/10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">Core workflow</div>
                <h2 className="mt-3 text-2xl font-bold text-white">Pricer &amp; AVMs</h2>
              </div>
              <div className="rounded-2xl bg-sky-400/15 px-3 py-1 text-xs font-semibold text-sky-200">Available</div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">Open the pricing workspace and run scenarios. AVMs continue from the pricer flow after BestX is run.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Pricing</span>
              <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Scenario handoff</span>
              <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">AVM access</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/pricer" className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950">Open pricer</Link>
            </div>
          </div>

          {isLoanProcessor ? (
            <Link href="/processor" className="group rounded-[28px] border border-amber-400/20 bg-white/5 p-7 shadow-xl shadow-slate-950/30 backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Processor-only</div>
                  <h2 className="mt-3 text-2xl font-bold text-white">AVM Tools</h2>
                </div>
                <div className="rounded-2xl bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">Enabled</div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">Open the additional processor workspace. This card appears only when the signed-in user’s Supabase <span className="font-semibold text-white">position</span> includes processor access.</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Processor queue</span>
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">AVM tooling</span>
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Restricted access</span>
              </div>
            </Link>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-emerald-400/20 bg-white/5 p-7 shadow-xl shadow-slate-950/30 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Dashboard reporting</div>
              <h2 className="mt-3 text-2xl font-bold text-white">Clear Capital AVM reporting</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Vendor-native one-time refresh. This card uses recent known Clear Capital order IDs from our system as seeds, then fetches current order details live from Clear Capital with <span className="font-semibold text-white">GET /orders/{'{orderId}'}</span>.</p>
            </div>
            <Link href="/dashboard" className="inline-flex rounded-xl border border-white/15 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900/60">Refresh</Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Recent live pulls</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalReporting.summary.recentCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Completed</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalReporting.summary.completedCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Threshold fails</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalReporting.summary.thresholdFailureCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Errors</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalReporting.summary.errorCount}</div>
            </div>
          </div>

          {clearCapitalReporting.error ? (
            <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{clearCapitalReporting.error}</div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Officer</th>
                    <th className="px-4 py-3">Live status</th>
                    <th className="px-4 py-3">Value / FSD</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {clearCapitalReporting.rows.length > 0 ? clearCapitalReporting.rows.map((row) => (
                    <tr key={row.orderId}>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-white">{formatDateTime(row.orderedAt)}</div>
                        <div className="mt-1 text-xs text-slate-400">Order {row.orderId}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-white">{row.address}</div>
                        <div className="mt-1 text-xs text-slate-400">{row.investor || 'No investor tagged'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div>{row.loanOfficerEmail || '—'}</div>
                        <div className="mt-1 text-xs text-slate-400">Run date {formatDateTime(row.runDate)}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(row.liveStatus)}`}>{statusLabel(row.liveStatus)}</div>
                        <div className="mt-2 text-xs text-slate-400">Effective {formatDateTime(row.effectiveDate)}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-white">{currency(row.value)}</div>
                        <div className="mt-1 text-xs text-slate-400">FSD {row.fsd !== null ? row.fsd.toFixed(2) : '—'}</div>
                        <div className="mt-1 text-xs text-slate-400">Range {currency(row.lowValue)} to {currency(row.highValue)}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-300">
                        {row.errorMessage ? (
                          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-rose-100">{row.errorMessage}</div>
                        ) : (
                          <div className="space-y-1">
                            <div>Confidence {row.confidenceScore ?? '—'}</div>
                            <div>Live vendor refresh from Clear Capital.</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No known Clear Capital AVM orders are available to refresh yet.</td>
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
