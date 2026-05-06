import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';

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

  if (session.position !== portalRole) {
    redirect('/api/lo-auth/bootstrap-session?next=%2Fdashboard');
  }

  const isLoanProcessor = session.position === 'loan_processor';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-300">First Access Lending</div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Portal dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Welcome back{session.name ? `, ${session.name}` : ''}. Start from the tools you use most, with the processor-only AVM workspace shown only when your Supabase <span className="font-semibold text-white">position</span> is <span className="font-semibold text-white">loan_processor</span>.</p>
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
            <p className="mt-4 text-sm leading-6 text-slate-300">Open the pricing workspace, run scenarios, and jump into the AVM flow. This is the shared workspace for both loan officers and loan processors.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Pricing</span>
              <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Scenario handoff</span>
              <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">AVM access</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/pricer" className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950">Open pricer</Link>
              <Link href="/avm" className="rounded-xl border border-white/15 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-100">Open AVM</Link>
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
              <p className="mt-4 text-sm leading-6 text-slate-300">Open the additional processor workspace. This card appears only when the signed-in user’s Supabase <span className="font-semibold text-white">position</span> is <span className="font-semibold text-white">loan_processor</span>.</p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Processor queue</span>
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">AVM tooling</span>
                <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-slate-200">Restricted access</span>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
