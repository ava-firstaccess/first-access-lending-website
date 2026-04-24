import { NextResponse } from 'next/server';
import { computeStage1Pricing } from '@/lib/stage1-pricing/server';
import type { Stage1PricingRequest } from '@/lib/stage1-pricing/types';
import { hasPricerAccess } from '@/lib/pricer-auth';

export async function POST(request: Request) {
  try {
    if (!(await hasPricerAccess())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as Stage1PricingRequest;
    return NextResponse.json(computeStage1Pricing(body));
  } catch (error) {
    console.error('pricer stage1-pricing failed', error);
    return NextResponse.json({ error: 'Unable to compute pricing.' }, { status: 500 });
  }
}
