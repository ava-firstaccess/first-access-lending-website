import { headers } from 'next/headers';
import { LoanOfficerAvmPage } from '@/components/LoanOfficerAvmPage';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const isPortalHost = isLoanOfficerPortalHost(host);

  if (!isPortalHost) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">AVM workspace</h1>
          <p className="mt-3 text-sm text-slate-600">This route is reserved for the Loan Officer portal on lo.firstaccesslending.com.</p>
        </div>
      </div>
    );
  }

  const session = await getLoanOfficerPortalSession();
  if (!session) {
    return <LoanOfficerPortalGate nextPath="/avm" title="Loan Officer AVM" subtitle="Login with your email prefix and verify the code sent to your work email to access AVM tools." />;
  }

  return <LoanOfficerAvmPage session={session} />;
}
