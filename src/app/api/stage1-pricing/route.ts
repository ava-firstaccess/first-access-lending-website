import { NextResponse } from 'next/server';
import { computeStage1Pricing } from '@/lib/stage1-pricing/server';
import type { Stage1PricingRequest } from '@/lib/stage1-pricing/types';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Stage1PricingRequest;
    return NextResponse.json(computeStage1Pricing(body));
  } catch (error) {
    console.error('stage1-pricing failed', error);
    return NextResponse.json({ error: 'Unable to compute pricing.' }, { status: 500 });
  }
}
