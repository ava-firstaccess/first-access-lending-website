import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Stage1PricingPage } from '@/components/Stage1PricingPage';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, hasTrustedLoanOfficerBrowser, isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();

  if (isLoanOfficerPortalHost(host)) {
    const session = await getLoanOfficerPortalSession();
    if (!session) {
      if (await hasTrustedLoanOfficerBrowser()) {
        redirect('/api/lo-auth/bootstrap-session?next=%2Fpricer');
      }
      return <LoanOfficerPortalGate nextPath="/pricer" title="Loan Officer Pricer" subtitle="Login with your email prefix, then verify the code sent to your work email to access pricing." />;
    }
    return <Stage1PricingPage mode="pricer" portalSession={session} />;
  }

  notFound();
}
