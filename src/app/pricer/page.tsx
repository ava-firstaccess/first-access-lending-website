import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Stage1PricingPage } from '@/components/Stage1PricingPage';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, resolvePortalRoleFromHost } from '@/lib/lo-portal-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const portalRole = resolvePortalRoleFromHost(host);

  if (portalRole) {
    const session = await getLoanOfficerPortalSession();
    if (!session) {
      if (await hasTrustedLoanOfficerBrowser()) {
        redirect('/api/lo-auth/bootstrap-session?next=%2Fpricer');
      }
      const title = portalRole === 'loan_processor' ? 'Loan Processor Pricer' : 'Loan Officer Pricer';
      const subtitle = portalRole === 'loan_processor'
        ? 'Login with your email prefix, then verify the code sent to your work email to access pricing.'
        : 'Login with your email prefix, then verify the code sent to your work email to access pricing.';
      return <LoanOfficerPortalGate nextPath="/pricer" title={title} subtitle={subtitle} />;
    }
    if (session.position !== portalRole) {
      redirect('/api/lo-auth/bootstrap-session?next=%2Fpricer');
    }
    return <Stage1PricingPage mode="pricer" portalSession={session} />;
  }

  notFound();
}
