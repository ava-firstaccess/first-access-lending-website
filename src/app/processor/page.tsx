import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { ProcessorAvmToolsPage } from '@/components/ProcessorAvmToolsPage';
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
    return <LoanOfficerPortalGate nextPath="/processor" title="Loan Processor Portal" subtitle="Login with your email prefix, then verify the code sent to your work email to access AVM tools." />;
  }

  if (session.position !== portalRole) {
    redirect('/api/lo-auth/bootstrap-session?next=%2Fprocessor');
  }

  if (session.position !== 'loan_processor') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Processor access required</h1>
          <p className="mt-3 text-sm text-slate-600">This AVM tools workspace is only enabled for users whose <span className="font-semibold">position</span> is <span className="font-semibold">loan_processor</span>.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/pricer" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">Open pricer</Link>
          </div>
        </div>
      </div>
    );
  }

  return <ProcessorAvmToolsPage session={{ email: session.email, name: session.name }} />;
}
