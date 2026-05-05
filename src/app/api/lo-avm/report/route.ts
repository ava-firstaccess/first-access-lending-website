import AdmZip from 'adm-zip';
import { NextRequest, NextResponse } from 'next/server';
import { buildLoanOfficerPortalUnauthorizedResponse, getLoanOfficerPortalSessionFromRequest, getRequestHost, isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';

const HOUSECANARY_ORDER_MANAGER_BASE = 'https://order-manager-api.housecanary.com/client-api/v1';

function readHouseCanaryOrderManagerAuth() {
  const key = process.env.HOUSECANARY_API_KEY;
  const secret = process.env.HOUSECANARY_API_SECRET;
  if (!key || !secret) throw new Error('HouseCanary Order Manager credentials are not configured.');
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = getLoanOfficerPortalSessionFromRequest(req);
    if (!session) return buildLoanOfficerPortalUnauthorizedResponse();
    if (!isLoanOfficerPortalHost(getRequestHost(req))) {
      return NextResponse.json({ error: 'Loan Officer portal host required.' }, { status: 403 });
    }

    const sourceUrl = req.nextUrl.searchParams.get('sourceUrl');
    const exportedDataUrl = req.nextUrl.searchParams.get('exportedDataUrl');
    const pdfFilename = req.nextUrl.searchParams.get('pdfFilename');
    const orderId = req.nextUrl.searchParams.get('orderId');
    const itemId = req.nextUrl.searchParams.get('itemId');
    const pdfType = req.nextUrl.searchParams.get('pdfType');

    if (exportedDataUrl && pdfFilename) {
      let parsed: URL;
      try {
        parsed = new URL(exportedDataUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid exportedDataUrl.' }, { status: 400 });
      }
      if (!/^https:\/\//i.test(parsed.toString())) {
        return NextResponse.json({ error: 'Unsupported export download URL.' }, { status: 400 });
      }

      const zipResponse = await fetch(parsed.toString(), { cache: 'no-store' });
      if (!zipResponse.ok) {
        return NextResponse.json({ error: `HouseCanary export ZIP download failed (${zipResponse.status}).` }, { status: zipResponse.status });
      }
      const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
      const zip = new AdmZip(zipBuffer);
      const pdfEntry = zip.getEntries().find((entry: AdmZip.IZipEntry) => !entry.isDirectory && entry.entryName.split('/').pop() === pdfFilename);
      if (!pdfEntry) {
        return NextResponse.json({ error: 'HouseCanary export ZIP did not contain the requested PDF.' }, { status: 404 });
      }
      const pdfBytes = new Uint8Array(pdfEntry.getData());
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${pdfFilename}"`,
          'Cache-Control': 'private, no-store, max-age=0',
        },
      });
    }

    let upstream: Response;
    if (sourceUrl) {
      let parsed: URL;
      try {
        parsed = new URL(sourceUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid sourceUrl.' }, { status: 400 });
      }
      if (!/^https:\/\/(api\.)?housecanary\.com\//i.test(parsed.toString())) {
        return NextResponse.json({ error: 'Unsupported report source host.' }, { status: 400 });
      }
      upstream = await fetch(parsed.toString(), {
        headers: { Authorization: readHouseCanaryOrderManagerAuth(), Accept: 'application/pdf' },
        cache: 'no-store',
      });
    } else {
      if (!orderId || !itemId || !pdfType) {
        return NextResponse.json({ error: 'sourceUrl or orderId, itemId, and pdfType are required.' }, { status: 400 });
      }
      upstream = await fetch(`${process.env.HOUSECANARY_ORDER_MANAGER_BASE_URL || HOUSECANARY_ORDER_MANAGER_BASE}/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/pdfdownload/${encodeURIComponent(pdfType)}`, {
        headers: {
          Authorization: readHouseCanaryOrderManagerAuth(),
          Accept: 'application/pdf',
        },
        cache: 'no-store',
      });
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: `HouseCanary report download failed (${upstream.status}).` }, { status: upstream.status });
    }

    const bytes = await upstream.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/pdf',
        'Content-Disposition': upstream.headers.get('content-disposition') || `inline; filename="${pdfType}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('LO AVM report proxy error:', error);
    return NextResponse.json({ error: 'Failed to download HouseCanary report.' }, { status: 500 });
  }
}
