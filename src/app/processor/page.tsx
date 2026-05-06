import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const portalRole = resolvePortalRoleFromHost(host);

  if (portalRole !== 'loan_processor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Loan Processor workspace</h1>
          <p className="mt-3 text-sm text-slate-600">This route is reserved for loan processor accounts on lp.firstaccesslending.com.</p>
        </div>
      </div>
    );
  }

  const session = await getLoanOfficerPortalSession();
  if (!session) {
    if (await hasTrustedLoanOfficerBrowser()) {
      redirect('/api/lo-auth/bootstrap-session?next=%2Fprocessor');
    }
    return <LoanOfficerPortalGate nextPath="/processor" title="Loan Processor Portal" subtitle="Login with your email prefix, then verify the code sent to your work email to access processor tools." />;
  }

  if (session.role !== 'loan_processor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Processor access required</h1>
          <p className="mt-3 text-sm text-slate-600">This extra workspace is only enabled for users with the <span className="font-semibold">loan_processor</span> role.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/pricer" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">Open pricer</Link>
            <Link href="/avm" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Open AVM</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Loan Processor Portal</div>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Processor workspace</h1>
              <p className="mt-2 text-sm text-slate-600">Signed in as {session.email}. This is the extra loan processor screen layered on top of the same pricer and AVM access your LO users already have.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/pricer" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">Open pricer</Link>
              <Link href="/avm" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Open AVM</Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">What is live now</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>• Shared OTP auth and remembered-browser flow using the same portal user table as loan officers</li>
              <li>• Processor-only route on <span className="font-semibold">lp.firstaccesslending.com/processor</span></li>
              <li>• Same pricer and AVM access already available to the LO portal</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-950">Next screen details needed</h2>
            <p className="mt-4 text-sm text-amber-900">I left this page as the safe processor-only shell. Once you tell me what the extra screen should actually do, I can wire the real workflow into this route instead of the placeholder overview.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
