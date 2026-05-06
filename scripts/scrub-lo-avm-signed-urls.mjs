import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv('.env.local');
loadEnv('.env');

const SIGNED_URL_PARAM_KEYS = [
  'AWSAccessKeyId',
  'Signature',
  'x-amz-security-token',
  'X-Amz-Security-Token',
  'X-Amz-Signature',
  'X-Amz-Credential',
  'X-Amz-Algorithm',
  'X-Amz-Date',
  'X-Amz-Expires',
  'Expires',
];

function parseArgs(argv) {
  const out = {
    execute: false,
    batchSize: 500,
    table: 'loan_officer_avm_order_log',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') out.execute = true;
    else if (arg === '--batch-size') out.batchSize = Number(argv[++i] || out.batchSize);
    else if (arg === '--table') out.table = argv[++i] || out.table;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/scrub-lo-avm-signed-urls.mjs [options]\n\nOptions:\n  --execute          Persist scrubbed payloads\n  --table <name>     Table to scrub (default: loan_officer_avm_order_log)\n  --batch-size <n>   Fetch/update page size (default: 500)\n\nWithout --execute, the script performs a dry run.`);
      process.exit(0);
    }
  }

  if (!Number.isFinite(out.batchSize) || out.batchSize <= 0) {
    throw new Error(`Invalid --batch-size: ${out.batchSize}`);
  }
  if (!out.table) throw new Error('Missing table name.');
  return out;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error('Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  }
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function containsSignedUrlSecret(value) {
  const raw = String(value || '');
  if (!raw) return false;
  return SIGNED_URL_PARAM_KEYS.some((key) => raw.includes(`${key}=`) || raw.includes(encodeURIComponent(`${key}=`)));
}

function stripSensitiveUrlsDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSensitiveUrlsDeep(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, stripSensitiveUrlsDeep(entry)]),
    );
  }
  if (typeof value === 'string' && containsSignedUrlSecret(value)) {
    return null;
  }
  return value;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function buildStableAgileExportReportLink(orderId, pdfFilename) {
  if (!orderId) return null;
  const params = new URLSearchParams({
    orderId: String(orderId),
    download: 'agile_export',
  });
  const filename = firstString(pdfFilename);
  if (filename) params.set('pdfFilename', filename);
  return `/api/lo-avm/report?${params.toString()}`;
}

function sanitizeAgileExportJobForStorage(job) {
  if (!job || typeof job !== 'object') return null;
  return stripSensitiveUrlsDeep({
    id: job.id ?? null,
    status: job.status ?? null,
    completedAt: job.completedAt ?? job.completed_at ?? null,
    percentComplete: job.percentComplete ?? job.percent_complete ?? null,
    excludeJson: job.excludeJson ?? job.exclude_json ?? null,
  });
}

function sanitizeResponsePayload(row) {
  const payload = row?.response_payload;
  if (!payload || typeof payload !== 'object') return null;

  const next = stripSensitiveUrlsDeep(payload);

  if ('agileInsightsExportedDataUrl' in next) delete next.agileInsightsExportedDataUrl;
  if ('agileInsightsSummaryDataUrl' in next) delete next.agileInsightsSummaryDataUrl;

  if (next.agileInsightsExportJob) {
    next.agileInsightsExportJob = sanitizeAgileExportJobForStorage(next.agileInsightsExportJob);
  }

  const isAgile = row?.provider === 'housecanary' && row?.provider_product === 'agile_insights';
  const legacyReportLink = typeof next.reportLink === 'string' ? next.reportLink : '';
  if (isAgile && legacyReportLink.includes('exportedDataUrl=')) {
    next.reportLink = buildStableAgileExportReportLink(
      row.external_order_id,
      next.agileInsightsPdfFilename,
    );
  }

  return next;
}

function rowNeedsScrub(row) {
  const payload = row?.response_payload;
  if (!payload || typeof payload !== 'object') return false;
  const asText = JSON.stringify(payload);
  if (!asText) return false;
  if (containsSignedUrlSecret(asText)) return true;
  const reportLink = typeof payload.reportLink === 'string' ? payload.reportLink : '';
  if (reportLink.includes('exportedDataUrl=')) return true;
  if (payload.agileInsightsExportedDataUrl || payload.agileInsightsSummaryDataUrl) return true;
  return false;
}

async function fetchRows(supabase, table, batchSize) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('id, provider, provider_product, external_order_id, response_payload, updated_at')
      .order('created_at', { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < batchSize) break;
    from += data.length;
  }
  return rows;
}

async function updateRows(supabase, table, changes, batchSize) {
  for (let i = 0; i < changes.length; i += batchSize) {
    const slice = changes.slice(i, i + batchSize);
    await Promise.all(slice.map(async ({ id, response_payload }) => {
      const { error } = await supabase
        .from(table)
        .update({ response_payload, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();
  const rows = await fetchRows(supabase, options.table, options.batchSize);
  const candidates = rows.filter(rowNeedsScrub);
  const changes = [];

  for (const row of candidates) {
    const response_payload = sanitizeResponsePayload(row);
    if (JSON.stringify(response_payload) !== JSON.stringify(row.response_payload)) {
      changes.push({ id: row.id, response_payload });
    }
  }

  if (options.execute && changes.length > 0) {
    await updateRows(supabase, options.table, changes, options.batchSize);
  }

  console.log(JSON.stringify({
    execute: options.execute,
    table: options.table,
    scannedRows: rows.length,
    candidateRows: candidates.length,
    changedRows: changes.length,
    sampleIds: changes.slice(0, 10).map((row) => row.id),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
