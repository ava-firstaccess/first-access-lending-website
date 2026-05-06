import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, getPortalHomePath, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const portalRole = resolvePortalRoleFromHost(host);

  if (!portalRole) {
    redirect('/pricer');
  }

  const nextPath = getPortalHomePath(portalRole);
  const title = portalRole === 'loan_processor' ? 'Loan Processor Portal' : 'Loan Officer Portal';
  const subtitle = portalRole === 'loan_processor'
    ? 'Login with your email prefix, then verify the code sent to your work email to access pricing, AVM tools, and processor workflows.'
    : 'Login with your email prefix, then verify the code sent to your work email.';

  const session = await getLoanOfficerPortalSession();
  if (session) {
    redirect(nextPath);
  }

  if (await hasTrustedLoanOfficerBrowser()) {
    redirect(`/api/lo-auth/bootstrap-session?next=${encodeURIComponent(nextPath)}`);
  }

  return <LoanOfficerPortalGate nextPath={nextPath} title={title} subtitle={subtitle} />;
}
