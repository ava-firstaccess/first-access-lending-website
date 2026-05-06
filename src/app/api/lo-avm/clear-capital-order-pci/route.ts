import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildLoanOfficerPortalUnauthorizedResponse,
  canAccessProcessorWorkspace,
  getLoanOfficerPortalSessionFromRequest,
  getRequestHost,
  isInternalPortalHost,
  isLoanProcessorPortalHost,
} from '@/lib/lo-portal-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const ORDERS_TABLE = 'clear_capital_pci_orders';
const EVENTS_TABLE = 'clear_capital_pci_order_events';
const ANALYTICS_TABLE = 'clear_capital_pci_analytics_runs';
const DEFAULT_PRODUCT_CODE = 'PCI_EXTERIOR';
const ACTIVE_STATUSES = ['placed', 'accepted', 'assigned', 'inspection_scheduled', 'inspection_completed', 'under_review', 'hold_added', 'message_added', 'eta_changed', 'cancel_requested'];
const CACHE_WINDOW_DAYS = 120;

type OrderBody = {
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
};

function normalizeText(value: string | undefined | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStreetAddress(value: string | undefined | null) {
  const streetLine = String(value || '').split(',')[0] || '';
  return normalizeText(streetLine)
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

function buildAddressKey(address: string, zipcode: string) {
  return [normalizeStreetAddress(address), normalizeText(zipcode)].filter(Boolean).join('|');
}

function getValuationConfig() {
  const apiKey = process.env.CLEARCAPITAL_PROPERTY_VALUATION_API_KEY || process.env.CLEARCAPITAL_PCI_API_KEY || '';
  const baseUrl = process.env.CLEARCAPITAL_PROPERTY_VALUATION_BASE_URL || process.env.CLEARCAPITAL_PCI_BASE_URL || 'https://api.clearcapital.com/property-valuation-api';
  const tenantId = process.env.CLEARCAPITAL_PROPERTY_VALUATION_TENANT_ID || process.env.CLEARCAPITAL_PCI_TENANT_ID || '';
  const productCode = process.env.CLEARCAPITAL_PCI_PRODUCT_CODE || DEFAULT_PRODUCT_CODE;
  return {
    apiKey: apiKey.trim(),
    baseUrl: baseUrl.trim().replace(/\/$/, ''),
    tenantId: tenantId.trim(),
    productCode: productCode.trim() || DEFAULT_PRODUCT_CODE,
  };
}

async function insertPciAnalyticsRun(supabase: ReturnType<typeof getSupabaseAdmin>, payload: Record<string, unknown>) {
  const { error } = await supabase.from(ANALYTICS_TABLE).upsert(payload, { onConflict: 'order_id' });
  if (error) console.error('PCI analytics upsert failed:', error);
}

async function findActivePciOrder(supabase: ReturnType<typeof getSupabaseAdmin>, addressKey: string) {
  const cutoffIso = new Date(Date.now() - CACHE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from(ORDERS_TABLE)
    .select('order_id,status,created_at')
    .eq('address_key', addressKey)
    .gte('created_at', cutoffIso)
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Active PCI lookup failed: ${error.message}`);
  return data || null;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const analyticsRunId = randomUUID();

  try {
    const session = getLoanOfficerPortalSessionFromRequest(req);
    if (!session) return buildLoanOfficerPortalUnauthorizedResponse();
    if (!canAccessProcessorWorkspace(session.position)) {
      return NextResponse.json({ error: 'Loan processor access required.' }, { status: 403 });
    }

    const host = getRequestHost(req);
    if (!isInternalPortalHost(host) || !isLoanProcessorPortalHost(host)) {
      return NextResponse.json({ error: 'Loan processor portal host required.' }, { status: 403 });
    }

    const body = await req.json() as OrderBody;
    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    const zipcode = String(body.zipcode || '').trim();

    if (!address || !city || !state || !zipcode) {
      return NextResponse.json({ error: 'Full property address, city, state, and ZIP are required.' }, { status: 400 });
    }

    const addressKey = buildAddressKey(address, zipcode);
    const existingActive = await findActivePciOrder(supabase, addressKey);
    if (existingActive) {
      await insertPciAnalyticsRun(supabase, {
        run_id: analyticsRunId,
        address_key: addressKey,
        property_address: address,
        property_city: city,
        property_state: state,
        property_zip: zipcode,
        ordered_by_email: session.email,
        ordered_by_prefix: session.prefix,
        product_code: process.env.CLEARCAPITAL_PCI_PRODUCT_CODE || DEFAULT_PRODUCT_CODE,
        duplicate_blocked: true,
        blocked_reason: 'PCI already in progress on this address',
        latest_status: String(existingActive.status || ''),
        latest_event_type: 'DuplicateBlocked',
        completed_successfully: false,
      });
      return NextResponse.json({ error: 'PCI already in progress on this address.' }, { status: 409 });
    }

    const { apiKey, baseUrl, tenantId, productCode } = getValuationConfig();
    if (!apiKey) {
      return NextResponse.json({ error: 'Clear Capital Property Valuation API key is not configured.' }, { status: 500 });
    }

    const referenceIdentifier = `lp-pci-${randomUUID()}`;
    const loanNumber = `lp-pci-${Date.now()}`;
    const orderPayload = {
      product: productCode,
      purpose: 'HOME_EQUITY',
      paymentMethod: 'INVOICE',
      referenceIdentifier,
      trackingIdentifiers: [referenceIdentifier],
      loan: {
        loanNumber,
      },
      address: {
        street: address,
        city,
        state,
        zipcode,
      },
    };

    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
      body: JSON.stringify(orderPayload),
      cache: 'no-store',
    });

    const bodyText = await response.text();
    let responseBody: unknown = bodyText;
    try {
      responseBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {}

    if (!response.ok) {
      await insertPciAnalyticsRun(supabase, {
        run_id: analyticsRunId,
        address_key: addressKey,
        property_address: address,
        property_city: city,
        property_state: state,
        property_zip: zipcode,
        ordered_by_email: session.email,
        ordered_by_prefix: session.prefix,
        product_code: productCode,
        duplicate_blocked: false,
        blocked_reason: null,
        latest_status: 'failed',
        latest_event_type: 'OrderPlacementFailed',
        completed_successfully: false,
      });
      return NextResponse.json({
        error: `Clear Capital PCI order failed (${response.status}).`,
        body: responseBody,
      }, { status: 502 });
    }

    const orderId = String((responseBody as { orderId?: string } | null)?.orderId || '').trim();
    if (!orderId) {
      await insertPciAnalyticsRun(supabase, {
        run_id: analyticsRunId,
        address_key: addressKey,
        property_address: address,
        property_city: city,
        property_state: state,
        property_zip: zipcode,
        ordered_by_email: session.email,
        ordered_by_prefix: session.prefix,
        product_code: productCode,
        duplicate_blocked: false,
        blocked_reason: null,
        latest_status: 'failed',
        latest_event_type: 'OrderPlacementFailed',
        completed_successfully: false,
      });
      return NextResponse.json({ error: 'Clear Capital returned no PCI order ID.' }, { status: 502 });
    }

    const nowIso = new Date().toISOString();
    const { error: upsertError } = await supabase.from(ORDERS_TABLE).upsert({
      order_id: orderId,
      reference_identifier: referenceIdentifier,
      tenant_id: tenantId || null,
      product_code: productCode,
      status: 'placed',
      address_key: addressKey,
      address,
      city,
      state,
      zip: zipcode,
      ordered_by_email: session.email,
      ordered_by_name: session.name || null,
      ordered_by_prefix: session.prefix,
      last_event_type: 'OrderPlaced',
      last_event_at: nowIso,
      latest_event_payload: {
        event: 'OrderPlaced',
        orderRequest: orderPayload,
        orderResponse: responseBody,
      },
      updated_at: nowIso,
    }, { onConflict: 'order_id' });

    if (upsertError) {
      throw upsertError;
    }

    const { error: eventError } = await supabase.from(EVENTS_TABLE).insert({
      order_id: orderId,
      event_type: 'OrderPlaced',
      event_timestamp: nowIso,
      dedupe_key: `${orderId}:OrderPlaced:${nowIso}`,
      sns_type: 'PortalAction',
      payload: {
        orderRequest: orderPayload,
        orderResponse: responseBody,
        requestedByEmail: session.email,
      },
    });
    if (eventError) console.error('PCI order placed event insert failed:', eventError);

    await insertPciAnalyticsRun(supabase, {
      run_id: analyticsRunId,
      order_id: orderId,
      address_key: addressKey,
      property_address: address,
      property_city: city,
      property_state: state,
      property_zip: zipcode,
      ordered_by_email: session.email,
      ordered_by_prefix: session.prefix,
      product_code: productCode,
      duplicate_blocked: false,
      blocked_reason: null,
      latest_status: 'placed',
      latest_event_type: 'OrderPlaced',
      completed_successfully: null,
    });

    return NextResponse.json({
      success: true,
      orderId,
      address,
      productCode,
      referenceIdentifier,
      orderedByEmail: session.email,
    });
  } catch (error) {
    console.error('Processor Clear Capital PCI order error:', error);
    return NextResponse.json({ error: 'Failed to place Clear Capital PCI order.' }, { status: 500 });
  }
}
