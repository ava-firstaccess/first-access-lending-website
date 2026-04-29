import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getApplicationBySessionToken, requireTrustedBrowserRequest } from '@/lib/application-session';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

const VERIFY_VALUE_IP_LIMIT = 20;
const VERIFY_VALUE_SESSION_LIMIT = 10;
const VERIFY_VALUE_WINDOW_SECONDS = 10 * 60;

const HC_BASE = 'https://api.housecanary.com';

type ClearCapitalClearAvmResult = {
  confidenceScore?: string;
  confidenceScoreAlt?: string;
  estimatedError?: number;
  forecastStdDev?: number;
  highValue?: number;
  lowValue?: number;
  marketValue?: number;
  runDate?: string;
};

type ClearCapitalOrderResponse = {
  id?: string;
  effectiveDate?: string;
  trackingIds?: string[] | number[];
  clearAvm?: {
    result?: ClearCapitalClearAvmResult;
  };
};

type HouseCanaryEstimateResponse = {
  estimate?: number;
};

type HouseCanaryValueResult = {
  price_mean: number;
  price_lwr: number;
  price_upr: number;
  fsd: number;
};

function buildSafeHouseCanaryError(message: string, status?: number) {
  const suffix = typeof status === 'number' ? ` (${status})` : '';
  return new Error(`${message}${suffix}`);
}

function buildSafeClearCapitalError(message: string, status?: number) {
  const suffix = typeof status === 'number' ? ` (${status})` : '';
  return new Error(`${message}${suffix}`);
}

function normalizeAddressKey(
  address: string,
  zipcode?: string,
  city?: string,
  state?: string,
  loanBalance?: number,
  creditScore?: number,
  propertyType?: string,
  desiredLoanAmount?: number,
) {
  const raw = [
    address || '',
    zipcode || '',
    city || '',
    state || '',
    String(Math.round(Number(loanBalance) || 0)),
    String(Math.round(Number(creditScore) || 0)),
    propertyType || '',
    String(Math.round(Number(desiredLoanAmount) || 0)),
  ]
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

function getClearCapitalPaaConfig() {
  const apiKey = process.env.CLEARCAPITAL_PAA_API_KEY;
  const baseUrl = process.env.CLEARCAPITAL_PAA_BASE_URL || 'https://api.clearcapital.com/property-analytics-api';
  if (!apiKey) return null;
  return { apiKey, baseUrl };
}

async function insertClearCapitalRun(supabase: any, payload: any) {
  try {
    const { error } = await supabase.from('clearcapital_runs').insert(payload);
    if (error) console.warn('clearcapital_runs insert failed:', error.message);
  } catch {
    console.warn('clearcapital_runs insert threw');
  }
}

async function updateClearCapitalRun(supabase: any, runId: string, payload: any) {
  try {
    const { error } = await supabase.from('clearcapital_runs').update(payload).eq('run_id', runId);
    if (error) console.warn('clearcapital_runs update failed:', error.message);
  } catch {
    console.warn('clearcapital_runs update threw');
  }
}

async function insertHouseCanaryRun(supabase: any, payload: any) {
  try {
    const { error } = await supabase.from('housecanary_runs').insert(payload);
    if (error) console.warn('housecanary_runs insert failed:', error.message);
  } catch {
    console.warn('housecanary_runs insert threw');
  }
}

async function updateHouseCanaryRun(supabase: any, runId: string, payload: any) {
  try {
    const { error } = await supabase.from('housecanary_runs').update(payload).eq('run_id', runId);
    if (error) console.warn('housecanary_runs update failed:', error.message);
  } catch {
    console.warn('housecanary_runs update threw');
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

async function getClearCapitalClearAvm(address: string, zipcode: string, city: string, state: string, trackingId: string) {
  const config = getClearCapitalPaaConfig();
  if (!config) return null;

  const url = `${config.baseUrl}/orders`;
  const payload = {
    address,
    city,
    state,
    zip: zipcode,
    signResponse: true,
    trackingIds: [trackingId],
    clearAvm: {
      include: true,
      request: {
        maxFSD: 0.3,
        exactEffectiveDate: false,
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw buildSafeClearCapitalError('Clear Capital Property Analytics failed', res.status);
  }

  const data = (await res.json()) as ClearCapitalOrderResponse;
  const result = data?.clearAvm?.result;

  if (!result?.marketValue) {
    throw new Error('No Clear Capital market value returned');
  }

  return {
    response: data,
    result,
    statusCode: res.status,
    responseBytes: JSON.stringify(data).length,
    endpointHost: new URL(config.baseUrl).hostname,
  };
}


async function tryClearCapitalFallback({
  supabase,
  applicationId,
  address,
  zipcode,
  city,
  state,
  statedValue,
  balance,
  maxLtv,
  desired,
  hcEstimate,
  hcValue,
  fsd,
  triggerReason,
}: {
  supabase: any;
  applicationId: string;
  address: string;
  zipcode: string;
  city?: string;
  state?: string;
  statedValue: number;
  balance: number;
  maxLtv: number;
  desired: number;
  hcEstimate: number | null;
  hcValue: number | null;
  fsd: number | null;
  triggerReason: string;
}) {
  const clearCapitalRunId = randomUUID();
  const clearCapitalTrackingId = applicationId || clearCapitalRunId;
  const clearCapitalConfig = getClearCapitalPaaConfig();

  if (!clearCapitalConfig) {
    await insertClearCapitalRun(supabase, {
      run_id: clearCapitalRunId,
      application_id: applicationId,
      endpoint_host: 'not_configured',
      status_code: null,
      status: 'skipped',
      tracking_ids: clearCapitalTrackingId,
      response_bytes: 0,
      error_category: 'config_missing',
      success: false,
      confidence_score: null,
      confidence_score_alt: null,
      estimated_error: null,
      forecast_std_dev: null,
      market_value: null,
      high_value: null,
      low_value: null,
      effective_date: null,
      vendor_run_date: null,
      notes: `Clear Capital skipped, config missing after ${triggerReason}`,
    });
    return null;
  }

  const baseRunPayload = {
    run_id: clearCapitalRunId,
    application_id: applicationId,
    endpoint_host: new URL(clearCapitalConfig.baseUrl).hostname,
    status_code: null,
    status: 'started',
    tracking_ids: clearCapitalTrackingId,
    response_bytes: 0,
    error_category: null,
    success: false,
    confidence_score: null,
    confidence_score_alt: null,
    estimated_error: null,
    forecast_std_dev: null,
    market_value: null,
    high_value: null,
    low_value: null,
    effective_date: null,
    vendor_run_date: null,
    notes: `Triggered after ${triggerReason}`,
  };
  await insertClearCapitalRun(supabase, baseRunPayload);

  try {
    const clearCapital = await getClearCapitalClearAvm(address, zipcode, city || '', state || '', clearCapitalTrackingId);
    const ccResult = clearCapital?.result;
    const clearCapitalValue = Math.round(ccResult?.marketValue || 0);
    const clearCapitalMaxLoan = Math.max(0, clearCapitalValue * maxLtv - balance);

    await updateClearCapitalRun(supabase, clearCapitalRunId, {
      ...baseRunPayload,
      status_code: clearCapital?.statusCode,
      status: 'completed',
      response_bytes: clearCapital?.responseBytes,
      success: true,
      confidence_score: ccResult?.confidenceScore || null,
      confidence_score_alt: ccResult?.confidenceScoreAlt || null,
      estimated_error: ccResult?.estimatedError ?? null,
      forecast_std_dev: ccResult?.forecastStdDev ?? null,
      market_value: clearCapitalValue,
      high_value: Math.round(ccResult?.highValue || 0),
      low_value: Math.round(ccResult?.lowValue || 0),
      effective_date: clearCapital?.response?.effectiveDate || null,
      vendor_run_date: ccResult?.runDate || null,
      notes: `ClearAVM success after ${triggerReason}`,
    });

    return {
      tier: 'verified',
      hcValue: clearCapitalValue,
      statedValue,
      price_lwr: Math.round(ccResult?.lowValue || 0),
      price_upr: Math.round(ccResult?.highValue || 0),
      newMaxLoan: Math.round(clearCapitalMaxLoan),
      maxLtv,
      desiredLoanAmount: desired,
      valuationProvider: 'clearcapital',
      cascadeDecision: 'use_clearcapital',
      clearCapitalConfidenceScore: ccResult?.confidenceScore,
      clearCapitalConfidenceScoreAlt: ccResult?.confidenceScoreAlt,
      clearCapitalEstimatedError: ccResult?.estimatedError,
      clearCapitalForecastStdDev: ccResult?.forecastStdDev,
      clearCapitalRunDate: ccResult?.runDate,
      clearCapitalEffectiveDate: clearCapital?.response?.effectiveDate,
      houseCanaryFsd: fsd,
      houseCanaryEstimate: hcEstimate,
      houseCanaryValue: hcValue,
    };
  } catch (clearCapitalError: any) {
    await updateClearCapitalRun(supabase, clearCapitalRunId, {
      ...baseRunPayload,
      status: 'failed',
      error_category: 'request_failed',
      notes: clearCapitalError instanceof Error ? clearCapitalError.message : `Clear Capital request failed after ${triggerReason}`,
      success: false,
    });
    return null;
  }
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

    const addressKey = normalizeAddressKey(
      address,
      zipcode,
      city,
      state,
      Number(loanBalance) || 0,
      Number(creditScore) || 720,
      String(propertyType || 'Primary'),
      Number(desiredLoanAmount) || 0,
    );
    const cached = await getCachedAvmResult(supabase, addressKey);
    if (cached) {
      console.log('verify-value cache hit:', { tier: cached.tier });
      return NextResponse.json(cached.response_payload);
    }
    console.log('verify-value cache miss');

    const maxLtv = getMaxLtv(creditScore || 720, propertyType || 'Primary');
    const balance = Number(loanBalance) || 0;
    const desired = Number(desiredLoanAmount) || 0;
    const numericStatedValue = Number(statedValue);

    const estimateRunId = randomUUID();
    const estimateRunBase = {
      run_id: estimateRunId,
      application_id: applicationId,
      provider: 'housecanary',
      product: 'property_estimated_value',
      endpoint_path: '/v3/property/estimated_value',
      status_code: null,
      status: 'started',
      response_bytes: 0,
      error_category: null,
      success: false,
      estimate_value: null,
      market_value: null,
      low_value: null,
      high_value: null,
      fsd: null,
      notes: 'HouseCanary estimate request started',
    };
    await insertHouseCanaryRun(supabase, estimateRunBase);

    let estimateData: HouseCanaryEstimateResponse | null = null;
    let hcEstimate: number | null = null;

    try {
      estimateData = await getPropertyEstimate(address, zipcode, city, state) as HouseCanaryEstimateResponse;
      hcEstimate = typeof estimateData?.estimate === 'number' ? estimateData.estimate : null;
      await updateHouseCanaryRun(supabase, estimateRunId, {
        ...estimateRunBase,
        status: hcEstimate ? 'completed' : 'no_data',
        success: Boolean(hcEstimate),
        estimate_value: hcEstimate,
        response_bytes: JSON.stringify(estimateData).length,
        notes: hcEstimate ? 'HouseCanary estimate returned a value' : 'HouseCanary estimate returned no estimate value',
      });
    } catch (estimateError: any) {
      await updateHouseCanaryRun(supabase, estimateRunId, {
        ...estimateRunBase,
        status: 'failed',
        error_category: 'request_failed',
        notes: estimateError instanceof Error ? estimateError.message : 'HouseCanary estimate request failed',
      });

      console.warn('verify-value HouseCanary estimate failed, attempting Clear Capital fallback if configured');
      const ccFallback = await tryClearCapitalFallback({
        supabase,
        applicationId,
        address,
        zipcode,
        city,
        state,
        statedValue: numericStatedValue,
        balance,
        maxLtv,
        desired,
        hcEstimate: null,
        hcValue: null,
        fsd: null,
        triggerReason: 'housecanary_estimate_failure',
      });

      if (ccFallback) {
        await saveCachedAvmResult(supabase, {
          address_key: addressKey,
          address,
          zipcode: zipcode || null,
          city: city || null,
          state: state || null,
          application_id: applicationId,
          tier: 'verified',
          hc_estimate: null,
          hc_value: null,
          fsd: null,
          new_max_loan: ccFallback.newMaxLoan,
          max_ltv: maxLtv,
          response_payload: ccFallback,
        });
        return NextResponse.json(ccFallback);
      }

      const responsePayload = {
        tier: 'no_data',
        error: 'Unable to estimate property value',
        cascadeDecision: 'hc_failed_cc_unavailable_or_failed',
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

    if (!hcEstimate) {
      console.log('verify-value HouseCanary returned no estimate, attempting Clear Capital fallback if configured');
      const ccFallback = await tryClearCapitalFallback({
        supabase,
        applicationId,
        address,
        zipcode,
        city,
        state,
        statedValue: numericStatedValue,
        balance,
        maxLtv,
        desired,
        hcEstimate: null,
        hcValue: null,
        fsd: null,
        triggerReason: 'housecanary_estimate_no_data',
      });

      if (ccFallback) {
        await saveCachedAvmResult(supabase, {
          address_key: addressKey,
          address,
          zipcode: zipcode || null,
          city: city || null,
          state: state || null,
          application_id: applicationId,
          tier: 'verified',
          hc_estimate: null,
          hc_value: null,
          fsd: null,
          new_max_loan: ccFallback.newMaxLoan,
          max_ltv: maxLtv,
          response_payload: ccFallback,
        });
        return NextResponse.json(ccFallback);
      }

      const responsePayload = {
        tier: 'no_data',
        error: 'Unable to estimate property value',
        cascadeDecision: 'hc_no_data_cc_unavailable_or_failed',
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
    const hcRatio = desired > 0 ? newMaxLoan / desired : 0;
    const useHouseCanaryEstimateOnly = hcRatio >= 0.8;
    const shouldCascadeToClearCapital = hcRatio >= 0.25 && hcRatio < 0.8 && newMaxLoan >= 25000;
    const shouldHardFail = hcRatio < 0.25 || newMaxLoan < 25000;

    console.log('verify-value decision after HouseCanary estimate', {
      useHouseCanaryEstimateOnly,
      shouldCascadeToClearCapital,
      shouldHardFail,
    });

    if (useHouseCanaryEstimateOnly) {
      const responsePayload = {
        tier: 'estimate',
        hcValue: hcEstimate,
        statedValue: numericStatedValue,
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        hcRatio: Number(hcRatio.toFixed(4)),
        valuationProvider: 'housecanary_estimate',
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
        statedValue: numericStatedValue,
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        hcRatio: Number(hcRatio.toFixed(4)),
        valuationProvider: 'housecanary_estimate',
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

    if (!shouldCascadeToClearCapital) {
      const responsePayload = {
        tier: 'estimate',
        hcValue: hcEstimate,
        statedValue: numericStatedValue,
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        hcRatio: Number(hcRatio.toFixed(4)),
        valuationProvider: 'housecanary_estimate',
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

    const valueRunId = randomUUID();
    const valueRunBase = {
      run_id: valueRunId,
      application_id: applicationId,
      provider: 'housecanary',
      product: 'property_value',
      endpoint_path: '/v2/property/value',
      status_code: null,
      status: 'started',
      response_bytes: 0,
      error_category: null,
      success: false,
      estimate_value: hcEstimate,
      market_value: null,
      low_value: null,
      high_value: null,
      fsd: null,
      notes: 'HouseCanary full AVM request started',
    };
    await insertHouseCanaryRun(supabase, valueRunBase);

    let fsdData: HouseCanaryValueResult;
    try {
      fsdData = await getPropertyValueWithFSD(address, zipcode) as HouseCanaryValueResult;
      await updateHouseCanaryRun(supabase, valueRunId, {
        ...valueRunBase,
        status: 'completed',
        success: true,
        market_value: Math.round(fsdData.price_mean),
        low_value: Math.round(fsdData.price_lwr),
        high_value: Math.round(fsdData.price_upr),
        fsd: fsdData.fsd,
        response_bytes: JSON.stringify(fsdData).length,
        notes: `HouseCanary full AVM completed with FSD=${fsdData.fsd}`,
      });
    } catch (valueError: any) {
      await updateHouseCanaryRun(supabase, valueRunId, {
        ...valueRunBase,
        status: 'failed',
        error_category: 'request_failed',
        notes: valueError instanceof Error ? valueError.message : 'HouseCanary full AVM request failed',
      });

      const ccFallback = await tryClearCapitalFallback({
        supabase,
        applicationId,
        address,
        zipcode,
        city,
        state,
        statedValue: numericStatedValue,
        balance,
        maxLtv,
        desired,
        hcEstimate,
        hcValue: null,
        fsd: null,
        triggerReason: 'housecanary_full_avm_failure',
      });

      if (ccFallback) {
        await saveCachedAvmResult(supabase, {
          address_key: addressKey,
          address,
          zipcode: zipcode || null,
          city: city || null,
          state: state || null,
          application_id: applicationId,
          tier: 'verified',
          hc_estimate: hcEstimate,
          hc_value: null,
          fsd: null,
          new_max_loan: ccFallback.newMaxLoan,
          max_ltv: maxLtv,
          response_payload: ccFallback,
        });
        return NextResponse.json(ccFallback);
      }

      const responsePayload = {
        tier: 'low_confidence',
        hcValue: Math.round(hcEstimate),
        statedValue: numericStatedValue,
        newMaxLoan: Math.round(newMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        valuationProvider: 'housecanary_estimate',
        cascadeDecision: 'hc_full_avm_failed_cc_unavailable_or_failed',
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
        hc_value: null,
        fsd: null,
        new_max_loan: Math.round(newMaxLoan),
        max_ltv: maxLtv,
        response_payload: responsePayload,
      });
      return NextResponse.json(responsePayload);
    }

    const verifiedValue = fsdData.price_mean;
    const verifiedMaxLoan = Math.max(0, (verifiedValue * maxLtv) - balance);

    if (fsdData.fsd < 0.20) {
      const responsePayload = {
        tier: 'verified',
        hcValue: Math.round(verifiedValue),
        statedValue: numericStatedValue,
        fsd: fsdData.fsd,
        price_lwr: Math.round(fsdData.price_lwr),
        price_upr: Math.round(fsdData.price_upr),
        newMaxLoan: Math.round(verifiedMaxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        valuationProvider: 'housecanary',
        cascadeDecision: 'use_hc_verified',
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
    }

    const ccFallback = await tryClearCapitalFallback({
      supabase,
      applicationId,
      address,
      zipcode,
      city,
      state,
      statedValue: numericStatedValue,
      balance,
      maxLtv,
      desired,
      hcEstimate,
      hcValue: Math.round(verifiedValue),
      fsd: fsdData.fsd,
      triggerReason: `housecanary_low_confidence_fsd_${fsdData.fsd}`,
    });

    if (ccFallback) {
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
        new_max_loan: ccFallback.newMaxLoan,
        max_ltv: maxLtv,
        response_payload: ccFallback,
      });
      return NextResponse.json(ccFallback);
    }

    const responsePayload = {
      tier: 'low_confidence',
      hcValue: Math.round(verifiedValue),
      statedValue: numericStatedValue,
      fsd: fsdData.fsd,
      price_lwr: Math.round(fsdData.price_lwr),
      price_upr: Math.round(fsdData.price_upr),
      newMaxLoan: Math.round(verifiedMaxLoan),
      maxLtv,
      desiredLoanAmount: desired,
      valuationProvider: 'housecanary',
      cascadeDecision: 'hc_low_confidence_cc_unavailable_or_failed',
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
  } catch (err: any) {
    console.error('Verify value error');
    return NextResponse.json(
      { error: 'Verification failed', tier: 'error' },
      { status: 500 }
    );
  }
}
