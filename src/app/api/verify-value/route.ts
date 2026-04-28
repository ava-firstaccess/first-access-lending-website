import { NextRequest, NextResponse } from 'next/server';
import { getApplicationBySessionToken, requireTrustedBrowserRequest } from '@/lib/application-session';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

const VERIFY_VALUE_IP_LIMIT = 20;
const VERIFY_VALUE_SESSION_LIMIT = 10;
const VERIFY_VALUE_WINDOW_SECONDS = 10 * 60;

const HC_BASE = 'https://api.housecanary.com';

function buildSafeHouseCanaryError(message: string, status?: number) {
  const suffix = typeof status === 'number' ? ` (${status})` : '';
  return new Error(`${message}${suffix}`);
}

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

  const res = await fetch(url, {
    headers: { Authorization: getHCAuth() },
  });

  if (!res.ok) {
    console.error('HouseCanary estimate error:', { status: res.status });
    throw buildSafeHouseCanaryError('HouseCanary estimate failed', res.status);
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
    console.error('HouseCanary value error:', { status: res.status });
    throw buildSafeHouseCanaryError('HouseCanary value failed', res.status);
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
    const trusted = requireTrustedBrowserRequest(req);
    if (trusted) return trusted;

    const sessionTokenFromCookie = req.cookies.get('session_token')?.value || '';

    // TODO(launch): remove this explicit sessionToken/applicationId fallback after direct step testing is no longer needed.
    const body = await req.json();
    const explicitSessionToken = String(body.sessionToken || '').trim();
    const sessionToken = explicitSessionToken || sessionTokenFromCookie;
    const requestedApplicationId = String(body.applicationId || '').trim();
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const auth = await getApplicationBySessionToken(sessionToken, 'id, session_expires_at');
    if ('response' in auth) return auth.response;
    const { supabase, app } = auth;
    const applicationId = typeof app?.id === 'string' ? app.id : null;
    if (!applicationId) {
      return NextResponse.json({ error: 'Session expired. Please verify again.' }, { status: 401 });
    }
    if (requestedApplicationId && requestedApplicationId !== applicationId) {
      return NextResponse.json({ error: 'Application/session mismatch.' }, { status: 401 });
    }


    const clientIp = getClientIp(req);
    const [ipRate, sessionRate] = await Promise.all([
      consumeRateLimit({
        scope: 'verify-value:ip',
        key: clientIp,
        limit: VERIFY_VALUE_IP_LIMIT,
        windowSeconds: VERIFY_VALUE_WINDOW_SECONDS,
      }),
      consumeRateLimit({
        scope: 'verify-value:session',
        key: applicationId,
        limit: VERIFY_VALUE_SESSION_LIMIT,
        windowSeconds: VERIFY_VALUE_WINDOW_SECONDS,
      }),
    ]);

    if (!ipRate.allowed || !sessionRate.allowed) {
      const retryAfterSeconds = Math.max(ipRate.retryAfterSeconds, sessionRate.retryAfterSeconds);
      return NextResponse.json(
        { error: 'Too many property verification attempts. Please wait and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    // ── Parse request ──
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

    console.log('verify-value request received');

    const addressKey = normalizeAddressKey(address, zipcode, city, state);
    const cached = await getCachedAvmResult(supabase, addressKey);
    if (cached) {
      console.log('verify-value cache hit:', { tier: cached.tier });
      return NextResponse.json(cached.response_payload);
    }
    console.log('verify-value cache miss');

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
        application_id: applicationId,
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
        application_id: applicationId,
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
        application_id: applicationId,
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
        application_id: applicationId,
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
        application_id: applicationId,
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
        application_id: applicationId,
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
    console.error('Verify value error');
    return NextResponse.json(
      { error: 'Verification failed', tier: 'error' },
      { status: 500 }
    );
  }
}
