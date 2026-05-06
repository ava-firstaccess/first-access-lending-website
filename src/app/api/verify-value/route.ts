import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getApplicationBySessionToken, requireTrustedBrowserRequest } from '@/lib/application-session';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { evaluateInvestorAvmRule, type InvestorName, type VerificationAvmProvider } from '@/lib/rates/investor-confidence-rules';

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

type ClearCapitalCandidate = {
  value: number;
  maxLoan: number;
  ratio: number;
  lowConfidence: boolean;
  belowTarget: boolean;
  belowFloor: boolean;
  lowValue: boolean;
  eligible: boolean;
  result?: ClearCapitalClearAvmResult;
  response?: ClearCapitalOrderResponse;
  responseBytes: number;
  statusCode?: number;
  effectiveDate?: string;
};

type QuotedInvestorContext = {
  quotedInvestor: string | null;
  mappedInvestor: InvestorName | null;
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

function getFinalAvmFsd(responsePayload: any) {
  if (typeof responsePayload?.finalFsd === 'number' && Number.isFinite(responsePayload.finalFsd)) {
    return responsePayload.finalFsd;
  }

  if (responsePayload?.valuationProvider === 'clearcapital') {
    return typeof responsePayload?.clearCapitalForecastStdDev === 'number' && Number.isFinite(responsePayload.clearCapitalForecastStdDev)
      ? responsePayload.clearCapitalForecastStdDev
      : null;
  }

  if (typeof responsePayload?.fsd === 'number' && Number.isFinite(responsePayload.fsd)) {
    return responsePayload.fsd;
  }

  return typeof responsePayload?.houseCanaryFsd === 'number' && Number.isFinite(responsePayload.houseCanaryFsd)
    ? responsePayload.houseCanaryFsd
    : null;
}

function buildCachedAvmPayload({
  addressKey,
  address,
  zipcode,
  city,
  state,
  applicationId,
  maxLtv,
  responsePayload,
}: {
  addressKey: string;
  address: string;
  zipcode?: string | null;
  city?: string | null;
  state?: string | null;
  applicationId: string;
  maxLtv: number;
  responsePayload: any;
}) {
  return {
    address_key: addressKey,
    address,
    zipcode: zipcode || null,
    city: city || null,
    state: state || null,
    application_id: applicationId,
    tier: responsePayload?.tier || null,
    hc_estimate: null,
    hc_value: null,
    fsd: null,
    new_max_loan: null,
    max_ltv: maxLtv,
    final_value: typeof responsePayload?.hcValue === 'number' ? Math.round(responsePayload.hcValue) : null,
    final_provider: typeof responsePayload?.valuationProvider === 'string' ? responsePayload.valuationProvider : null,
    final_fsd: getFinalAvmFsd(responsePayload),
    final_new_max_loan: typeof responsePayload?.newMaxLoan === 'number' ? Math.round(responsePayload.newMaxLoan) : null,
    response_payload: responsePayload,
  };
}

function getClearCapitalPaaConfig() {
  const apiKey = process.env.CLEARCAPITAL_PAA_API_KEY;
  const baseUrl = process.env.CLEARCAPITAL_PAA_BASE_URL || 'https://api.clearcapital.com/property-analytics-api';
  if (!apiKey) return null;
  return { apiKey, baseUrl };
}

const AVM_PROVIDER_RUNS_TABLE = 'avm_provider_runs';

async function insertAvmProviderRun(supabase: any, payload: any) {
  try {
    const { error } = await supabase.from(AVM_PROVIDER_RUNS_TABLE).insert(payload);
    if (error) console.warn('avm_provider_runs insert failed:', error.message);
  } catch {
    console.warn('avm_provider_runs insert threw');
  }
}

async function updateAvmProviderRun(supabase: any, runId: string, payload: any) {
  try {
    const { error } = await supabase.from(AVM_PROVIDER_RUNS_TABLE).update(payload).eq('run_id', runId);
    if (error) console.warn('avm_provider_runs update failed:', error.message);
  } catch {
    console.warn('avm_provider_runs update threw');
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

function hasClearCapitalLowConfidence(result: ClearCapitalClearAvmResult | undefined) {
  const confidenceScore = String(result?.confidenceScore || '').trim().toLowerCase();
  const confidenceScoreAlt = String(result?.confidenceScoreAlt || '').trim().toLowerCase();
  const forecastStdDev = typeof result?.forecastStdDev === 'number' ? result.forecastStdDev : null;

  return confidenceScore === 'low'
    || confidenceScoreAlt === 'low'
    || (forecastStdDev !== null && forecastStdDev > 0.20);
}

function mapQuotedInvestorLabelToRuleInvestor(investorLabel: string | null | undefined): InvestorName | null {
  if (!investorLabel) return null;
  if (investorLabel === 'OSB' || investorLabel === 'Onslow') return 'Onslow';
  if (investorLabel === 'Arc Home' || investorLabel === 'Arc') return 'Arc';
  if (investorLabel === 'Deephaven' || investorLabel === 'DeepHaven') return 'DeepHaven';
  if (investorLabel === 'Button' || investorLabel === 'Vista' || investorLabel === 'NewRez' || investorLabel === 'Verus' || investorLabel === 'SG Capital' || investorLabel === 'NQM Capital') return investorLabel;
  return null;
}

function getQuotedInvestorContext(app: Record<string, unknown>): QuotedInvestorContext {
  const formData = (app.form_data && typeof app.form_data === 'object') ? app.form_data as Record<string, unknown> : null;
  const quotedInvestor = typeof formData?.quotedInvestor === 'string' ? formData.quotedInvestor : null;
  return {
    quotedInvestor,
    mappedInvestor: mapQuotedInvestorLabelToRuleInvestor(quotedInvestor),
  };
}

function evaluateQuotedInvestorProvider(
  quotedInvestor: QuotedInvestorContext,
  provider: VerificationAvmProvider,
  fsd: number | null | undefined,
) {
  if (!quotedInvestor.mappedInvestor || typeof fsd !== 'number' || !Number.isFinite(fsd)) return null;
  return evaluateInvestorAvmRule(quotedInvestor.mappedInvestor, provider, fsd);
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

async function runClearCapitalCandidate({
  supabase,
  applicationId,
  address,
  zipcode,
  city,
  state,
  balance,
  maxLtv,
  desired,
  triggerReason,
  loanNumber,
}: {
  supabase: any;
  applicationId: string;
  address: string;
  zipcode: string;
  city?: string;
  state?: string;
  balance: number;
  maxLtv: number;
  desired: number;
  triggerReason: string;
  loanNumber?: string;
}): Promise<ClearCapitalCandidate | null> {
  const clearCapitalRunId = randomUUID();
  const clearCapitalTrackingId = String(loanNumber || '').trim() || applicationId || clearCapitalRunId;
  const clearCapitalConfig = getClearCapitalPaaConfig();

  if (!clearCapitalConfig) {
    await insertAvmProviderRun(supabase, {
      run_id: clearCapitalRunId,
      application_id: applicationId,
      address,
      zipcode,
      city: city || null,
      state: state || null,
      provider: 'clearcapital',
      product: 'property_analytics',
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
    address,
    zipcode,
    city: city || null,
    state: state || null,
    provider: 'clearcapital',
    product: 'property_analytics',
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
  await insertAvmProviderRun(supabase, baseRunPayload);

  try {
    const clearCapital = await getClearCapitalClearAvm(address, zipcode, city || '', state || '', clearCapitalTrackingId);
    const ccResult = clearCapital?.result;
    const value = Math.round(ccResult?.marketValue || 0);
    const maxLoan = Math.max(0, value * maxLtv - balance);
    const ratio = desired > 0 ? maxLoan / desired : 0;
    const lowConfidence = hasClearCapitalLowConfidence(ccResult);
    const belowTarget = ratio < 0.25;
    const belowFloor = maxLoan < 50000;
    const lowValue = belowTarget || belowFloor;
    const eligible = !lowConfidence && !lowValue;

    await updateAvmProviderRun(supabase, clearCapitalRunId, {
      ...baseRunPayload,
      status_code: clearCapital?.statusCode,
      status: 'completed',
      response_bytes: clearCapital?.responseBytes,
      success: true,
      confidence_score: ccResult?.confidenceScore || null,
      confidence_score_alt: ccResult?.confidenceScoreAlt || null,
      estimated_error: ccResult?.estimatedError ?? null,
      forecast_std_dev: ccResult?.forecastStdDev ?? null,
      market_value: value,
      high_value: Math.round(ccResult?.highValue || 0),
      low_value: Math.round(ccResult?.lowValue || 0),
      effective_date: clearCapital?.response?.effectiveDate || null,
      vendor_run_date: ccResult?.runDate || null,
      notes: lowValue
        ? `ClearAVM low value exit ramp after ${triggerReason}`
        : lowConfidence
          ? `ClearAVM low confidence exit ramp after ${triggerReason}`
          : `ClearAVM success after ${triggerReason}`,
    });

    return {
      value,
      maxLoan,
      ratio,
      lowConfidence,
      belowTarget,
      belowFloor,
      lowValue,
      eligible,
      result: ccResult,
      response: clearCapital?.response,
      responseBytes: clearCapital?.responseBytes || 0,
      statusCode: clearCapital?.statusCode,
      effectiveDate: clearCapital?.response?.effectiveDate,
    };
  } catch (clearCapitalError: any) {
    await updateAvmProviderRun(supabase, clearCapitalRunId, {
      ...baseRunPayload,
      status: 'failed',
      error_category: 'request_failed',
      notes: clearCapitalError instanceof Error ? clearCapitalError.message : `Clear Capital request failed after ${triggerReason}`,
      success: false,
    });
    return null;
  }
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
  quotedInvestor,
  loanNumber,
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
  quotedInvestor: QuotedInvestorContext;
  loanNumber?: string;
}) {
  const candidate = await runClearCapitalCandidate({
    supabase,
    applicationId,
    address,
    zipcode,
    city,
    state,
    balance,
    maxLtv,
    desired,
    triggerReason,
    loanNumber,
  });

  if (!candidate) return null;

  const ccInvestorEvaluation = evaluateQuotedInvestorProvider(
    quotedInvestor,
    'Clear Capital',
    candidate.result?.forecastStdDev,
  );
  const ccEligibleForQuotedInvestor = candidate.eligible && (ccInvestorEvaluation?.passes ?? true);
  if (!ccEligibleForQuotedInvestor) {
    return null;
  }

  const ccResult = candidate.result;
  const houseCanaryComparableValue = Math.round(hcValue ?? hcEstimate ?? 0);
  const houseCanaryComparableMaxLoan = Math.max(0, houseCanaryComparableValue * maxLtv - balance);

  if (candidate.belowTarget && !candidate.belowFloor) {
    const useClearCapital = candidate.maxLoan >= houseCanaryComparableMaxLoan;

    if (useClearCapital) {
      return {
        tier: 'verified',
        hcValue: candidate.value,
        statedValue,
        price_lwr: Math.round(ccResult?.lowValue || 0),
        price_upr: Math.round(ccResult?.highValue || 0),
        newMaxLoan: Math.round(candidate.maxLoan),
        maxLtv,
        desiredLoanAmount: desired,
        valuationProvider: 'clearcapital',
        cascadeDecision: 'use_higher_of_hc_and_clearcapital',
        clearCapitalConfidenceScore: ccResult?.confidenceScore,
        clearCapitalConfidenceScoreAlt: ccResult?.confidenceScoreAlt,
        clearCapitalEstimatedError: ccResult?.estimatedError,
        clearCapitalForecastStdDev: ccResult?.forecastStdDev,
        clearCapitalRunDate: ccResult?.runDate,
        clearCapitalEffectiveDate: candidate.effectiveDate,
        houseCanaryFsd: fsd,
        houseCanaryEstimate: hcEstimate,
        houseCanaryValue: hcValue,
      };
    }

    return {
      tier: hcValue ? 'verified' : 'estimate',
      hcValue: houseCanaryComparableValue,
      statedValue,
      fsd: fsd ?? undefined,
      newMaxLoan: Math.round(houseCanaryComparableMaxLoan),
      maxLtv,
      desiredLoanAmount: desired,
      valuationProvider: hcValue ? 'housecanary' : 'housecanary_estimate',
      cascadeDecision: 'use_higher_of_hc_and_clearcapital',
      houseCanaryFsd: fsd,
      houseCanaryEstimate: hcEstimate,
      houseCanaryValue: hcValue,
      clearCapitalConfidenceScore: ccResult?.confidenceScore,
      clearCapitalConfidenceScoreAlt: ccResult?.confidenceScoreAlt,
      clearCapitalEstimatedError: ccResult?.estimatedError,
      clearCapitalForecastStdDev: ccResult?.forecastStdDev,
      clearCapitalRunDate: ccResult?.runDate,
      clearCapitalEffectiveDate: candidate.effectiveDate,
    };
  }

  if (candidate.lowValue) {
    return {
      tier: 'low_confidence',
      hcValue: candidate.value,
      statedValue,
      price_lwr: Math.round(ccResult?.lowValue || 0),
      price_upr: Math.round(ccResult?.highValue || 0),
      newMaxLoan: Math.round(candidate.maxLoan),
      maxLtv,
      desiredLoanAmount: desired,
      valuationProvider: 'clearcapital',
      cascadeDecision: 'clearcapital_low_value_exit_ramp',
      clearCapitalConfidenceScore: ccResult?.confidenceScore,
      clearCapitalConfidenceScoreAlt: ccResult?.confidenceScoreAlt,
      clearCapitalEstimatedError: ccResult?.estimatedError,
      clearCapitalForecastStdDev: ccResult?.forecastStdDev,
      clearCapitalRunDate: ccResult?.runDate,
      clearCapitalEffectiveDate: candidate.effectiveDate,
      houseCanaryFsd: fsd,
      houseCanaryEstimate: hcEstimate,
      houseCanaryValue: hcValue,
      needsHuman: true,
    };
  }

  if (candidate.lowConfidence) {
    return {
      tier: 'low_confidence',
      hcValue: candidate.value,
      statedValue,
      price_lwr: Math.round(ccResult?.lowValue || 0),
      price_upr: Math.round(ccResult?.highValue || 0),
      newMaxLoan: Math.round(candidate.maxLoan),
      maxLtv,
      desiredLoanAmount: desired,
      valuationProvider: 'clearcapital',
      cascadeDecision: 'clearcapital_low_confidence_exit_ramp',
      clearCapitalConfidenceScore: ccResult?.confidenceScore,
      clearCapitalConfidenceScoreAlt: ccResult?.confidenceScoreAlt,
      clearCapitalEstimatedError: ccResult?.estimatedError,
      clearCapitalForecastStdDev: ccResult?.forecastStdDev,
      clearCapitalRunDate: ccResult?.runDate,
      clearCapitalEffectiveDate: candidate.effectiveDate,
      houseCanaryFsd: fsd,
      houseCanaryEstimate: hcEstimate,
      houseCanaryValue: hcValue,
      needsHuman: true,
    };
  }

  return {
    tier: 'verified',
    hcValue: candidate.value,
    statedValue,
    price_lwr: Math.round(ccResult?.lowValue || 0),
    price_upr: Math.round(ccResult?.highValue || 0),
    newMaxLoan: Math.round(candidate.maxLoan),
    maxLtv,
    desiredLoanAmount: desired,
    valuationProvider: 'clearcapital',
    cascadeDecision: 'use_clearcapital',
    clearCapitalConfidenceScore: ccResult?.confidenceScore,
    clearCapitalConfidenceScoreAlt: ccResult?.confidenceScoreAlt,
    clearCapitalEstimatedError: ccResult?.estimatedError,
    clearCapitalForecastStdDev: ccResult?.forecastStdDev,
    clearCapitalRunDate: ccResult?.runDate,
    clearCapitalEffectiveDate: candidate.effectiveDate,
    houseCanaryFsd: fsd,
    houseCanaryEstimate: hcEstimate,
    houseCanaryValue: hcValue,
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

    const auth = await getApplicationBySessionToken(sessionToken, 'id, session_expires_at, form_data');
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
      loanNumber,
    } = body;

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    if (!zipcode && !city) {
      return NextResponse.json({ error: 'Zipcode or city/state required' }, { status: 400 });
    }

    console.log('verify-value request received');

    const quotedInvestor = getQuotedInvestorContext(app as Record<string, unknown>);

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
      address,
      zipcode,
      city: city || null,
      state: state || null,
      endpoint_host: new URL(HC_BASE).hostname,
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
    await insertAvmProviderRun(supabase, estimateRunBase);

    let estimateData: HouseCanaryEstimateResponse | null = null;
    let hcEstimate: number | null = null;

    try {
      estimateData = await getPropertyEstimate(address, zipcode, city, state) as HouseCanaryEstimateResponse;
      hcEstimate = typeof estimateData?.estimate === 'number' ? estimateData.estimate : null;
      await updateAvmProviderRun(supabase, estimateRunId, {
        ...estimateRunBase,
        status: hcEstimate ? 'completed' : 'no_data',
        success: Boolean(hcEstimate),
        estimate_value: hcEstimate,
        response_bytes: JSON.stringify(estimateData).length,
        notes: hcEstimate ? 'HouseCanary estimate returned a value' : 'HouseCanary estimate returned no estimate value',
      });
    } catch (estimateError: any) {
      await updateAvmProviderRun(supabase, estimateRunId, {
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
        quotedInvestor,
        loanNumber: String(loanNumber || '').trim() || undefined,
      });

      if (ccFallback) {
        await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: ccFallback,
        }));
        return NextResponse.json(ccFallback);
      }

      const responsePayload = {
        tier: 'no_data',
        error: 'Unable to estimate property value',
        cascadeDecision: 'hc_failed_cc_unavailable_or_failed',
        needsHuman: true,
      };
      await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
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
        quotedInvestor,
        loanNumber: String(loanNumber || '').trim() || undefined,
      });

      if (ccFallback) {
        await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: ccFallback,
        }));
        return NextResponse.json(ccFallback);
      }

      const responsePayload = {
        tier: 'no_data',
        error: 'Unable to estimate property value',
        cascadeDecision: 'hc_no_data_cc_unavailable_or_failed',
        needsHuman: true,
      };
      await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
      return NextResponse.json(responsePayload);
    }

    const newMaxLoan = Math.max(0, (hcEstimate * maxLtv) - balance);
    const hcRatio = desired > 0 ? newMaxLoan / desired : 0;
    const useHouseCanaryEstimateOnly = hcRatio >= 0.8;
    const shouldCascadeToClearCapital = hcRatio >= 0.25 && hcRatio < 0.8 && newMaxLoan >= 50000;
    const shouldHardFail = hcRatio < 0.25 || newMaxLoan < 50000;

    console.log('verify-value decision after HouseCanary estimate', {
      useHouseCanaryEstimateOnly,
      shouldCascadeToClearCapital,
      shouldHardFail,
    });

    if (useHouseCanaryEstimateOnly) {
      console.log('verify-value continuing to HouseCanary full AVM to return FSD');
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
      await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
      return NextResponse.json(responsePayload);
    }

    if (!useHouseCanaryEstimateOnly && !shouldCascadeToClearCapital) {
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
      await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
      return NextResponse.json(responsePayload);
    }

    let clearCapitalCandidate: ClearCapitalCandidate | null = null;
    let clearCapitalInvestorEvaluation: ReturnType<typeof evaluateQuotedInvestorProvider> = null;
    let clearCapitalEligibleForQuotedInvestor = false;
    if (shouldCascadeToClearCapital) {
      clearCapitalCandidate = await runClearCapitalCandidate({
        supabase,
        applicationId,
        address,
        zipcode,
        city,
        state,
        balance,
        maxLtv,
        desired,
        triggerReason: 'housecanary_estimate_mid_band_skip_full_avm',
        loanNumber: String(loanNumber || '').trim() || undefined,
      });

      clearCapitalInvestorEvaluation = evaluateQuotedInvestorProvider(
        quotedInvestor,
        'Clear Capital',
        clearCapitalCandidate?.result?.forecastStdDev,
      );
      clearCapitalEligibleForQuotedInvestor = Boolean(clearCapitalCandidate?.eligible && (clearCapitalInvestorEvaluation?.passes ?? true));

      if (clearCapitalCandidate && clearCapitalEligibleForQuotedInvestor && clearCapitalCandidate.maxLoan >= newMaxLoan) {
        const responsePayload = {
          tier: 'verified',
          hcValue: clearCapitalCandidate.value,
          statedValue: numericStatedValue,
          price_lwr: Math.round(clearCapitalCandidate.result?.lowValue || 0),
          price_upr: Math.round(clearCapitalCandidate.result?.highValue || 0),
          newMaxLoan: Math.round(clearCapitalCandidate.maxLoan),
          maxLtv,
          desiredLoanAmount: desired,
          valuationProvider: 'clearcapital',
          cascadeDecision: 'use_clearcapital_before_hc_full_avm',
          clearCapitalConfidenceScore: clearCapitalCandidate.result?.confidenceScore,
          clearCapitalConfidenceScoreAlt: clearCapitalCandidate.result?.confidenceScoreAlt,
          clearCapitalEstimatedError: clearCapitalCandidate.result?.estimatedError,
          clearCapitalForecastStdDev: clearCapitalCandidate.result?.forecastStdDev,
          clearCapitalRunDate: clearCapitalCandidate.result?.runDate,
          clearCapitalEffectiveDate: clearCapitalCandidate.effectiveDate,
          houseCanaryEstimate: hcEstimate,
          quotedInvestor: quotedInvestor.quotedInvestor,
          quotedInvestorProviderEligible: clearCapitalInvestorEvaluation?.passes ?? null,
          quotedInvestorProviderReason: clearCapitalInvestorEvaluation?.reason ?? null,
        };
        await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
        return NextResponse.json(responsePayload);
      }
    }

    const valueRunId = randomUUID();
    const valueRunBase = {
      run_id: valueRunId,
      application_id: applicationId,
      provider: 'housecanary',
      product: 'property_value',
      address,
      zipcode,
      city: city || null,
      state: state || null,
      endpoint_host: new URL(HC_BASE).hostname,
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
    await insertAvmProviderRun(supabase, valueRunBase);

    let fsdData: HouseCanaryValueResult;
    try {
      fsdData = await getPropertyValueWithFSD(address, zipcode) as HouseCanaryValueResult;
      await updateAvmProviderRun(supabase, valueRunId, {
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
      await updateAvmProviderRun(supabase, valueRunId, {
        ...valueRunBase,
        status: 'failed',
        error_category: 'request_failed',
        notes: valueError instanceof Error ? valueError.message : 'HouseCanary full AVM request failed',
      });

      const ccFallback = clearCapitalCandidate && clearCapitalEligibleForQuotedInvestor
        ? {
            tier: 'verified',
            hcValue: clearCapitalCandidate.value,
            statedValue: numericStatedValue,
            price_lwr: Math.round(clearCapitalCandidate.result?.lowValue || 0),
            price_upr: Math.round(clearCapitalCandidate.result?.highValue || 0),
            newMaxLoan: Math.round(clearCapitalCandidate.maxLoan),
            maxLtv,
            desiredLoanAmount: desired,
            valuationProvider: 'clearcapital',
            cascadeDecision: 'use_clearcapital_after_hc_full_avm_failure',
            clearCapitalConfidenceScore: clearCapitalCandidate.result?.confidenceScore,
            clearCapitalConfidenceScoreAlt: clearCapitalCandidate.result?.confidenceScoreAlt,
            clearCapitalEstimatedError: clearCapitalCandidate.result?.estimatedError,
            clearCapitalForecastStdDev: clearCapitalCandidate.result?.forecastStdDev,
            clearCapitalRunDate: clearCapitalCandidate.result?.runDate,
            clearCapitalEffectiveDate: clearCapitalCandidate.effectiveDate,
            houseCanaryEstimate: hcEstimate,
          }
        : await tryClearCapitalFallback({
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
            quotedInvestor,
            loanNumber: String(loanNumber || '').trim() || undefined,
          });

      if (ccFallback) {
        await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: ccFallback,
        }));
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
      await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
      return NextResponse.json(responsePayload);
    }

    const verifiedValue = fsdData.price_mean;
    const verifiedMaxLoan = Math.max(0, (verifiedValue * maxLtv) - balance);
    const hcInvestorEvaluation = evaluateQuotedInvestorProvider(quotedInvestor, 'HouseCanary', fsdData.fsd);
    const hcVerifiedEligible = fsdData.fsd <= 0.20 && verifiedMaxLoan >= 50000 && (hcInvestorEvaluation?.passes ?? true);

    if (hcVerifiedEligible) {
      const bothBelowTargetAfterFullRuns = Boolean(
        clearCapitalCandidate
        && clearCapitalCandidate.belowTarget
        && !clearCapitalCandidate.belowFloor
        && desired > 0
        && verifiedMaxLoan / desired < 0.25
      );

      if (clearCapitalEligibleForQuotedInvestor || bothBelowTargetAfterFullRuns) {
        const ccCandidate = clearCapitalCandidate!;
        const useClearCapital = ccCandidate.maxLoan > verifiedMaxLoan;
        const responsePayload = useClearCapital
          ? {
              tier: 'verified',
              hcValue: ccCandidate.value,
              statedValue: numericStatedValue,
              price_lwr: Math.round(ccCandidate.result?.lowValue || 0),
              price_upr: Math.round(ccCandidate.result?.highValue || 0),
              newMaxLoan: Math.round(ccCandidate.maxLoan),
              maxLtv,
              desiredLoanAmount: desired,
              valuationProvider: 'clearcapital',
              cascadeDecision: 'use_higher_after_hc_full_avm_and_clearcapital',
              clearCapitalConfidenceScore: ccCandidate.result?.confidenceScore,
              clearCapitalConfidenceScoreAlt: ccCandidate.result?.confidenceScoreAlt,
              clearCapitalEstimatedError: ccCandidate.result?.estimatedError,
              clearCapitalForecastStdDev: ccCandidate.result?.forecastStdDev,
              clearCapitalRunDate: ccCandidate.result?.runDate,
              clearCapitalEffectiveDate: ccCandidate.effectiveDate,
              houseCanaryFsd: fsdData.fsd,
              houseCanaryEstimate: hcEstimate,
              houseCanaryValue: Math.round(verifiedValue),
              quotedInvestor: quotedInvestor.quotedInvestor,
              quotedInvestorProviderEligible: clearCapitalInvestorEvaluation?.passes ?? null,
              quotedInvestorProviderReason: clearCapitalInvestorEvaluation?.reason ?? null,
              houseCanaryQuotedInvestorEligible: hcInvestorEvaluation?.passes ?? null,
              houseCanaryQuotedInvestorReason: hcInvestorEvaluation?.reason ?? null,
            }
          : {
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
              cascadeDecision: 'use_higher_after_hc_full_avm_and_clearcapital',
              clearCapitalConfidenceScore: ccCandidate.result?.confidenceScore,
              clearCapitalConfidenceScoreAlt: ccCandidate.result?.confidenceScoreAlt,
              clearCapitalEstimatedError: ccCandidate.result?.estimatedError,
              clearCapitalForecastStdDev: ccCandidate.result?.forecastStdDev,
              clearCapitalRunDate: ccCandidate.result?.runDate,
              clearCapitalEffectiveDate: ccCandidate.effectiveDate,
              quotedInvestor: quotedInvestor.quotedInvestor,
              quotedInvestorProviderEligible: hcInvestorEvaluation?.passes ?? null,
              quotedInvestorProviderReason: hcInvestorEvaluation?.reason ?? null,
              houseCanaryQuotedInvestorEligible: hcInvestorEvaluation?.passes ?? null,
              houseCanaryQuotedInvestorReason: hcInvestorEvaluation?.reason ?? null,
            };
        await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
        return NextResponse.json(responsePayload);
      }

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
        quotedInvestor: quotedInvestor.quotedInvestor,
        quotedInvestorProviderEligible: hcInvestorEvaluation?.passes ?? null,
        quotedInvestorProviderReason: hcInvestorEvaluation?.reason ?? null,
        houseCanaryQuotedInvestorEligible: hcInvestorEvaluation?.passes ?? null,
        houseCanaryQuotedInvestorReason: hcInvestorEvaluation?.reason ?? null,
      };
      await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
      return NextResponse.json(responsePayload);
    }

    const ccFallback = clearCapitalCandidate && clearCapitalEligibleForQuotedInvestor
      ? {
          tier: 'verified',
          hcValue: clearCapitalCandidate.value,
          statedValue: numericStatedValue,
          price_lwr: Math.round(clearCapitalCandidate.result?.lowValue || 0),
          price_upr: Math.round(clearCapitalCandidate.result?.highValue || 0),
          newMaxLoan: Math.round(clearCapitalCandidate.maxLoan),
          maxLtv,
          desiredLoanAmount: desired,
          valuationProvider: 'clearcapital',
          cascadeDecision: 'use_clearcapital_after_hc_full_avm_low_confidence',
          clearCapitalConfidenceScore: clearCapitalCandidate.result?.confidenceScore,
          clearCapitalConfidenceScoreAlt: clearCapitalCandidate.result?.confidenceScoreAlt,
          clearCapitalEstimatedError: clearCapitalCandidate.result?.estimatedError,
          clearCapitalForecastStdDev: clearCapitalCandidate.result?.forecastStdDev,
          clearCapitalRunDate: clearCapitalCandidate.result?.runDate,
          clearCapitalEffectiveDate: clearCapitalCandidate.effectiveDate,
          houseCanaryFsd: fsdData.fsd,
          houseCanaryEstimate: hcEstimate,
          houseCanaryValue: Math.round(verifiedValue),
          quotedInvestor: quotedInvestor.quotedInvestor,
          quotedInvestorProviderEligible: clearCapitalInvestorEvaluation?.passes ?? null,
          quotedInvestorProviderReason: clearCapitalInvestorEvaluation?.reason ?? null,
          houseCanaryQuotedInvestorEligible: hcInvestorEvaluation?.passes ?? null,
          houseCanaryQuotedInvestorReason: hcInvestorEvaluation?.reason ?? null,
        }
      : await tryClearCapitalFallback({
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
          quotedInvestor,
          loanNumber: String(loanNumber || '').trim() || undefined,
        });

    if (ccFallback) {
      await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: ccFallback,
        }));
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
      quotedInvestor: quotedInvestor.quotedInvestor,
      quotedInvestorProviderEligible: hcInvestorEvaluation?.passes ?? null,
      quotedInvestorProviderReason: hcInvestorEvaluation?.reason ?? null,
      houseCanaryQuotedInvestorEligible: hcInvestorEvaluation?.passes ?? null,
      houseCanaryQuotedInvestorReason: hcInvestorEvaluation?.reason ?? null,
    };
    await saveCachedAvmResult(supabase, buildCachedAvmPayload({
          addressKey,
          address,
          zipcode,
          city,
          state,
          applicationId,
          maxLtv,
          responsePayload: responsePayload,
        }));
    return NextResponse.json(responsePayload);
  } catch (err: any) {
    console.error('Verify value error');
    return NextResponse.json(
      { error: 'Verification failed', tier: 'error' },
      { status: 500 }
    );
  }
}
