import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const HC_BASE = 'https://api.housecanary.com';

function getHCAuth(): string {
  const key = process.env.HOUSECANARY_API_KEY;
  const secret = process.env.HOUSECANARY_API_SECRET;
  if (!key || !secret) throw new Error('HouseCanary credentials not configured');
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

function getMaxLtv(creditScore: number, propertyType: string): number {
  if (creditScore >= 720) {
    return propertyType === 'Primary' ? 0.90 : propertyType === '2nd Home' ? 0.85 : 0.80;
  } else if (creditScore >= 680) {
    return propertyType === 'Primary' ? 0.85 : propertyType === '2nd Home' ? 0.80 : 0.75;
  } else if (creditScore >= 640) {
    return propertyType === 'Primary' ? 0.80 : propertyType === '2nd Home' ? 0.75 : 0.70;
  }
  return propertyType === 'Primary' ? 0.70 : propertyType === '2nd Home' ? 0.65 : 0.60;
}

// Step 1: Property Estimate ($0.05/call)
async function getPropertyEstimate(address: string, zipcode: string, city?: string, state?: string) {
  const params = new URLSearchParams({ address });
  if (zipcode) params.set('zipcode', zipcode);
  if (city) params.set('city', city);
  if (state) params.set('state', state);

  const url = `${HC_BASE}/v3/property/estimated_value?${params.toString()}`;
  console.log('HouseCanary estimate request:', url.replace(HC_BASE, ''));

  const res = await fetch(url, {
    headers: { Authorization: getHCAuth() },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('HouseCanary estimate error:', res.status, text);
    throw new Error(`HouseCanary estimate failed (${res.status}): ${text}`);
  }

  return res.json();
}

// Step 2: Full AVM with FSD ($0.30/call)
async function getPropertyValueWithFSD(address: string, zipcode: string) {
  const url = `${HC_BASE}/v2/property/value?address=${encodeURIComponent(address)}&zipcode=${encodeURIComponent(zipcode)}`;
  const res = await fetch(url, {
    headers: { Authorization: getHCAuth() },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HouseCanary value failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  // v2 returns an array
  const result = Array.isArray(data) ? data[0] : data;
  const valueData = result?.['property/value']?.result?.value;

  if (!valueData) {
    throw new Error('No value data returned from HouseCanary');
  }

  return {
    price_mean: valueData.price_mean,
    price_lwr: valueData.price_lwr,
    price_upr: valueData.price_upr,
    fsd: valueData.fsd,
  };
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth check (soft - allow unauthenticated for testing) ──
    const sessionToken = req.cookies.get('session_token')?.value;
    if (sessionToken) {
      const supabase = getSupabaseAdmin();
      const { data: app } = await supabase
        .from('applications')
        .select('id')
        .eq('session_token', sessionToken)
        .single();
      // Log but don't block if app not found
      if (!app) {
        console.warn('verify-value: session_token present but no matching application');
      }
    }

    // ── Parse request ──
    const body = await req.json();
    const {
      address,
      zipcode,
      city,
      state,
      statedValue,
      loanBalance,
      creditScore,
      propertyType,
      desiredLoanAmount,
    } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    if (!zipcode && !city) {
      return NextResponse.json({ error: 'Zipcode or city/state required' }, { status: 400 });
    }

    console.log('verify-value request:', { address, zipcode, city, state, statedValue, desiredLoanAmount });

    const maxLtv = getMaxLtv(creditScore || 720, propertyType || 'Primary');
    const balance = Number(loanBalance) || 0;
    const desired = Number(desiredLoanAmount) || 0;

    // ══════════════════════════════════════
    // Step 1: Property Estimate ($0.05)
    // ══════════════════════════════════════
    const estimateData = await getPropertyEstimate(address, zipcode, city, state);
    const hcEstimate = estimateData?.estimate;

    if (!hcEstimate) {
      return NextResponse.json({
        tier: 'no_data',
        error: 'Unable to estimate property value',
        needsHuman: true,
      });
    }

    const newMaxLoan = Math.max(0, (hcEstimate * maxLtv) - balance);

    // ══════════════════════════════════════
    // Step 2: Check cascade conditions
    // ══════════════════════════════════════
    const loanDiffPct = desired > 0 ? Math.abs(newMaxLoan - desired) / desired : 1;
    const withinThreshold = loanDiffPct <= 0.20 && newMaxLoan > 50000;

    if (!withinThreshold) {
      // Loan amount too far off or too small - exit ramp
      return NextResponse.json({
        tier: 'estimate',
        hcValue: hcEstimate,
        statedValue: Number(statedValue),
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        loanDiffPct: Math.round(loanDiffPct * 100),
        needsHuman: true,
      });
    }

    // ══════════════════════════════════════
    // Step 3: Full AVM for FSD ($0.30)
    // ══════════════════════════════════════
    const fsdData = await getPropertyValueWithFSD(address, zipcode);

    // Use the more accurate v2 value now that we're paying for it
    const verifiedValue = fsdData.price_mean;
    const verifiedMaxLoan = Math.max(0, (verifiedValue * maxLtv) - balance);

    if (fsdData.fsd < 0.20) {
      // ══════════════════════════════════════
      // High confidence - accept value
      // ══════════════════════════════════════
      return NextResponse.json({
        tier: 'verified',
        hcValue: Math.round(verifiedValue),
        statedValue: Number(statedValue),
        fsd: fsdData.fsd,
        price_lwr: Math.round(fsdData.price_lwr),
        price_upr: Math.round(fsdData.price_upr),
        newMaxLoan: Math.round(verifiedMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
      });
    } else {
      // ══════════════════════════════════════
      // Low confidence - needs Clear Capital
      // ══════════════════════════════════════
      return NextResponse.json({
        tier: 'low_confidence',
        hcValue: Math.round(verifiedValue),
        statedValue: Number(statedValue),
        fsd: fsdData.fsd,
        price_lwr: Math.round(fsdData.price_lwr),
        price_upr: Math.round(fsdData.price_upr),
        newMaxLoan: Math.round(verifiedMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        needsClearCapital: true,
      });
    }
  } catch (err: any) {
    console.error('Verify value error:', err);
    return NextResponse.json(
      { error: err.message || 'Verification failed', tier: 'error' },
      { status: 500 }
    );
  }
}
