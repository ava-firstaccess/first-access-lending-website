import { NextRequest, NextResponse } from 'next/server';
import { chooseHouseCanaryOrderProduct, getHouseCanaryBillingCycle } from '@/lib/housecanary-billing';
import { buildLoanOfficerPortalUnauthorizedResponse, getLoanOfficerPortalSessionFromRequest, getRequestHost, isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const HOUSECANARY_CYCLE_FIELDS = [
  'housecanary_billing_cycle_start',
  'housecanary_billing_cycle_end',
  'housecanary_order_product',
  'housecanary_product_sequence_number',
  'housecanary_overall_sequence_number',
  'housecanary_free_tier_applied',
] as const;

function isMissingColumnError(error: any, columns: readonly string[]) {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return columns.some((column) => message.includes(String(column).toLowerCase()));
}

async function countHouseCanaryCycleUsage(supabase: ReturnType<typeof getSupabaseAdmin>, cycleStart: string, cycleEnd: string) {
  const { data, error } = await supabase
    .from('loan_officer_avm_orders')
    .select('housecanary_order_product')
    .eq('provider', 'housecanary')
    .eq('housecanary_billing_cycle_start', cycleStart)
    .eq('housecanary_billing_cycle_end', cycleEnd)
    .in('order_status', ['submitted', 'processing', 'completed']);

  if (error) {
    if (isMissingColumnError(error, HOUSECANARY_CYCLE_FIELDS)) {
      return { propertyExplorerOrders: 0, agileInsightsOrders: 0 };
    }
    throw new Error(`HouseCanary cycle usage lookup failed: ${error.message}`);
  }

  let propertyExplorerOrders = 0;
  let agileInsightsOrders = 0;
  for (const row of data || []) {
    if (row.housecanary_order_product === 'property_explorer') propertyExplorerOrders += 1;
    if (row.housecanary_order_product === 'agile_insights') agileInsightsOrders += 1;
  }

  return { propertyExplorerOrders, agileInsightsOrders };
}

export async function GET(req: NextRequest) {
  try {
    const session = getLoanOfficerPortalSessionFromRequest(req);
    if (!session) return buildLoanOfficerPortalUnauthorizedResponse();
    if (!isLoanOfficerPortalHost(getRequestHost(req))) {
      return NextResponse.json({ error: 'Loan Officer portal host required.' }, { status: 403 });
    }

    const targetDate = new Date();
    const cycle = getHouseCanaryBillingCycle(targetDate);
    const supabase = getSupabaseAdmin();
    const usage = await countHouseCanaryCycleUsage(supabase, cycle.cycleStart, cycle.cycleEnd);
    const nextAllocation = chooseHouseCanaryOrderProduct(usage, targetDate);

    return NextResponse.json({
      cycle,
      usage,
      nextAllocation: {
        selectedProduct: nextAllocation.selectedProduct,
        productSequenceNumber: nextAllocation.productSequenceNumber,
        overallSequenceNumber: nextAllocation.overallSequenceNumber,
        isFreeTier: nextAllocation.isFreeTier,
        freePropertyExplorerRemaining: nextAllocation.freePropertyExplorerRemaining,
        freeAgileInsightsRemaining: nextAllocation.freeAgileInsightsRemaining,
      },
      requestedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('LO AVM HouseCanary usage status error:', error);
    return NextResponse.json({ error: 'Failed to load HouseCanary usage status.' }, { status: 500 });
  }
}
