import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildLoanOfficerPortalUnauthorizedResponse, getLoanOfficerPortalSessionFromRequest, getRequestHost, isInternalPortalHost, isLoanProcessorPortalHost } from '@/lib/lo-portal-auth';

type OrderBody = {
  address?: string;
  city?: string;
  state?: string;
  zipcode?: string;
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildEmailHtml({ address, link, orderId, value, fsd }: { address: string; link: string; orderId: string; value: number | null; fsd: number | null }) {
  const currency = value !== null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
    : '—';

  return `
    <div style="margin:0;padding:24px;background:#f8fbff;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(2,131,219,0.08);">
        <div style="padding:20px 24px;background:linear-gradient(135deg,#003961 0%,#0283DB 72%,#0EF0F0 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;opacity:0.9;">Loan Processor AVM</div>
          <div style="margin-top:8px;font-size:28px;line-height:1.2;font-weight:700;">Clear Capital PDF ready</div>
          <div style="margin-top:8px;font-size:14px;opacity:0.9;">First Access Lending</div>
        </div>
        <div style="padding:24px;line-height:1.6;font-size:15px;">
          <p style="margin:0 0 12px;">Your Clear Capital PDF is ready for <strong>${escapeHtml(address)}</strong>.</p>
          <p style="margin:0 0 20px;">Order ID: <strong>${escapeHtml(orderId)}</strong></p>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 20px;">
            <div style="padding:14px 16px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
              <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#475569;font-weight:700;">Estimated Value</div>
              <div style="margin-top:6px;font-size:22px;font-weight:700;color:#003961;">${escapeHtml(currency)}</div>
            </div>
            <div style="padding:14px 16px;border:1px solid #dbeafe;border-radius:14px;background:#f8fbff;">
              <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#475569;font-weight:700;">Returned FSD</div>
              <div style="margin-top:6px;font-size:22px;font-weight:700;color:#003961;">${escapeHtml(fsd !== null ? fsd.toFixed(2) : '—')}</div>
            </div>
          </div>
          <p style="margin:0 0 20px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0283DB;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700;">Download PDF</a></p>
          <p style="margin:0;color:#475569;font-size:12px;">This link was generated from the loan processor AVM tools workspace.</p>
        </div>
      </div>
    </div>
  `;
}

async function sendReportEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'First Access Lending <info@firstaccesslending.com>',
      to: [to],
      subject,
      html,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Report email failed (${res.status})`);
  }
}

function getClearCapitalConfig() {
  const apiKey = process.env.CLEARCAPITAL_PAA_API_KEY;
  const baseUrl = process.env.CLEARCAPITAL_PAA_BASE_URL || 'https://api.clearcapital.com/property-analytics-api';
  if (!apiKey) throw new Error('Clear Capital Property Analytics credentials are not configured.');
  return { apiKey, baseUrl };
}

function getMaxFsd() {
  const raw = Number(process.env.CLEARCAPITAL_PAA_PDF_MAX_FSD || '0.3');
  if (Number.isFinite(raw) && raw > 0 && raw < 1) return raw;
  return 0.3;
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

    const body = await req.json() as OrderBody;
    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    const zipcode = String(body.zipcode || '').trim();

    if (!address || !city || !state || !zipcode) {
      return NextResponse.json({ error: 'Full address, city, state, and ZIP are required.' }, { status: 400 });
    }

    const { apiKey, baseUrl } = getClearCapitalConfig();
    const trackingId = `lp-pdf-${randomUUID()}`;
    const maxFsd = getMaxFsd();

    const orderPayload = {
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

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(orderPayload),
      cache: 'no-store',
    });

    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok) {
      return NextResponse.json({ error: `Clear Capital order failed (${orderRes.status}).` }, { status: 502 });
    }

    const orderId = String(orderData?.id || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'Clear Capital returned no order ID.' }, { status: 502 });
    }

    const avmResult = orderData?.clearAvm?.result || null;
    if (!avmResult?.marketValue) {
      const errorMessage = typeof orderData?.errorMessage === 'string' ? orderData.errorMessage : 'No valuation component was returned for the supplied threshold.';
      return NextResponse.json({ error: errorMessage, orderId }, { status: 400 });
    }

    const pdfRes = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/pdf?returnUrl=true&regeneratePdf=false&omitStreetView=false`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-api-key': apiKey,
      },
      cache: 'no-store',
      redirect: 'manual',
    });

    let pdfUrl = '';
    if (pdfRes.status === 200) {
      const pdfData = await pdfRes.json().catch(() => ({}));
      pdfUrl = String(pdfData?.url || pdfData?.pdfUrl || pdfData?.signedUrl || '').trim();
    } else if (pdfRes.status === 302 || pdfRes.status === 301) {
      pdfUrl = String(pdfRes.headers.get('location') || '').trim();
    }

    if (!pdfUrl) {
      return NextResponse.json({ error: 'Clear Capital returned no PDF URL.' }, { status: 502 });
    }

    const value = typeof avmResult.marketValue === 'number' ? Math.round(avmResult.marketValue) : null;
    const fsd = typeof avmResult.forecastStdDev === 'number' ? avmResult.forecastStdDev : null;

    try {
      await sendReportEmail(
        session.email,
        `Clear Capital PDF ready for ${address}`,
        buildEmailHtml({ address, link: pdfUrl, orderId, value, fsd })
      );
    } catch (emailError) {
      console.error('Processor Clear Capital PDF email failed:', emailError);
    }

    return NextResponse.json({
      success: true,
      orderId,
      pdfUrl,
      address,
      emailedTo: session.email,
      value,
      fsd,
      maxFsd,
    });
  } catch (error) {
    console.error('Processor Clear Capital PDF error:', error);
    return NextResponse.json({ error: 'Failed to create Clear Capital PDF order.' }, { status: 500 });
  }
}
