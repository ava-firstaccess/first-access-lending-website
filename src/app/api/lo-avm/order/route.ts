import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildLoanOfficerPortalUnauthorizedResponse, getLoanOfficerPortalSessionFromRequest } from '@/lib/lo-portal-auth';
import { chooseHouseCanaryOrderProduct } from '@/lib/housecanary-billing';
import { getInvestorAvmRule, getInvestorAvmRules, type AvmProviderName, type InvestorName } from '@/lib/rates/investor-confidence-rules';
import { getSupabaseAdmin } from '@/lib/supabase';

const LO_AVM_CACHE_WINDOW_DAYS = 90;
const HOUSECANARY_API_BASE = 'https://api.housecanary.com';
const HOUSECANARY_ORDER_MANAGER_BASE = 'https://order-manager-api.housecanary.com/client-api/v1';

const KNOWN_PROVIDERS: AvmProviderName[] = [
  'HouseCanary',
  'Clear Capital',
  'Veros',
  'CA Value',
  'Black Knight (Valusure)',
  'CoreLogic',
  'Red Bell',
  'Home Genius',
];

const HOUSECANARY_CYCLE_FIELDS = [
  'housecanary_billing_cycle_start',
  'housecanary_billing_cycle_end',
  'housecanary_order_product',
  'housecanary_product_sequence_number',
  'housecanary_overall_sequence_number',
  'housecanary_free_tier_applied',
] as const;

const FSD_THRESHOLD_FIELDS = [
  'requested_max_fsd',
  'fsd_threshold_status',
  'fsd_threshold_passed',
] as const;

type LoanOfficerAvmRequestBody = {
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  loanNumber?: string;
  investor?: string;
  engine?: string;
  program?: string;
  product?: string;
};

type HouseCanaryValueResult = {
  value: number;
  fsd: number | null;
  lowValue: number | null;
  highValue: number | null;
};

type ProviderRow = {
  provider: AvmProviderName;
  supported: boolean;
  maxFsdAllowed: number | null;
  date: string | null;
  fsd: number | null;
  fsdLabel?: string | null;
  value: number | null;
  reportLink: string | null;
  source: 'cache' | 'fresh' | null;
  orderStatus: string | null;
  orderRunId: string | null;
  providerProduct: string | null;
  failureMessage?: string | null;
  requestedMaxFsd?: number | null;
  fsdThresholdStatus?: 'pending' | 'passed' | 'failed' | null;
  targetedInvestor?: string | null;
};

type ClearCapitalOrderResult = {
  raw: any;
  trackingId: string;
  value: number | null;
  fsd: number | null;
  lowValue: number | null;
  highValue: number | null;
  externalOrderId: string | null;
  effectiveDate: string | null;
  confidenceScore: string | null;
  confidenceScoreAlt: string | null;
  estimatedError: number | null;
  runDate: string | null;
  thresholdFailure?: boolean;
  errorMessage?: string | null;
};

function mapInvestorLabelToRuleInvestor(investorLabel: string | null | undefined): InvestorName | null {
  if (!investorLabel) return null;
  if (investorLabel === 'OSB' || investorLabel === 'Onslow') return 'Onslow';
  if (investorLabel === 'Arc Home' || investorLabel === 'Arc') return 'Arc';
  if (investorLabel === 'Deephaven' || investorLabel === 'DeepHaven') return 'DeepHaven';
  if (investorLabel === 'Button' || investorLabel === 'Vista' || investorLabel === 'NewRez' || investorLabel === 'Verus' || investorLabel === 'SG Capital' || investorLabel === 'NQM Capital') return investorLabel;
  return null;
}

function normalizeText(value: string | undefined | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStreetAddress(value: string | undefined | null) {
  return normalizeText(value)
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bterrace\b/g, 'ter')
    .replace(/\bparkway\b/g, 'pkwy')
    .replace(/\bhighway\b/g, 'hwy')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildAddressId(address: string, city?: string, state?: string, zipcode?: string) {
  return [normalizeStreetAddress(address), city, state, zipcode].map(normalizeText).join('|');
}

function toIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDisplayDate(value: string | null | undefined) {
  const iso = toIsoDate(value);
  return iso ? iso.slice(0, 10) : null;
}

function getSupabaseErrorText(error: any) {
  return [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(' | ')
    .toLowerCase();
}

function isMissingColumnError(error: any, columns: readonly string[]) {
  const text = getSupabaseErrorText(error);
  if (!text) return false;
  return columns.some((column) => text.includes(column.toLowerCase()))
    || text.includes('could not find the')
    || text.includes('schema cache')
    || text.includes('does not exist');
}

function omitFields<T extends Record<string, any>>(payload: T, fields: readonly string[]) {
  const next = { ...payload };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}

async function insertLoanOfficerAvmOrder(supabase: ReturnType<typeof getSupabaseAdmin>, payload: Record<string, any>) {
  const candidates = [
    payload,
    omitFields(payload, HOUSECANARY_CYCLE_FIELDS),
    omitFields(payload, FSD_THRESHOLD_FIELDS),
    omitFields(omitFields(payload, HOUSECANARY_CYCLE_FIELDS), FSD_THRESHOLD_FIELDS),
  ];

  let lastError: any = null;
  const attempted = new Set<string>();

  for (const candidate of candidates) {
    const signature = JSON.stringify(Object.keys(candidate).sort());
    if (attempted.has(signature)) continue;
    attempted.add(signature);

    const { data, error } = await supabase.from('loan_officer_avm_orders').insert(candidate).select('*').single();
    if (!error) return data;

    lastError = error;
    const maybeMissingOptionalColumns = isMissingColumnError(error, HOUSECANARY_CYCLE_FIELDS)
      || isMissingColumnError(error, FSD_THRESHOLD_FIELDS);
    if (!maybeMissingOptionalColumns) break;
  }

  throw lastError;
}

async function recordFailedLoanOfficerAvmOrder(supabase: ReturnType<typeof getSupabaseAdmin>, payload: Record<string, any>) {
  try {
    return await insertLoanOfficerAvmOrder(supabase, payload);
  } catch (error) {
    console.error('Failed to record LO AVM failed attempt:', error);
    return null;
  }
}

function readHouseCanaryBasicAuth() {
  const key = process.env.HOUSECANARY_API_KEY;
  const secret = process.env.HOUSECANARY_API_SECRET;
  if (!key || !secret) throw new Error('HouseCanary Property Explorer credentials are not configured.');
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

function readHouseCanaryOrderManagerAuth() {
  return readHouseCanaryBasicAuth();
}

function getClearCapitalConfig() {
  const apiKey = process.env.CLEARCAPITAL_PAA_API_KEY;
  const baseUrl = process.env.CLEARCAPITAL_PAA_BASE_URL || 'https://api.clearcapital.com/property-analytics-api';
  if (!apiKey) throw new Error('Clear Capital Property Analytics credentials are not configured.');
  return { apiKey, baseUrl };
}

async function getHouseCanaryPropertyExplorerStaticLink(address: string, zipcode: string) {
  const params = new URLSearchParams({
    address,
    zipcode,
    allowLimitedReports: 'false',
    enforceStrictGeoPrecision: 'true',
  });

  const res = await fetch(`${HOUSECANARY_API_BASE}/v3/property/pexp_static_link?${params.toString()}`, {
    headers: { Authorization: readHouseCanaryBasicAuth() },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`HouseCanary Property Explorer failed (${res.status})`);
  }

  const data = await res.json();
  const link = data?.['property/pexp_static_link']?.result?.link || data?.property?.pexp_static_link?.result?.link || null;
  if (!link) throw new Error('HouseCanary Property Explorer returned no report link.');
  return { link, raw: data };
}

async function getHouseCanaryValueWithFsd(address: string, zipcode: string): Promise<HouseCanaryValueResult> {
  const url = `${HOUSECANARY_API_BASE}/v2/property/value?address=${encodeURIComponent(address)}&zipcode=${encodeURIComponent(zipcode)}`;
  const res = await fetch(url, {
    headers: { Authorization: readHouseCanaryBasicAuth() },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`HouseCanary value lookup failed (${res.status})`);
  }

  const data = await res.json();
  const result = Array.isArray(data) ? data[0] : data;
  const valueData = result?.['property/value']?.result?.value;
  if (!valueData?.price_mean) throw new Error('HouseCanary value lookup returned no value.');

  return {
    value: Math.round(Number(valueData.price_mean || 0)),
    fsd: typeof valueData.fsd === 'number' ? valueData.fsd : null,
    lowValue: typeof valueData.price_lwr === 'number' ? Math.round(valueData.price_lwr) : null,
    highValue: typeof valueData.price_upr === 'number' ? Math.round(valueData.price_upr) : null,
  };
}

async function createHouseCanaryAgileInsightsOrder({
  address,
  city,
  state,
  zipcode,
  customerOrderId,
  customerItemId,
}: {
  address: string;
  city?: string;
  state?: string;
  zipcode: string;
  customerOrderId: string;
  customerItemId: string;
}) {
  const res = await fetch(`${process.env.HOUSECANARY_ORDER_MANAGER_BASE_URL || HOUSECANARY_ORDER_MANAGER_BASE}/orders/json/`, {
    method: 'POST',
    headers: {
      Authorization: readHouseCanaryOrderManagerAuth(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      order_type: 'valueReport',
      name: `LO AVM ${address}`,
      customer_order_id: customerOrderId,
      items: [
        {
          customer_item_id: customerItemId,
          address,
          zipcode,
          ...(city ? { city } : {}),
          ...(state ? { state } : {}),
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`HouseCanary Agile Insights order failed (${res.status})`);
  }

  const data = await res.json();
  const externalOrderId = data?.id || data?.order_id || data?.order?.id || null;
  const externalItemId = data?.items?.[0]?.id || data?.order_items?.[0]?.id || null;
  return { raw: data, externalOrderId, externalItemId };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(/[$,%\s,]/g, '').trim();
      if (!normalized) continue;
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

async function getHouseCanaryOrder(orderId: string) {
  const res = await fetch(`${process.env.HOUSECANARY_ORDER_MANAGER_BASE_URL || HOUSECANARY_ORDER_MANAGER_BASE}/orders/${orderId}/`, {
    headers: {
      Authorization: readHouseCanaryOrderManagerAuth(),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`HouseCanary Agile Insights get order failed (${res.status})`);
  }

  return res.json();
}

async function listHouseCanaryOrderItems(orderId: string) {
  const res = await fetch(`${process.env.HOUSECANARY_ORDER_MANAGER_BASE_URL || HOUSECANARY_ORDER_MANAGER_BASE}/orders/${orderId}/items/`, {
    headers: {
      Authorization: readHouseCanaryOrderManagerAuth(),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`HouseCanary Agile Insights list order items failed (${res.status})`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function getHouseCanaryItemStatus(status: string | null | undefined) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'complete') return 'completed';
  if (normalized === 'cancelled') return 'failed';
  if (normalized === 'reportpending' || normalized === 'accepted' || normalized === 'new') return 'processing';
  return 'submitted';
}

async function fetchHouseCanaryAgileInsightsSnapshot(orderId: string, externalItemId?: string | null) {
  const [order, items] = await Promise.all([
    getHouseCanaryOrder(orderId),
    listHouseCanaryOrderItems(orderId),
  ]);

  const selectedItem = items.find((item: any) => String(item?.id || '') === String(externalItemId || '')) || items[0] || null;
  const estimatedValue = firstNumber(
    selectedItem?.estimated_value,
    selectedItem?.estimatedValue,
    selectedItem?.result?.estimated_value,
    selectedItem?.result?.estimatedValue,
    order?.estimated_value,
    order?.estimatedValue,
    order?.result?.estimated_value,
    order?.result?.estimatedValue,
  );
  const fsd = firstNumber(
    selectedItem?.fsd,
    selectedItem?.forecast_std_dev,
    selectedItem?.forecastStdDev,
    selectedItem?.result?.fsd,
    selectedItem?.result?.forecast_std_dev,
    selectedItem?.result?.forecastStdDev,
    order?.fsd,
    order?.forecast_std_dev,
    order?.forecastStdDev,
  );
  const valueRange = firstString(
    selectedItem?.value_range,
    selectedItem?.valueRange,
    selectedItem?.result?.value_range,
    selectedItem?.result?.valueRange,
    order?.value_range,
    order?.valueRange,
    order?.result?.value_range,
    order?.result?.valueRange,
  );
  const pdfType = selectedItem?.available_downloadables?.[0]?.key || null;

  return {
    order,
    items,
    externalItemId: selectedItem?.id || externalItemId || null,
    status: firstString(selectedItem?.status, order?.status),
    value: estimatedValue !== null ? Math.round(estimatedValue) : null,
    fsd,
    valueRange,
    completedAt: firstString(selectedItem?.completion_date, order?.actual_delivery_date),
    pdfType,
    fsdThreshold: firstNumber(order?.fsd_threshold, selectedItem?.fsd_threshold),
  };
}

async function refreshHouseCanaryAgileInsightsOrder(supabase: ReturnType<typeof getSupabaseAdmin>, order: any) {
  if (order?.provider !== 'housecanary' || order?.provider_product !== 'agile_insights' || !order?.external_order_id) {
    return order;
  }

  const snapshot = await fetchHouseCanaryAgileInsightsSnapshot(String(order.external_order_id), order.external_item_id || null);
  const requestedMaxFsd = typeof order?.requested_max_fsd === 'number' ? order.requested_max_fsd : null;
  const fsdThresholdStatus = requestedMaxFsd !== null && snapshot.fsd !== null
    ? (snapshot.fsd <= requestedMaxFsd + 0.0001 ? 'passed' : 'failed')
    : order?.fsd_threshold_status || null;
  const nextOrderStatus = getHouseCanaryItemStatus(snapshot.status);
  const nextPayload = {
    ...(order?.response_payload || {}),
    value: snapshot.value,
    fsd: snapshot.fsd,
    valueRange: snapshot.valueRange,
    pdfType: snapshot.pdfType,
    fsdThresholdEcho: snapshot.fsdThreshold,
    agileInsightsOrderResponse: snapshot.order,
    agileInsightsItemsResponse: snapshot.items,
  };

  const updatePayload = {
    external_item_id: snapshot.externalItemId,
    order_status: nextOrderStatus,
    completed_at: nextOrderStatus === 'completed' ? (toIsoDate(snapshot.completedAt) || new Date().toISOString()) : null,
    response_payload: nextPayload,
    fsd_threshold_status: fsdThresholdStatus,
    fsd_threshold_passed: fsdThresholdStatus === 'passed' ? true : fsdThresholdStatus === 'failed' ? false : null,
  };

  const candidates = [
    updatePayload,
    omitFields(updatePayload, FSD_THRESHOLD_FIELDS),
  ];

  let lastError: any = null;
  const attempted = new Set<string>();

  for (const candidate of candidates) {
    const signature = JSON.stringify(Object.keys(candidate).sort());
    if (attempted.has(signature)) continue;
    attempted.add(signature);

    const { data, error } = await supabase
      .from('loan_officer_avm_orders')
      .update(candidate)
      .eq('id', order.id)
      .select('*')
      .single();

    if (!error) return data;
    lastError = error;
    if (!isMissingColumnError(error, FSD_THRESHOLD_FIELDS)) break;
  }

  throw new Error(`Failed to refresh Agile Insights order: ${lastError?.message || 'unknown error'}`);
}

async function pollHouseCanaryAgileInsightsOrder(supabase: ReturnType<typeof getSupabaseAdmin>, order: any, attempts = 4, delayMs = 1500) {
  let current = order;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    current = await refreshHouseCanaryAgileInsightsOrder(supabase, current);
    if (current?.order_status === 'completed' || current?.order_status === 'failed') {
      return current;
    }
    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }
  return current;
}

async function createClearCapitalOrder({
  address,
  city,
  state,
  zipcode,
  trackingId,
  maxFsd,
}: {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  trackingId: string;
  maxFsd: number;
}): Promise<ClearCapitalOrderResult> {
  const config = getClearCapitalConfig();
  const payload = {
    address,
    city,
    state,
    zip: zipcode,
    signResponse: true,
    trackingIds: [trackingId],
    clearAvm: {
      include: true,
      required: false,
      request: {
        maxFSD: Number(maxFsd.toFixed(2)),
        exactEffectiveDate: false,
      },
    },
  };

  const res = await fetch(`${config.baseUrl}/orders`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`Clear Capital Property Analytics failed (${res.status})`);
  }

  const result = data?.clearAvm?.result;
  const errorMessage = typeof data?.errorMessage === 'string' ? data.errorMessage : null;
  if (!result?.marketValue) {
    if (errorMessage && errorMessage.toLowerCase().includes('supplied thresholds')) {
      return {
        raw: data,
        trackingId,
        value: null,
        fsd: null,
        lowValue: null,
        highValue: null,
        externalOrderId: data?.id || null,
        effectiveDate: typeof data?.effectiveDate === 'string' ? data.effectiveDate : null,
        confidenceScore: null,
        confidenceScoreAlt: null,
        estimatedError: null,
        runDate: null,
        thresholdFailure: true,
        errorMessage,
      };
    }
    throw new Error('Clear Capital returned no market value.');
  }

  return {
    raw: data,
    trackingId,
    value: Math.round(Number(result.marketValue || 0)),
    fsd: typeof result.forecastStdDev === 'number' ? result.forecastStdDev : null,
    lowValue: typeof result.lowValue === 'number' ? Math.round(result.lowValue) : null,
    highValue: typeof result.highValue === 'number' ? Math.round(result.highValue) : null,
    externalOrderId: data?.id || null,
    effectiveDate: typeof data?.effectiveDate === 'string' ? data.effectiveDate : null,
    confidenceScore: result?.confidenceScore || null,
    confidenceScoreAlt: result?.confidenceScoreAlt || null,
    estimatedError: typeof result?.estimatedError === 'number' ? result.estimatedError : null,
    runDate: result?.runDate || null,
    thresholdFailure: false,
    errorMessage,
  };
}

async function sendLoanOfficerReportEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'First Access Lending <noreply@firstaccesslending.com>',
      to: [to],
      subject,
      html,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Report email failed (${res.status})`);
  }

  return res.json();
}

function buildHouseCanaryEmailHtml({ address, investor, link }: { address: string; investor: string; link: string }) {
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;">HouseCanary Property Explorer report ready</h2>
      <p style="margin:0 0 10px;">Your AVM order is ready for <strong>${address}</strong>.</p>
      <p style="margin:0 0 10px;">Investor: <strong>${investor}</strong></p>
      <p style="margin:0 0 18px;"><a href="${link}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">Open report</a></p>
      <p style="margin:0;color:#475569;font-size:12px;">This link was generated from the Loan Officer AVM workspace.</p>
    </div>
  `;
}

async function loadRecentOrders(supabase: ReturnType<typeof getSupabaseAdmin>, addressId: string) {
  const cutoffIso = new Date(Date.now() - LO_AVM_CACHE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('loan_officer_avm_orders')
    .select('*')
    .eq('address_id', addressId)
    .gte('created_at', cutoffIso)
    .in('order_status', ['submitted', 'processing', 'completed'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Recent order lookup failed: ${error.message}`);
  return Array.isArray(data) ? data : [];
}

async function loadRecentAvmCache(supabase: ReturnType<typeof getSupabaseAdmin>, {
  address,
  city,
  state,
  zipcode,
}: {
  address: string;
  city?: string;
  state?: string;
  zipcode: string;
}) {
  const cutoffIso = new Date(Date.now() - LO_AVM_CACHE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('avm_cache')
    .select('created_at, address, city, state, zipcode, final_provider, final_value, final_fsd, final_new_max_loan, response_payload')
    .eq('zipcode', zipcode)
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(`avm_cache lookup failed: ${error.message}`);

  const targetAddress = normalizeStreetAddress(address);
  const targetCity = normalizeText(city);
  const targetState = normalizeText(state);

  return (data || []).find((row: any) => {
    const rowAddress = normalizeStreetAddress(row.address);
    const addressMatches = rowAddress === targetAddress
      || rowAddress.startsWith(targetAddress)
      || targetAddress.startsWith(rowAddress);
    return addressMatches
      && normalizeText(row.city) === targetCity
      && normalizeText(row.state) === targetState;
  }) || null;
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

function parseOrderValue(order: any) {
  const payload = order?.response_payload || {};
  return typeof payload?.value === 'number'
    ? payload.value
    : typeof payload?.hcValue === 'number'
      ? payload.hcValue
      : typeof payload?.marketValue === 'number'
        ? payload.marketValue
        : null;
}

function parseOrderFsd(order: any) {
  const payload = order?.response_payload || {};
  return typeof payload?.fsd === 'number'
    ? payload.fsd
    : typeof payload?.forecastStdDev === 'number'
      ? payload.forecastStdDev
      : null;
}

function parseOrderLink(order: any) {
  const payload = order?.response_payload || {};
  return typeof payload?.reportLink === 'string' ? payload.reportLink : null;
}

function mapCachedProviderToRuleProvider(value: string | null | undefined): AvmProviderName | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'housecanary' || normalized === 'housecanary_estimate') return 'HouseCanary';
  if (normalized === 'clearcapital') return 'Clear Capital';
  if (normalized === 'veros') return 'Veros';
  if (normalized === 'ca value' || normalized === 'cavalue') return 'CA Value';
  if (normalized === 'black knight (valusure)' || normalized === 'blackknight') return 'Black Knight (Valusure)';
  return null;
}

function buildProviderRowsFromOrders(orders: any[], investor: InvestorName | null, source: 'cache' | 'fresh'): ProviderRow[] {
  const latestByProvider = new Map<string, any>();
  for (const order of orders) {
    const providerName = order?.provider === 'housecanary'
      ? 'HouseCanary'
      : order?.provider === 'clearcapital'
        ? 'Clear Capital'
        : null;
    if (!providerName || latestByProvider.has(providerName)) continue;
    latestByProvider.set(providerName, order);
  }

  return KNOWN_PROVIDERS.map((provider) => {
    const rule = investor ? getInvestorAvmRule(investor, provider) : null;
    const order = latestByProvider.get(provider) || null;

    return {
      provider,
      supported: Boolean(rule?.supported),
      maxFsdAllowed: rule?.maxFsdAllowed ?? null,
      date: order ? formatDisplayDate(order.ordered_at || order.created_at) : null,
      fsd: order ? parseOrderFsd(order) : null,
      value: order ? parseOrderValue(order) : null,
      reportLink: order ? parseOrderLink(order) : null,
      source: order ? source : null,
      orderStatus: order?.order_status || null,
      orderRunId: order?.order_run_id || null,
      providerProduct: order?.provider_product || null,
      fsdLabel: order?.response_payload?.fsdLabel || null,
      failureMessage: order?.response_payload?.errorMessage || null,
      requestedMaxFsd: typeof order?.requested_max_fsd === 'number'
        ? order.requested_max_fsd
        : typeof order?.response_payload?.requestedMaxFsd === 'number'
          ? order.response_payload.requestedMaxFsd
          : null,
      fsdThresholdStatus: order?.fsd_threshold_status === 'pending' || order?.fsd_threshold_status === 'passed' || order?.fsd_threshold_status === 'failed'
        ? order.fsd_threshold_status
        : order?.response_payload?.fsdThresholdStatus === 'pending' || order?.response_payload?.fsdThresholdStatus === 'passed' || order?.response_payload?.fsdThresholdStatus === 'failed'
          ? order.response_payload.fsdThresholdStatus
          : null,
      targetedInvestor: order?.investor || null,
    };
  });
}

function buildProviderRowsFromAvmCache(cached: any, investor: InvestorName | null): ProviderRow[] {
  const provider = mapCachedProviderToRuleProvider(cached?.final_provider || cached?.response_payload?.valuationProvider);
  const value = typeof cached?.final_value === 'number'
    ? cached.final_value
    : typeof cached?.response_payload?.hcValue === 'number'
      ? cached.response_payload.hcValue
      : null;
  const fsd = typeof cached?.final_fsd === 'number'
    ? cached.final_fsd
    : typeof cached?.response_payload?.fsd === 'number'
      ? cached.response_payload.fsd
      : typeof cached?.response_payload?.clearCapitalForecastStdDev === 'number'
        ? cached.response_payload.clearCapitalForecastStdDev
        : null;
  const reportLink = typeof cached?.response_payload?.reportLink === 'string'
    ? cached.response_payload.reportLink
    : typeof cached?.response_payload?.['property/pexp_static_link']?.result?.link === 'string'
      ? cached.response_payload['property/pexp_static_link'].result.link
      : null;

  return KNOWN_PROVIDERS.map((rowProvider) => {
    const rule = investor ? getInvestorAvmRule(investor, rowProvider) : null;
    const isMatch = provider === rowProvider;
    return {
      provider: rowProvider,
      supported: Boolean(rule?.supported),
      maxFsdAllowed: rule?.maxFsdAllowed ?? null,
      date: isMatch ? formatDisplayDate(cached?.created_at) : null,
      fsd: isMatch ? fsd : null,
      value: isMatch ? value : null,
      reportLink: isMatch ? reportLink : null,
      source: isMatch ? 'cache' : null,
      orderStatus: isMatch ? 'completed' : null,
      orderRunId: null,
      providerProduct: isMatch ? String(cached?.response_payload?.valuationProvider || cached?.final_provider || '').trim() || null : null,
      fsdLabel: null,
      failureMessage: null,
      requestedMaxFsd: null,
      fsdThresholdStatus: null,
      targetedInvestor: null,
    };
  });
}

function providerRowHasData(row: ProviderRow | null | undefined) {
  if (!row) return false;
  return row.value !== null
    || row.fsd !== null
    || row.reportLink !== null
    || row.orderStatus !== null
    || row.failureMessage !== null
    || row.source !== null;
}

function mergeProviderRows(...rowSets: ProviderRow[][]) {
  return KNOWN_PROVIDERS.map((provider) => {
    const candidates = rowSets
      .map((rows) => rows.find((row) => row.provider === provider) || null)
      .filter(Boolean) as ProviderRow[];

    const preferred = candidates.find((row) => providerRowHasData(row)) || candidates[0];
    return preferred || {
      provider,
      supported: false,
      maxFsdAllowed: null,
      date: null,
      fsd: null,
      value: null,
      reportLink: null,
      source: null,
      orderStatus: null,
      orderRunId: null,
      providerProduct: null,
      failureMessage: null,
      requestedMaxFsd: null,
      fsdThresholdStatus: null,
      targetedInvestor: null,
    };
  });
}

function providerRowSatisfiesSelectedInvestor(row: ProviderRow | null | undefined) {
  if (!row?.supported) return false;
  if (row.orderStatus !== 'completed') return false;
  if (row.value === null) return false;
  if (row.fsdLabel) return false;
  if (row.maxFsdAllowed !== null && row.fsd !== null && row.fsd > row.maxFsdAllowed + 0.0001) return false;
  return true;
}

function providerRowIsInFlightForSelectedInvestor(row: ProviderRow | null | undefined) {
  if (!row?.supported) return false;
  return row.orderStatus === 'submitted' || row.orderStatus === 'processing';
}

function chooseWinnerProvider(rows: ProviderRow[]) {
  return rows.find((row) => row.supported && row.value !== null)?.provider || rows.find((row) => row.value !== null)?.provider || null;
}

export async function POST(req: NextRequest) {
  try {
    const session = getLoanOfficerPortalSessionFromRequest(req);
    if (!session) return buildLoanOfficerPortalUnauthorizedResponse();

    const body = await req.json() as LoanOfficerAvmRequestBody;
    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    const zipcode = String(body.zipcode || '').trim();
    const loanNumber = String(body.loanNumber || '').trim();
    const investorLabel = String(body.investor || '').trim();
    const engine = String(body.engine || '').trim() || null;
    const program = String(body.program || '').trim() || null;
    const product = String(body.product || '').trim() || null;

    if (!address || !zipcode || !investorLabel || !loanNumber) {
      return NextResponse.json({ error: 'Address, zipcode, investor, and loan number or phone number are required.' }, { status: 400 });
    }

    const investor = mapInvestorLabelToRuleInvestor(investorLabel);
    if (!investor) {
      return NextResponse.json({ error: `Unsupported investor for AVM ordering: ${investorLabel}` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const addressId = buildAddressId(address, city, state, zipcode);
    const cachedOrders = await loadRecentOrders(supabase, addressId);
    const refreshedCachedOrders = cachedOrders.length > 0
      ? await Promise.all(cachedOrders.map(async (order) => {
        if (order?.provider === 'housecanary' && order?.provider_product === 'agile_insights' && order?.external_order_id && order?.order_status !== 'completed' && order?.order_status !== 'failed') {
          try {
            return await refreshHouseCanaryAgileInsightsOrder(supabase, order);
          } catch (refreshError) {
            console.error('Agile Insights cache refresh failed:', refreshError);
          }
        }
        return order;
      }))
      : [];
    const cachedOrderRows = buildProviderRowsFromOrders(refreshedCachedOrders, investor, 'cache');

    const cachedAvm = await loadRecentAvmCache(supabase, { address, city, state, zipcode });
    const cachedAvmRows = cachedAvm ? buildProviderRowsFromAvmCache(cachedAvm, investor) : buildProviderRowsFromAvmCache(null, investor);
    const availableProviderRows = mergeProviderRows(cachedOrderRows, cachedAvmRows);
    const selectedInvestorSatisfied = availableProviderRows.some((row) => providerRowSatisfiesSelectedInvestor(row));
    const selectedInvestorInFlight = availableProviderRows.some((row) => providerRowIsInFlightForSelectedInvestor(row));

    if (selectedInvestorSatisfied || selectedInvestorInFlight) {
      const latestOrderedAt = refreshedCachedOrders[0]?.ordered_at || refreshedCachedOrders[0]?.created_at || cachedAvm?.created_at || null;
      const message = selectedInvestorSatisfied
        ? 'Loaded available cached AVMs. No new vendor order was placed because the selected investor already has a usable result.'
        : 'Loaded available cached AVMs. No new vendor order was placed because a supported AVM order is already in progress for the selected investor.';
      return NextResponse.json({
        cacheHit: true,
        addressId,
        cacheWindowDays: LO_AVM_CACHE_WINDOW_DAYS,
        investor: investorLabel,
        providerRows: availableProviderRows,
        winnerProvider: chooseWinnerProvider(availableProviderRows),
        latestOrderedAt,
        message,
      });
    }

    const hcRule = getInvestorAvmRule(investor, 'HouseCanary');
    const ccRule = getInvestorAvmRule(investor, 'Clear Capital');
    const orderRunId = randomUUID();
    const orderedAt = new Date().toISOString();

    let insertedOrder: any = null;

    if (hcRule?.supported) {
      const emptyUsage = { propertyExplorerOrders: 0, agileInsightsOrders: 0 };
      const initialAllocation = chooseHouseCanaryOrderProduct(emptyUsage, new Date(orderedAt));
      const usage = await countHouseCanaryCycleUsage(supabase, initialAllocation.cycle.cycleStart, initialAllocation.cycle.cycleEnd);
      const allocation = chooseHouseCanaryOrderProduct(usage, new Date(orderedAt));

      if (allocation.selectedProduct === 'property_explorer') {
        const requestedMaxFsd = hcRule.maxFsdAllowed ?? null;
        const baseInsertPayload = {
          order_run_id: orderRunId,
          address_id: addressId,
          loan_officer_prefix: session.prefix,
          loan_officer_email: session.email,
          loan_number: loanNumber || null,
          investor: investorLabel,
          engine,
          program,
          product,
          provider: 'housecanary',
          provider_product: 'pexp_static_link',
          external_order_id: null,
          external_item_id: null,
          external_tracking_id: loanNumber || null,
          address,
          city: city || null,
          state: state || null,
          zipcode,
          ordered_at: orderedAt,
          request_payload: {
            address,
            zipcode,
            investor: investorLabel,
            customer_order_id: loanNumber || null,
            requestedMaxFsd,
          },
          requested_max_fsd: requestedMaxFsd,
          notes: `Property Explorer order ${allocation.overallSequenceNumber} in ${allocation.cycle.label}`,
          housecanary_billing_cycle_start: allocation.cycle.cycleStart,
          housecanary_billing_cycle_end: allocation.cycle.cycleEnd,
          housecanary_order_product: allocation.selectedProduct,
          housecanary_product_sequence_number: allocation.productSequenceNumber,
          housecanary_overall_sequence_number: allocation.overallSequenceNumber,
          housecanary_free_tier_applied: allocation.isFreeTier,
        };

        let pexp: any;
        let hcValue: any;
        try {
          [pexp, hcValue] = await Promise.all([
            getHouseCanaryPropertyExplorerStaticLink(address, zipcode),
            getHouseCanaryValueWithFsd(address, zipcode),
          ]);
        } catch (providerError: any) {
          await recordFailedLoanOfficerAvmOrder(supabase, {
            ...baseInsertPayload,
            order_status: 'failed',
            response_payload: {
              errorMessage: providerError?.message || 'HouseCanary Property Explorer order failed.',
              requestedMaxFsd,
              housecanaryOrderProduct: allocation.selectedProduct,
            },
            fsd_threshold_status: 'pending',
            fsd_threshold_passed: null,
          });
          throw providerError;
        }

        const fsdThresholdStatus = requestedMaxFsd !== null && hcValue.fsd !== null
          ? (hcValue.fsd <= requestedMaxFsd + 0.0001 ? 'passed' : 'failed')
          : null;

        const responsePayload = {
          reportLink: pexp.link,
          value: hcValue.value,
          fsd: hcValue.fsd,
          lowValue: hcValue.lowValue,
          highValue: hcValue.highValue,
          requestedMaxFsd,
          fsdThresholdStatus,
          housecanaryOrderProduct: allocation.selectedProduct,
          housecanaryPropertyExplorerResponse: pexp.raw,
        };

        const insertPayload = {
          ...baseInsertPayload,
          order_status: 'completed',
          completed_at: orderedAt,
          response_payload: responsePayload,
          fsd_threshold_status: fsdThresholdStatus,
          fsd_threshold_passed: fsdThresholdStatus === 'passed' ? true : fsdThresholdStatus === 'failed' ? false : null,
        };

        try {
          insertedOrder = await insertLoanOfficerAvmOrder(supabase, insertPayload);
        } catch (error: any) {
          throw new Error(`Failed to save HouseCanary order: ${error?.message || 'unknown error'}`);
        }

        try {
          await sendLoanOfficerReportEmail({
            to: session.email,
            subject: `HouseCanary report ready for ${address}`,
            html: buildHouseCanaryEmailHtml({ address, investor: investorLabel, link: pexp.link }),
          });
        } catch (emailError) {
          console.error('LO AVM report email failed:', emailError);
        }
      } else {
        const requestedMaxFsd = hcRule.maxFsdAllowed ?? null;
        const customerOrderId = loanNumber || orderRunId;
        const customerItemId = randomUUID();
        let agile: any;
        try {
          agile = await createHouseCanaryAgileInsightsOrder({
            address,
            city: city || undefined,
            state: state || undefined,
            zipcode,
            customerOrderId,
            customerItemId,
          });
        } catch (providerError: any) {
          await recordFailedLoanOfficerAvmOrder(supabase, {
            order_run_id: orderRunId,
            address_id: addressId,
            loan_officer_prefix: session.prefix,
            loan_officer_email: session.email,
            loan_number: loanNumber || null,
            investor: investorLabel,
            engine,
            program,
            product,
            provider: 'housecanary',
            provider_product: 'agile_insights',
            external_order_id: null,
            external_item_id: null,
            external_tracking_id: customerOrderId,
            order_status: 'failed',
            address,
            city: city || null,
            state: state || null,
            zipcode,
            ordered_at: orderedAt,
            request_payload: {
              address,
              zipcode,
              city: city || null,
              state: state || null,
              customer_order_id: customerOrderId,
              customer_item_id: customerItemId,
              requestedMaxFsd,
            },
            response_payload: {
              errorMessage: providerError?.message || 'Agile Insights order failed.',
              requestedMaxFsd,
              fsdThresholdStatus: 'pending',
              housecanaryOrderProduct: allocation.selectedProduct,
            },
            requested_max_fsd: requestedMaxFsd,
            fsd_threshold_status: 'pending',
            fsd_threshold_passed: null,
            notes: `Agile Insights order ${allocation.overallSequenceNumber} in ${allocation.cycle.label}`,
            housecanary_billing_cycle_start: allocation.cycle.cycleStart,
            housecanary_billing_cycle_end: allocation.cycle.cycleEnd,
            housecanary_order_product: allocation.selectedProduct,
            housecanary_product_sequence_number: allocation.productSequenceNumber,
            housecanary_overall_sequence_number: allocation.overallSequenceNumber,
            housecanary_free_tier_applied: allocation.isFreeTier,
          });
          throw providerError;
        }

        const insertPayload = {
          order_run_id: orderRunId,
          address_id: addressId,
          loan_officer_prefix: session.prefix,
          loan_officer_email: session.email,
          loan_number: loanNumber || null,
          investor: investorLabel,
          engine,
          program,
          product,
          provider: 'housecanary',
          provider_product: 'agile_insights',
          external_order_id: agile.externalOrderId,
          external_item_id: agile.externalItemId,
          external_tracking_id: customerOrderId,
          order_status: 'submitted',
          address,
          city: city || null,
          state: state || null,
          zipcode,
          ordered_at: orderedAt,
          request_payload: {
            address,
            zipcode,
            city: city || null,
            state: state || null,
            customer_order_id: customerOrderId,
            customer_item_id: customerItemId,
            requestedMaxFsd,
          },
          response_payload: {
            requestedMaxFsd,
            fsdThresholdStatus: 'pending',
            housecanaryOrderProduct: allocation.selectedProduct,
            agileInsightsResponse: agile.raw,
          },
          requested_max_fsd: requestedMaxFsd,
          fsd_threshold_status: 'pending',
          fsd_threshold_passed: null,
          notes: `Agile Insights order ${allocation.overallSequenceNumber} in ${allocation.cycle.label}`,
          housecanary_billing_cycle_start: allocation.cycle.cycleStart,
          housecanary_billing_cycle_end: allocation.cycle.cycleEnd,
          housecanary_order_product: allocation.selectedProduct,
          housecanary_product_sequence_number: allocation.productSequenceNumber,
          housecanary_overall_sequence_number: allocation.overallSequenceNumber,
          housecanary_free_tier_applied: allocation.isFreeTier,
        };

        try {
          insertedOrder = await insertLoanOfficerAvmOrder(supabase, insertPayload);
        } catch (error: any) {
          throw new Error(`Failed to save Agile Insights order: ${error?.message || 'unknown error'}`);
        }
        insertedOrder = await pollHouseCanaryAgileInsightsOrder(supabase, insertedOrder);
      }
    } else if (ccRule?.supported) {
      if (!city || !state) {
        return NextResponse.json({ error: 'City and state are required for Clear Capital fallback ordering.' }, { status: 400 });
      }

      const requestedMaxFsd = Number((ccRule.maxFsdAllowed ?? 0.3).toFixed(2));
      const trackingId = loanNumber || orderRunId;
      let clearCapital: any;
      try {
        clearCapital = await createClearCapitalOrder({
          address,
          city,
          state,
          zipcode,
          trackingId,
          maxFsd: requestedMaxFsd,
        });
      } catch (providerError: any) {
        await recordFailedLoanOfficerAvmOrder(supabase, {
          order_run_id: orderRunId,
          address_id: addressId,
          loan_officer_prefix: session.prefix,
          loan_officer_email: session.email,
          loan_number: loanNumber || null,
          investor: investorLabel,
          engine,
          program,
          product,
          provider: 'clearcapital',
          provider_product: 'clearavm',
          external_order_id: null,
          external_item_id: null,
          external_tracking_id: trackingId,
          order_status: 'failed',
          address,
          city,
          state,
          zipcode,
          ordered_at: orderedAt,
          request_payload: {
            address,
            city,
            state,
            zipcode,
            trackingIds: [trackingId],
            clearAvm: {
              include: true,
              required: false,
              request: {
                maxFSD: requestedMaxFsd,
                exactEffectiveDate: false,
              },
            },
          },
          response_payload: {
            errorMessage: providerError?.message || 'Clear Capital order failed.',
            requestedMaxFsd,
            fsdThresholdStatus: 'pending',
          },
          requested_max_fsd: requestedMaxFsd,
          fsd_threshold_status: 'pending',
          fsd_threshold_passed: null,
          notes: `Clear Capital fallback ordered with maxFSD ${requestedMaxFsd.toFixed(2)}`,
        });
        throw providerError;
      }

      const insertPayload = {
        order_run_id: orderRunId,
        address_id: addressId,
        loan_officer_prefix: session.prefix,
        loan_officer_email: session.email,
        loan_number: loanNumber || null,
        investor: investorLabel,
        engine,
        program,
        product,
        provider: 'clearcapital',
        provider_product: 'clearavm',
        external_order_id: clearCapital.externalOrderId,
        external_item_id: null,
        external_tracking_id: clearCapital.trackingId,
        order_status: clearCapital.thresholdFailure ? 'failed' : 'completed',
        address,
        city,
        state,
        zipcode,
        ordered_at: orderedAt,
        completed_at: clearCapital.thresholdFailure ? null : orderedAt,
        request_payload: {
          address,
          city,
          state,
          zipcode,
          trackingIds: [clearCapital.trackingId],
          clearAvm: {
            include: true,
            required: false,
            request: {
              maxFSD: requestedMaxFsd,
              exactEffectiveDate: false,
            },
          },
        },
        response_payload: {
          value: clearCapital.value,
          fsd: clearCapital.fsd,
          fsdLabel: clearCapital.thresholdFailure ? `> ${requestedMaxFsd.toFixed(2)}` : null,
          errorMessage: clearCapital.errorMessage,
          requestedMaxFsd,
          fsdThresholdStatus: clearCapital.thresholdFailure ? 'failed' : 'passed',
          lowValue: clearCapital.lowValue,
          highValue: clearCapital.highValue,
          effectiveDate: clearCapital.effectiveDate,
          confidenceScore: clearCapital.confidenceScore,
          confidenceScoreAlt: clearCapital.confidenceScoreAlt,
          estimatedError: clearCapital.estimatedError,
          runDate: clearCapital.runDate,
          clearCapitalResponse: clearCapital.raw,
        },
        requested_max_fsd: requestedMaxFsd,
        fsd_threshold_status: clearCapital.thresholdFailure ? 'failed' : 'passed',
        fsd_threshold_passed: !clearCapital.thresholdFailure,
        notes: clearCapital.thresholdFailure
          ? `Clear Capital returned threshold failure at maxFSD ${requestedMaxFsd.toFixed(2)}`
          : `Clear Capital fallback ordered with maxFSD ${requestedMaxFsd.toFixed(2)}`,
      };

      try {
        insertedOrder = await insertLoanOfficerAvmOrder(supabase, insertPayload);
      } catch (error: any) {
        throw new Error(`Failed to save Clear Capital order: ${error?.message || 'unknown error'}`);
      }
    } else {
      return NextResponse.json({ error: `${investorLabel} does not currently support HouseCanary or Clear Capital ordering in the AVM rules.` }, { status: 400 });
    }

    const freshOrders = insertedOrder ? [insertedOrder] : [];
    const providerRows = mergeProviderRows(
      buildProviderRowsFromOrders(freshOrders, investor, 'fresh'),
      cachedOrderRows,
      cachedAvmRows,
    );

    const successMessage = insertedOrder?.provider === 'housecanary' && insertedOrder?.provider_product === 'agile_insights'
      ? insertedOrder?.order_status === 'completed'
        ? 'Agile Insights order completed and the latest value was captured.'
        : 'Agile Insights order placed. Polling ran, but HouseCanary has not returned a completed result yet.'
      : 'Vendor order placed successfully.';

    return NextResponse.json({
      cacheHit: false,
      addressId,
      cacheWindowDays: LO_AVM_CACHE_WINDOW_DAYS,
      investor: investorLabel,
      providerRows,
      winnerProvider: chooseWinnerProvider(providerRows),
      latestOrderedAt: insertedOrder?.ordered_at || insertedOrder?.created_at || null,
      message: successMessage,
    });
  } catch (error) {
    console.error('LO AVM order failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to order AVM.' }, { status: 500 });
  }
}
