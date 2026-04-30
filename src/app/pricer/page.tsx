import { headers } from 'next/headers';
import { Stage1PricingPage } from '@/components/Stage1PricingPage';
import { PricerPasswordGate } from '@/components/PricerPasswordGate';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';
import { hasPricerAccess, isPricerConfigured } from '@/lib/pricer-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();

  if (isLoanOfficerPortalHost(host)) {
    const session = await getLoanOfficerPortalSession();
    if (!session) {
      return <LoanOfficerPortalGate nextPath="/pricer" title="Loan Officer Pricer" subtitle="Login with your email prefix, then verify with the code sent to your phone to access pricing." />;
    }
    return <Stage1PricingPage mode="pricer" portalSession={session} />;
  }

  if (!isPricerConfigured() || !(await hasPricerAccess())) {
    return <PricerPasswordGate />;
  }
  return <Stage1PricingPage mode="pricer" />;
}
