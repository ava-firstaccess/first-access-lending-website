import { NextRequest, NextResponse } from 'next/server';
import { computeStage1Pricing } from '@/lib/stage1-pricing/server';
import type { Stage1PricingRequest } from '@/lib/stage1-pricing/types';
import { getLoanOfficerPortalSessionFromRequest, getRequestHost, isInternalPortalHost } from '@/lib/lo-portal-auth';

export async function POST(request: NextRequest) {
  try {
    const isPortalRequest = isInternalPortalHost(getRequestHost(request));
    if (!isPortalRequest) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const loanOfficerSession = getLoanOfficerPortalSessionFromRequest(request);
    if (!loanOfficerSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Stage1PricingRequest;
    return NextResponse.json(computeStage1Pricing(body));
  } catch (error) {
    console.error('pricer stage1-pricing failed', error);
    return NextResponse.json({ error: 'Unable to compute pricing.' }, { status: 500 });
  }
}
