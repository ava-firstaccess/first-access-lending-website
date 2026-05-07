import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { canAccessPortalRole, canAccessProcessorWorkspace, getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type ClearCapitalProviderRow = {
  run_id: string;
  order_status: string | null;
  source: string | null;
  requested_max_fsd: number | null;
  value: number | null;
  fsd: number | null;
  is_winner: boolean;
  failure_message: string | null;
  created_at: string;
  targeted_investor: string | null;
  has_report_link: boolean;
};

type ClearCapitalRunRow = {
  run_id: string;
  loan_officer_email: string;
  investor: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  run_source: string;
  manual_provider_requested: string | null;
  cache_hit: boolean;
  completed_successfully: boolean | null;
  winner_provider: string | null;
  winner_source: string | null;
  created_at: string;
};

type ClearCapitalDashboardEntry = {
  runId: string;
  createdAt: string;
  loanOfficerEmail: string;
  address: string;
  investor: string | null;
  runSource: string;
  orderStatus: string | null;
  source: string | null;
  requestedMaxFsd: number | null;
  value: number | null;
  fsd: number | null;
  cacheHit: boolean;
  completedSuccessfully: boolean | null;
  isWinner: boolean;
  failureMessage: string | null;
  hasReportLink: boolean;
};

type ClearCapitalDashboardData = {
  entries: ClearCapitalDashboardEntry[];
  summary: {
    recentCount: number;
    winnerCount: number;
    freshCount: number;
    cacheCount: number;
    failureCount: number;
  };
  error: string | null;
};

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

function statusTone(entry: ClearCapitalDashboardEntry) {
  if (entry.failureMessage || entry.completedSuccessfully === false) return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
  if (entry.source === 'cache' || entry.cacheHit) return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
  if (entry.orderStatus === 'completed' || entry.isWinner) return 'border-sky-400/30 bg-sky-500/10 text-sky-100';
  return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
}

function statusLabel(entry: ClearCapitalDashboardEntry) {
  if (entry.failureMessage || entry.completedSuccessfully === false) return 'Failed';
  if (entry.source === 'cache' || entry.cacheHit) return 'Cache';
  if (entry.orderStatus === 'completed') return 'Completed';
  if (entry.orderStatus === 'processing') return 'Processing';
  if (entry.orderStatus === 'submitted') return 'Submitted';
  if (entry.isWinner) return 'Winner';
  return 'Active';
}

async function loadClearCapitalDashboardData(): Promise<ClearCapitalDashboardData> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: providerRows, error: providerError } = await supabase
      .from('loan_officer_avm_analytics_providers')
      .select('run_id, order_status, source, requested_max_fsd, value, fsd, is_winner, failure_message, created_at, targeted_investor, has_report_link')
      .eq('provider', 'Clear Capital')
      .order('created_at', { ascending: false })
      .limit(25);

    if (providerError) throw new Error(`Failed to load Clear Capital AVM rows: ${providerError.message}`);

    const typedProviderRows = (providerRows || []) as ClearCapitalProviderRow[];
    const runIds = Array.from(new Set(typedProviderRows.map((row) => row.run_id).filter(Boolean)));

    if (runIds.length === 0) {
      return {
        entries: [],
        summary: { recentCount: 0, winnerCount: 0, freshCount: 0, cacheCount: 0, failureCount: 0 },
        error: null,
      };
    }

    const { data: runRows, error: runError } = await supabase
      .from('loan_officer_avm_analytics_runs')
      .select('run_id, loan_officer_email, investor, address, city, state, zipcode, run_source, manual_provider_requested, cache_hit, completed_successfully, winner_provider, winner_source, created_at')
      .in('run_id', runIds);

    if (runError) throw new Error(`Failed to load Clear Capital AVM runs: ${runError.message}`);

    const runMap = new Map<string, ClearCapitalRunRow>((runRows || []).map((row) => [row.run_id, row as ClearCapitalRunRow]));
    const entries = typedProviderRows
      .map((providerRow) => {
        const runRow = runMap.get(providerRow.run_id);
        if (!runRow) return null;
        return {
          runId: providerRow.run_id,
          createdAt: providerRow.created_at || runRow.created_at,
          loanOfficerEmail: runRow.loan_officer_email,
          address: formatAddress(runRow.address, runRow.city, runRow.state, runRow.zipcode) || 'Unknown property',
          investor: providerRow.targeted_investor || runRow.investor,
          runSource: runRow.run_source,
          orderStatus: providerRow.order_status,
          source: providerRow.source,
          requestedMaxFsd: providerRow.requested_max_fsd,
          value: providerRow.value,
          fsd: providerRow.fsd,
          cacheHit: runRow.cache_hit,
          completedSuccessfully: runRow.completed_successfully,
          isWinner: providerRow.is_winner || runRow.winner_provider === 'Clear Capital',
          failureMessage: providerRow.failure_message,
          hasReportLink: providerRow.has_report_link,
        } satisfies ClearCapitalDashboardEntry;
      })
      .filter((entry): entry is ClearCapitalDashboardEntry => Boolean(entry));

    return {
      entries: entries.slice(0, 8),
      summary: {
        recentCount: entries.length,
        winnerCount: entries.filter((entry) => entry.isWinner).length,
        freshCount: entries.filter((entry) => entry.source === 'fresh').length,
        cacheCount: entries.filter((entry) => entry.source === 'cache' || entry.cacheHit).length,
        failureCount: entries.filter((entry) => entry.failureMessage || entry.completedSuccessfully === false).length,
      },
      error: null,
    };
  } catch (error) {
    console.error('Failed to load dashboard Clear Capital AVM data:', error);
    return {
      entries: [],
      summary: { recentCount: 0, winnerCount: 0, freshCount: 0, cacheCount: 0, failureCount: 0 },
      error: error instanceof Error ? error.message : 'Failed to load Clear Capital AVM data.',
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
  const clearCapitalDashboard = await loadClearCapitalDashboardData();

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
              <h2 className="mt-3 text-2xl font-bold text-white">Clear Capital AVMs</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Recent loan-officer Clear Capital AVM activity from the main AVM workflow. This is separate from the processor PDF and PCI tools.</p>
            </div>
            <Link href="/dashboard" className="inline-flex rounded-xl border border-white/15 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900/60">Refresh</Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Recent rows</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalDashboard.summary.recentCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Winners</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalDashboard.summary.winnerCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Fresh orders</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalDashboard.summary.freshCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Failures</div>
              <div className="mt-2 text-2xl font-bold text-white">{clearCapitalDashboard.summary.failureCount}</div>
            </div>
          </div>

          {clearCapitalDashboard.error ? (
            <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{clearCapitalDashboard.error}</div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Officer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Value / FSD</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-slate-200">
                  {clearCapitalDashboard.entries.length > 0 ? clearCapitalDashboard.entries.map((entry) => (
                    <tr key={entry.runId}>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-white">{formatDateTime(entry.createdAt)}</div>
                        <div className="mt-1 text-xs text-slate-400">{entry.runSource === 'manual' ? 'Manual run' : 'Cascade run'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-white">{entry.address}</div>
                        <div className="mt-1 text-xs text-slate-400">{entry.investor || 'No investor tagged'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div>{entry.loanOfficerEmail}</div>
                        <div className="mt-1 text-xs text-slate-400">Max FSD {entry.requestedMaxFsd !== null ? entry.requestedMaxFsd.toFixed(2) : '—'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(entry)}`}>{statusLabel(entry)}</div>
                        <div className="mt-2 text-xs text-slate-400">{entry.source === 'cache' || entry.cacheHit ? 'Cache response' : entry.orderStatus || 'No order status'}</div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium text-white">{currency(entry.value)}</div>
                        <div className="mt-1 text-xs text-slate-400">FSD {entry.fsd !== null ? entry.fsd.toFixed(2) : '—'}</div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-slate-300">
                        {entry.failureMessage ? (
                          <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-rose-100">{entry.failureMessage}</div>
                        ) : (
                          <div className="space-y-1">
                            <div>{entry.isWinner ? 'Won the run response.' : 'Tracked provider row.'}</div>
                            <div>{entry.hasReportLink ? 'Report link present.' : 'No report link stored.'}</div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">No Clear Capital AVM activity is showing yet.</td>
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
