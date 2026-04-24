import { Stage1PricingPage } from '@/components/Stage1PricingPage';
import { PricerPasswordGate } from '@/components/PricerPasswordGate';
import { hasPricerAccess, isPricerConfigured } from '@/lib/pricer-auth';

export default async function PricePage() {
  if (!isPricerConfigured() || !(await hasPricerAccess())) {
    return <PricerPasswordGate />;
  }
  return <Stage1PricingPage mode="pricer" />;
}
