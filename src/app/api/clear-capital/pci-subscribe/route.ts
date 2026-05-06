import { NextRequest, NextResponse } from 'next/server';
import {
  buildLoanOfficerPortalUnauthorizedResponse,
  getLoanOfficerPortalSessionFromRequest,
  getLoanProcessorPortalHost,
  getRequestHost,
  isInternalPortalHost,
  isLoanProcessorPortalHost,
} from '@/lib/lo-portal-auth';

type SubscribeResponse = {
  success: boolean;
  webhookUrl: string;
  baseUrl: string;
  autoConfirmEnabled: boolean;
  tenantIdIncluded: boolean;
  status: number;
  body: unknown;
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
    if (session.position !== 'loan_processor') {
      return NextResponse.json({ error: 'Loan processor access required.' }, { status: 403 });
    }

    const host = getRequestHost(req);
    if (!isInternalPortalHost(host) || !isLoanProcessorPortalHost(host)) {
      return NextResponse.json({ error: 'Loan processor portal host required.' }, { status: 403 });
    }

    const { apiKey, baseUrl, tenantId } = getValuationConfig();
    if (!apiKey) {
      return NextResponse.json({ error: 'Clear Capital Property Valuation API key is not configured.' }, { status: 500 });
    }

    const webhookUrl = `https://${getLoanProcessorPortalHost()}/api/clear-capital/pci-webhook`;
    const response = await fetch(`${baseUrl}/events/subscription`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
      },
      body: JSON.stringify({ url: webhookUrl }),
      cache: 'no-store',
    });

    const bodyText = await response.text();
    let body: unknown = bodyText;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {}

    if (!response.ok) {
      return NextResponse.json({
        error: `Webhook subscription failed (${response.status}).`,
        webhookUrl,
        baseUrl,
        tenantIdIncluded: Boolean(tenantId),
        body,
      }, { status: 502 });
    }

    const payload: SubscribeResponse = {
      success: true,
      webhookUrl,
      baseUrl,
      autoConfirmEnabled: process.env.CLEARCAPITAL_PCI_AUTO_CONFIRM_WEBHOOK !== 'false',
      tenantIdIncluded: Boolean(tenantId),
      status: response.status,
      body,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('PCI webhook subscribe error:', error);
    return NextResponse.json({ error: 'Failed to subscribe PCI webhook.' }, { status: 500 });
  }
}
