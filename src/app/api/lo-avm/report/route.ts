import AdmZip from 'adm-zip';
import { NextRequest, NextResponse } from 'next/server';
import { buildLoanOfficerPortalUnauthorizedResponse, getLoanOfficerPortalSessionFromRequest, getRequestHost, isInternalPortalHost } from '@/lib/lo-portal-auth';

const HOUSECANARY_ORDER_MANAGER_BASE = 'https://order-manager-api.housecanary.com/client-api/v1';

function readHouseCanaryOrderManagerAuth() {
  const key = process.env.HOUSECANARY_API_KEY;
  const secret = process.env.HOUSECANARY_API_SECRET;
  if (!key || !secret) throw new Error('HouseCanary Order Manager credentials are not configured.');
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

async function readResponseJsonOrText(res: Response) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function listHouseCanaryOrderExportJobs(orderId: string) {
  const res = await fetch(`${process.env.HOUSECANARY_ORDER_MANAGER_BASE_URL || HOUSECANARY_ORDER_MANAGER_BASE}/orders/${orderId}/export-requests/`, {
    headers: {
      Authorization: readHouseCanaryOrderManagerAuth(),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`HouseCanary Agile Insights list export jobs failed (${res.status})`);
  }

  const body = await readResponseJsonOrText(res);
  return Array.isArray(body)
    ? body
    : Array.isArray((body as any)?.results)
      ? (body as any).results
      : [];
}

async function createHouseCanaryOrderExportJob(orderId: string) {
  const base = process.env.HOUSECANARY_ORDER_MANAGER_BASE_URL || HOUSECANARY_ORDER_MANAGER_BASE;
  const attempts = [
    `${base}/orders/${orderId}/export/zip?exclude_json=False`,
    `${base}/orders/${orderId}/export/zip?exclude_json=false`,
  ];

  let lastStatus: number | null = null;
  for (const url of attempts) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: readHouseCanaryOrderManagerAuth(),
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      return readResponseJsonOrText(res);
    }
    lastStatus = res.status;
  }

  throw new Error(lastStatus ? `HouseCanary Agile Insights create export job failed (${lastStatus})` : 'HouseCanary Agile Insights create export job failed');
}

function normalizeHouseCanaryExportJob(job: any) {
  if (!job) return null;
  return {
    id: job.id ?? null,
    status: firstString(job.status) || null,
    completedAt: firstString(job.completed_at) || null,
    percentComplete: typeof job.percent_complete === 'number' ? job.percent_complete : null,
    exportedData: firstString(job.exported_data) || null,
    excludeJson: typeof job.exclude_json === 'boolean' ? job.exclude_json : null,
  };
}

async function ensureHouseCanaryAgileInsightsExportJob(orderId: string) {
  const selectPreferredJob = (jobs: any[]) => {
    const sortedJobs = [...jobs].sort((a: any, b: any) => Number(b?.id || 0) - Number(a?.id || 0));
    return sortedJobs.find((job: any) => job?.exclude_json === false) || null;
  };

  const jobs = await listHouseCanaryOrderExportJobs(orderId);
  const preferredJob = selectPreferredJob(jobs);
  if (preferredJob) return normalizeHouseCanaryExportJob(preferredJob);

  try {
    return normalizeHouseCanaryExportJob(await createHouseCanaryOrderExportJob(orderId));
  } catch (error) {
    const afterJobs = await listHouseCanaryOrderExportJobs(orderId);
    const latePreferredJob = selectPreferredJob(afterJobs);
    if (latePreferredJob) return normalizeHouseCanaryExportJob(latePreferredJob);
    throw error;
  }
}

function findPdfEntry(zip: AdmZip, requestedFilename: string | null) {
  const entries = zip.getEntries().filter((entry: AdmZip.IZipEntry) => !entry.isDirectory);
  const normalizedRequested = firstString(requestedFilename);
  if (normalizedRequested) {
    const exact = entries.find((entry: AdmZip.IZipEntry) => entry.entryName.split('/').pop() === normalizedRequested);
    if (exact) return exact;
  }
  return entries.find((entry: AdmZip.IZipEntry) => /_AgileInsights\.pdf$/i.test(entry.entryName))
    || entries.find((entry: AdmZip.IZipEntry) => /\.pdf$/i.test(entry.entryName))
    || null;
}

export async function GET(req: NextRequest) {
  try {
    const session = getLoanOfficerPortalSessionFromRequest(req);
    if (!session) return buildLoanOfficerPortalUnauthorizedResponse();
    if (!isInternalPortalHost(getRequestHost(req))) {
      return NextResponse.json({ error: 'Loan Officer portal host required.' }, { status: 403 });
    }

    const sourceUrl = req.nextUrl.searchParams.get('sourceUrl');
    const exportedDataUrl = req.nextUrl.searchParams.get('exportedDataUrl');
    const pdfFilename = req.nextUrl.searchParams.get('pdfFilename');
    const orderId = req.nextUrl.searchParams.get('orderId');
    const itemId = req.nextUrl.searchParams.get('itemId');
    const pdfType = req.nextUrl.searchParams.get('pdfType');
    const downloadMode = req.nextUrl.searchParams.get('download');

    if (downloadMode === 'agile_export' && orderId) {
      const exportJob = await ensureHouseCanaryAgileInsightsExportJob(orderId);
      if (!exportJob?.exportedData) {
        return NextResponse.json(
          { error: exportJob?.status === 'complete' ? 'HouseCanary export ZIP URL missing.' : 'HouseCanary export ZIP is not ready yet.' },
          { status: exportJob?.status === 'complete' ? 502 : 409 },
        );
      }

      const zipResponse = await fetch(exportJob.exportedData, { cache: 'no-store' });
      if (!zipResponse.ok) {
        return NextResponse.json({ error: `HouseCanary export ZIP download failed (${zipResponse.status}).` }, { status: zipResponse.status });
      }
      const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
      const zip = new AdmZip(zipBuffer);
      const pdfEntry = findPdfEntry(zip, pdfFilename);
      if (!pdfEntry) {
        return NextResponse.json({ error: 'HouseCanary export ZIP did not contain a PDF report.' }, { status: 404 });
      }
      const resolvedFilename = pdfEntry.entryName.split('/').pop() || pdfFilename || 'HouseCanary_AgileInsights.pdf';
      const pdfBytes = new Uint8Array(pdfEntry.getData());
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${resolvedFilename}"`,
          'Cache-Control': 'private, no-store, max-age=0',
        },
      });
    }

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
      const pdfEntry = findPdfEntry(zip, pdfFilename);
      if (!pdfEntry) {
        return NextResponse.json({ error: 'HouseCanary export ZIP did not contain the requested PDF.' }, { status: 404 });
      }
      const resolvedFilename = pdfEntry.entryName.split('/').pop() || pdfFilename;
      const pdfBytes = new Uint8Array(pdfEntry.getData());
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${resolvedFilename}"`,
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
