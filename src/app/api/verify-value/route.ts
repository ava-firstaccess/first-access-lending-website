import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const HC_BASE = 'https://api.housecanary.com';

function normalizeAddressKey(address: string, zipcode?: string, city?: string, state?: string) {
  const raw = [address || '', zipcode || '', city || '', state || '']
    .join('|')
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return raw;
}

async function getCachedAvmResult(supabase: any, addressKey: string) {
  const { data, error } = await supabase
    .from('avm_cache')
    .select('*')
    .eq('address_key', addressKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('avm_cache lookup failed:', error.message);
    return null;
  }
  return data;
}

async function saveCachedAvmResult(supabase: any, payload: any) {
  const { error } = await supabase.from('avm_cache').insert(payload);
  if (error) {
    console.warn('avm_cache insert failed:', error.message);
  }
}


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
    const supabase = getSupabaseAdmin();
    if (sessionToken) {
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

    const addressKey = normalizeAddressKey(address, zipcode, city, state);
    const cached = await getCachedAvmResult(supabase, addressKey);
    if (cached) {
      console.log('verify-value cache hit:', { addressKey, tier: cached.tier });
      return NextResponse.json(cached.response_payload);
    }
    console.log('verify-value cache miss:', { addressKey });

    const maxLtv = getMaxLtv(creditScore || 720, propertyType || 'Primary');
    const balance = Number(loanBalance) || 0;
    const desired = Number(desiredLoanAmount) || 0;

    // ══════════════════════════════════════
    // Step 1: Property Estimate ($0.05)
    // ══════════════════════════════════════
    const estimateData = await getPropertyEstimate(address, zipcode, city, state);
    const hcEstimate = estimateData?.estimate;

    if (!hcEstimate) {
      const responsePayload = {
        tier: 'no_data',
        error: 'Unable to estimate property value',
        needsHuman: true,
      };
      await saveCachedAvmResult(supabase, {
        address_key: addressKey,
        address,
        zipcode: zipcode || null,
        city: city || null,
        state: state || null,
        tier: 'no_data',
        hc_estimate: null,
        hc_value: null,
        fsd: null,
        new_max_loan: null,
        max_ltv: maxLtv,
        response_payload: responsePayload,
      });
      return NextResponse.json(responsePayload);
    }

    const newMaxLoan = Math.max(0, (hcEstimate * maxLtv) - balance);

    // ══════════════════════════════════════
    // Step 2: Decide whether to stop, keep HC, or cascade
    // ══════════════════════════════════════
    const hcRatio = desired > 0 ? newMaxLoan / desired : 0;
    const useHouseCanaryEstimateOnly = hcRatio >= 0.8;
    const shouldCascadeToClearCapital = hcRatio >= 0.25 && hcRatio < 0.8 && newMaxLoan >= 25000;
    const shouldHardFail = hcRatio < 0.25 || newMaxLoan < 25000;

    if (useHouseCanaryEstimateOnly) {
      const responsePayload = {
        tier: 'estimate',
        hcValue: hcEstimate,
        statedValue: Number(statedValue),
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        hcRatio: Number(hcRatio.toFixed(4)),
        cascadeDecision: 'use_hc',
        needsHuman: false,
      };
      await saveCachedAvmResult(supabase, {
        address_key: addressKey,
        address,
        zipcode: zipcode || null,
        city: city || null,
        state: state || null,
        tier: 'estimate',
        hc_estimate: hcEstimate,
        hc_value: null,
        fsd: null,
        new_max_loan: Math.round(newMaxLoan),
        max_ltv: maxLtv,
        response_payload: responsePayload,
      });
      return NextResponse.json(responsePayload);
    }

    if (shouldHardFail) {
      const responsePayload = {
        tier: 'estimate',
        hcValue: hcEstimate,
        statedValue: Number(statedValue),
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        hcRatio: Number(hcRatio.toFixed(4)),
        cascadeDecision: 'hard_fail_no_cc',
        needsHuman: true,
      };
      await saveCachedAvmResult(supabase, {
        address_key: addressKey,
        address,
        zipcode: zipcode || null,
        city: city || null,
        state: state || null,
        tier: 'estimate',
        hc_estimate: hcEstimate,
        hc_value: null,
        fsd: null,
        new_max_loan: Math.round(newMaxLoan),
        max_ltv: maxLtv,
        response_payload: responsePayload,
      });
      return NextResponse.json(responsePayload);
    }

    // Borderline miss: continue to next paid valuation layer
    if (!shouldCascadeToClearCapital) {
      const responsePayload = {
        tier: 'estimate',
        hcValue: hcEstimate,
        statedValue: Number(statedValue),
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        hcRatio: Number(hcRatio.toFixed(4)),
        cascadeDecision: 'manual_review',
        needsHuman: true,
      };
      await saveCachedAvmResult(supabase, {
        address_key: addressKey,
        address,
        zipcode: zipcode || null,
        city: city || null,
        state: state || null,
        tier: 'estimate',
        hc_estimate: hcEstimate,
        hc_value: null,
        fsd: null,
        new_max_loan: Math.round(newMaxLoan),
        max_ltv: maxLtv,
        response_payload: responsePayload,
      });
      return NextResponse.json(responsePayload);
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
      const responsePayload = {
        tier: 'verified',
        hcValue: Math.round(verifiedValue),
        statedValue: Number(statedValue),
        fsd: fsdData.fsd,
        price_lwr: Math.round(fsdData.price_lwr),
        price_upr: Math.round(fsdData.price_upr),
        newMaxLoan: Math.round(verifiedMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
      };
      await saveCachedAvmResult(supabase, {
        address_key: addressKey,
        address,
        zipcode: zipcode || null,
        city: city || null,
        state: state || null,
        tier: 'verified',
        hc_estimate: hcEstimate,
        hc_value: Math.round(verifiedValue),
        fsd: fsdData.fsd,
        new_max_loan: Math.round(verifiedMaxLoan),
        max_ltv: maxLtv,
        response_payload: responsePayload,
      });
      return NextResponse.json(responsePayload);
    } else {
      // ══════════════════════════════════════
      // Low confidence - needs Clear Capital
      // ══════════════════════════════════════
      const responsePayload = {
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
      };
      await saveCachedAvmResult(supabase, {
        address_key: addressKey,
        address,
        zipcode: zipcode || null,
        city: city || null,
        state: state || null,
        tier: 'low_confidence',
        hc_estimate: hcEstimate,
        hc_value: Math.round(verifiedValue),
        fsd: fsdData.fsd,
        new_max_loan: Math.round(verifiedMaxLoan),
        max_ltv: maxLtv,
        response_payload: responsePayload,
      });
      return NextResponse.json(responsePayload);
    }
  } catch (err: any) {
    console.error('Verify value error:', err);
    return NextResponse.json(
      { error: err.message || 'Verification failed', tier: 'error' },
      { status: 500 }
    );
  }
}
