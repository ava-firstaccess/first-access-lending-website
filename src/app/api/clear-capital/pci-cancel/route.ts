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
const DEFAULT_REASON = 'Canceled from LP portal by processor request.';

type CancelBody = {
  orderId?: string;
  reason?: string;
};

function getValuationConfig() {
  const apiKey = process.env.CLEARCAPITAL_PROPERTY_VALUATION_API_KEY || process.env.CLEARCAPITAL_PCI_API_KEY || '';
  const baseUrl = process.env.CLEARCAPITAL_PROPERTY_VALUATION_BASE_URL || process.env.CLEARCAPITAL_PCI_BASE_URL || 'https://api.clearcapital.com/property-valuation-api';
  const tenantId = process.env.CLEARCAPITAL_PROPERTY_VALUATION_TENANT_ID || process.env.CLEARCAPITAL_PCI_TENANT_ID || '';
  return {
    apiKey: apiKey.trim(),
    baseUrl: baseUrl.trim().replace(/\/$/, ''),
    tenantId: tenantId.trim(),
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

    const body = await req.json() as CancelBody;
    const orderId = String(body.orderId || '').trim();
    const reason = String(body.reason || DEFAULT_REASON).trim() || DEFAULT_REASON;
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    const { apiKey, baseUrl, tenantId } = getValuationConfig();
    if (!apiKey) {
      return NextResponse.json({ error: 'Clear Capital Property Valuation API key is not configured.' }, { status: 500 });
    }

    const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/cancels`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
      body: JSON.stringify({ reason }),
      cache: 'no-store',
    });

    const bodyText = await response.text();
    let responseBody: unknown = bodyText;
    try {
      responseBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {}

    if (!response.ok) {
      return NextResponse.json({
        error: `Clear Capital PCI cancel failed (${response.status}).`,
        body: responseBody,
      }, { status: 502 });
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdmin();

    await supabase.from(ORDERS_TABLE).update({
      status: 'cancel_requested',
      hold_reason: reason,
      last_event_type: 'CancelRequested',
      last_event_at: nowIso,
      updated_at: nowIso,
    }).eq('order_id', orderId);

    await supabase.from(EVENTS_TABLE).insert({
      order_id: orderId,
      event_type: 'CancelRequested',
      event_timestamp: nowIso,
      dedupe_key: `${orderId}:CancelRequested:${nowIso}`,
      sns_type: 'PortalAction',
      payload: {
        reason,
        requestedByEmail: session.email,
        requestedByName: session.name || null,
        clearCapitalResponse: responseBody,
      },
    });

    return NextResponse.json({ success: true, orderId, reason });
  } catch (error) {
    console.error('PCI cancel error:', error);
    return NextResponse.json({ error: 'Failed to cancel PCI order.' }, { status: 500 });
  }
}
