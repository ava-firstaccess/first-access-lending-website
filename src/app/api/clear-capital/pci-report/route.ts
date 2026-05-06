import { NextRequest, NextResponse } from 'next/server';
import {
  buildLoanOfficerPortalUnauthorizedResponse,
  canAccessProcessorWorkspace,
  getLoanOfficerPortalSessionFromRequest,
  getRequestHost,
  isInternalPortalHost,
  isLoanProcessorPortalHost,
} from '@/lib/lo-portal-auth';

type DocumentResponse = {
  documentId?: string;
  documentType?: string;
  fileName?: string;
  url?: string;
  uploadDate?: string;
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

function normalizeDocuments(payload: unknown) {
  return Array.isArray(payload) ? payload as DocumentResponse[] : [];
}

function scoreDocument(document: DocumentResponse) {
  const type = String(document.documentType || '').toUpperCase();
  if (type === 'DELIVERABLE_PDF' || type === 'APPRAISAL_PDF' || type === 'BPO_PDF') return 500;
  if (type === 'APPRAISAL_MISMO') return 400;
  if (type === 'APPRAISAL_ZIP' || type === 'IMAGE_ZIP') return 300;
  if (type === 'AURA_RESULTS_JSON') return 200;
  return 100;
}

function pickBestDocument(documents: DocumentResponse[]) {
  return [...documents]
    .filter((document) => typeof document.url === 'string' && document.url.trim())
    .sort((a, b) => scoreDocument(b) - scoreDocument(a))[0] || null;
}

export async function GET(req: NextRequest) {
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

    const orderId = String(req.nextUrl.searchParams.get('orderId') || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    const { apiKey, baseUrl, tenantId } = getValuationConfig();
    if (!apiKey) {
      return NextResponse.json({ error: 'Clear Capital Property Valuation API key is not configured.' }, { status: 500 });
    }

    const headers: HeadersInit = {
      accept: 'application/json',
      'x-api-key': apiKey,
      ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    };

    const documentsResponse = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/documents`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const documentsText = await documentsResponse.text();
    let documentsBody: unknown = documentsText;
    try {
      documentsBody = documentsText ? JSON.parse(documentsText) : [];
    } catch {}

    if (!documentsResponse.ok) {
      return NextResponse.json({
        error: `Failed to load PCI documents (${documentsResponse.status}).`,
        body: documentsBody,
      }, { status: 502 });
    }

    const documents = normalizeDocuments(documentsBody);
    const bestDocument = pickBestDocument(documents);

    const exportResponse = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/export`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    let exportBody: unknown = null;
    const exportText = await exportResponse.text();
    try {
      exportBody = exportText ? JSON.parse(exportText) : null;
    } catch {
      exportBody = exportText || null;
    }

    const exportUrl = exportResponse.ok ? `${baseUrl}/orders/${encodeURIComponent(orderId)}/export` : null;

    if (!bestDocument && !exportUrl) {
      return NextResponse.json({ error: 'No downloadable PCI report is available yet.', documents }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      orderId,
      reportUrl: bestDocument?.url || null,
      reportDocumentId: bestDocument?.documentId || null,
      reportDocumentType: bestDocument?.documentType || null,
      reportFileName: bestDocument?.fileName || null,
      exportUrl,
      exportAvailable: exportResponse.ok,
      exportBody,
      documents,
    });
  } catch (error) {
    console.error('PCI report retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve PCI report.' }, { status: 500 });
  }
}
