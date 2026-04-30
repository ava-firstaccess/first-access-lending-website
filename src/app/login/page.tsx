import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LoanOfficerPortalGate } from '@/components/LoanOfficerPortalGate';
import { getLoanOfficerPortalSession, isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';

export default async function Page() {
  const headerStore = await headers();
  const host = (headerStore.get('x-forwarded-host') || headerStore.get('host') || '').split(':')[0].toLowerCase();
  const isPortalHost = isLoanOfficerPortalHost(host);

  if (!isPortalHost) {
    redirect('/pricer');
  }

  const session = await getLoanOfficerPortalSession();
  if (session) {
    redirect('/pricer');
  }

  return <LoanOfficerPortalGate nextPath="/pricer" />;
}
