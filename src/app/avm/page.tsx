import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerAvmPage } from '@/components/LoanOfficerAvmPage';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const portalRole = resolvePortalRoleFromHost(host);

  if (!portalRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">AVM workspace</h1>
          <p className="mt-3 text-sm text-slate-600">This route is reserved for the internal portal on lo.firstaccesslending.com or lp.firstaccesslending.com.</p>
        </div>
      </div>
    );
  }

  const session = await getLoanOfficerPortalSession();
  if (!session) {
    if (await hasTrustedLoanOfficerBrowser()) {
      redirect('/api/lo-auth/bootstrap-session?next=%2Favm');
    }
    const title = portalRole === 'loan_processor' ? 'Loan Processor AVM' : 'Loan Officer AVM';
    return <LoanOfficerPortalGate nextPath="/avm" title={title} subtitle="Login with your email prefix and verify the code sent to your work email to access AVM tools." />;
  }

  return <LoanOfficerAvmPage session={session} />;
}
