import fs from 'fs';
import { execFileSync } from 'child_process';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { createClient } from '@supabase/supabase-js';

const TABLES = {
  applications: {
    table: 'applications',
    retentionDays: 120,
  },
  loan_officer_avm_order_log: {
    table: 'loan_officer_avm_order_log',
    retentionDays: 120,
  },
  avm_cache: {
    table: 'avm_cache',
    retentionDays: 120,
  },
  avm_provider_runs: {
    table: 'avm_provider_runs',
    retentionDays: 120,
  },
};

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

function parseArgs(argv) {
  const out = {
    execute: false,
    tables: Object.keys(TABLES),
    batchSize: 1000,
    account: process.env.AZURE_STORAGE_ACCOUNT || 'firstaccessdata',
    container: process.env.AZURE_STORAGE_CONTAINER || 'powerbi-data',
    prefix: process.env.LO_AVM_ARCHIVE_PREFIX || 'website',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--execute') out.execute = true;
    else if (arg === '--table') out.tables = [argv[++i]];
    else if (arg === '--tables') out.tables = argv[++i].split(',').map((v) => v.trim()).filter(Boolean);
    else if (arg === '--batch-size') out.batchSize = Number(argv[++i] || out.batchSize);
    else if (arg === '--account') out.account = argv[++i] || out.account;
    else if (arg === '--container') out.container = argv[++i] || out.container;
    else if (arg === '--prefix') out.prefix = argv[++i] || out.prefix;
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/archive-lo-avm-operational-tables.mjs [options]\n\nOptions:\n  --execute              Upload to Azure Blob and mark rows archived\n  --table <name>         Archive a single table\n  --tables a,b           Archive selected tables\n  --batch-size <n>       Supabase fetch/update page size (default: 1000)\n  --account <name>       Azure storage account (default: firstaccessdata)\n  --container <name>     Azure container (default: powerbi-data)\n  --prefix <path>        Blob prefix (default: website)\n\nWithout --execute, the script performs a dry run.`);
      process.exit(0);
    }
  }

  const invalidTables = out.tables.filter((table) => !TABLES[table]);
  if (invalidTables.length > 0) {
    throw new Error(`Unsupported table(s): ${invalidTables.join(', ')}`);
  }
  if (!Number.isFinite(out.batchSize) || out.batchSize <= 0) {
    throw new Error(`Invalid --batch-size: ${out.batchSize}`);
  }
  return out;
}

function getKeychainPassword(service) {
  return execFileSync('security', ['find-generic-password', '-a', 'ava', '-s', service, '-w'], {
    encoding: 'utf8',
  }).trim();
}

function getAzureBlobClient(account, container) {
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY || getKeychainPassword('azure-storage-account-key');
  const credential = new StorageSharedKeyCredential(account, accountKey);
  const service = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
  return service.getContainerClient(container);
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error('Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  }
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function formatRunStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}_${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

function buildBlobPath(prefix, table, runDate) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = runDate.getUTCFullYear();
  const month = pad(runDate.getUTCMonth() + 1);
  const day = pad(runDate.getUTCDate());
  const stamp = formatRunStamp(runDate);
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  return `${cleanPrefix}/${table}/year=${year}/month=${month}/day=${day}/${table}_${stamp}.jsonl`;
}

function toJsonl(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
}

function annotateArchiveColumnError(error, table) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  if (code === '42703' || message.includes('archived_at') || message.includes('archive_path')) {
    throw new Error(`Archive tracking columns are missing on ${table}. Apply supabase/migrations/025_lo_avm_operational_archive_tracking.sql first.`);
  }
  throw error;
}

async function fetchEligibleRows(supabase, table, cutoffIso, batchSize) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .lt('created_at', cutoffIso)
      .is('archived_at', null)
      .order('created_at', { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) annotateArchiveColumnError(error, table);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < batchSize) break;
    from += data.length;
  }
  return rows;
}

async function markArchivedRows(supabase, table, ids, archivedAtIso, archivePath, batchSize) {
  for (let i = 0; i < ids.length; i += batchSize) {
    const slice = ids.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .update({ archived_at: archivedAtIso, archive_path: archivePath })
      .in('id', slice);
    if (error) annotateArchiveColumnError(error, table);
  }
}

async function archiveTable({ supabase, containerClient, tableConfig, execute, batchSize, prefix }) {
  const cutoff = new Date(Date.now() - tableConfig.retentionDays * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();
  const rows = await fetchEligibleRows(supabase, tableConfig.table, cutoffIso, batchSize);
  const summary = {
    table: tableConfig.table,
    retentionDays: tableConfig.retentionDays,
    cutoffIso,
    eligibleRows: rows.length,
    execute,
    archivePath: null,
    archivedAt: null,
  };

  if (rows.length === 0) return summary;

  const runDate = new Date();
  const archivePath = buildBlobPath(prefix, tableConfig.table, runDate);
  summary.archivePath = archivePath;

  if (!execute) return summary;

  const blobClient = containerClient.getBlockBlobClient(archivePath);
  const payload = Buffer.from(toJsonl(rows), 'utf8');
  await containerClient.createIfNotExists();
  await blobClient.uploadData(payload, {
    blobHTTPHeaders: { blobContentType: 'application/x-ndjson; charset=utf-8' },
    metadata: {
      source_table: tableConfig.table,
      retention_days: String(tableConfig.retentionDays),
      exported_rows: String(rows.length),
      cutoff_iso: cutoffIso,
    },
  });

  const archivedAtIso = new Date().toISOString();
  await markArchivedRows(supabase, tableConfig.table, rows.map((row) => row.id), archivedAtIso, archivePath, batchSize);
  summary.archivedAt = archivedAtIso;
  return summary;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseClient();
  const containerClient = options.execute ? getAzureBlobClient(options.account, options.container) : null;
  const summaries = [];

  for (const tableName of options.tables) {
    const tableConfig = TABLES[tableName];
    summaries.push(await archiveTable({
      supabase,
      containerClient,
      tableConfig,
      execute: options.execute,
      batchSize: options.batchSize,
      prefix: options.prefix,
    }));
  }

  console.log(JSON.stringify({
    execute: options.execute,
    account: options.account,
    container: options.container,
    prefix: options.prefix,
    summaries,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
