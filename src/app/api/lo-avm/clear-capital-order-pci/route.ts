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
const DEFAULT_PRODUCT_CODE = 'PCI_EXTERIOR';

type OrderBody = {
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
};

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

export async function POST(req: NextRequest) {
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
      return NextResponse.json({
        error: `Clear Capital PCI order failed (${response.status}).`,
        body: responseBody,
      }, { status: 502 });
    }

    const orderId = String((responseBody as { orderId?: string } | null)?.orderId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'Clear Capital returned no PCI order ID.' }, { status: 502 });
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase.from(ORDERS_TABLE).upsert({
      order_id: orderId,
      reference_identifier: referenceIdentifier,
      tenant_id: tenantId || null,
      product_code: productCode,
      status: 'placed',
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
