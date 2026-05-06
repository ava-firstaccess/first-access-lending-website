import fs from 'fs';
import { randomUUID } from 'crypto';
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function mapWinnerProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'housecanary' || normalized === 'housecanary_estimate') return 'HouseCanary';
  if (normalized === 'clearcapital') return 'Clear Capital';
  if (normalized === 'veros') return 'Veros';
  if (normalized === 'ca value' || normalized === 'cavalue') return 'CA Value';
  if (normalized === 'black knight (valusure)' || normalized === 'blackknight') return 'Black Knight (Valusure)';
  return null;
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getFinalValue(row) {
  return parseNumber(row.final_value) ?? parseNumber(row.response_payload?.hcValue);
}

function getFinalFsd(row) {
  return parseNumber(row.final_fsd)
    ?? parseNumber(row.response_payload?.finalFsd)
    ?? parseNumber(row.response_payload?.fsd)
    ?? parseNumber(row.response_payload?.houseCanaryFsd)
    ?? parseNumber(row.response_payload?.clearCapitalForecastStdDev);
}

function getFinalNewMaxLoan(row) {
  return parseNumber(row.final_new_max_loan) ?? parseNumber(row.response_payload?.newMaxLoan);
}

function getQuotedInvestor(app) {
  const formData = app?.form_data && typeof app.form_data === 'object' ? app.form_data : null;
  return typeof formData?.quotedInvestor === 'string' ? formData.quotedInvestor : null;
}

function buildVendorRows(row) {
  const responsePayload = row.response_payload || {};
  const winnerProvider = mapWinnerProvider(row.final_provider || responsePayload.valuationProvider);
  const rows = [];

  const hasHouseCanaryEvidence = winnerProvider === 'HouseCanary'
    || parseNumber(responsePayload.houseCanaryEstimate) !== null
    || parseNumber(responsePayload.houseCanaryValue) !== null
    || parseNumber(responsePayload.houseCanaryFsd) !== null
    || parseNumber(responsePayload.fsd) !== null
    || String(responsePayload.valuationProvider || '').trim().toLowerCase() === 'housecanary_estimate';

  if (hasHouseCanaryEvidence) {
    const valuationProvider = String(responsePayload.valuationProvider || '').trim().toLowerCase();
    rows.push({
      provider: 'HouseCanary',
      source: 'fresh',
      vendor_product: valuationProvider === 'housecanary_estimate' ? 'property_estimated_value' : 'property_value',
      value: winnerProvider === 'HouseCanary'
        ? getFinalValue(row)
        : parseNumber(responsePayload.houseCanaryValue)
          ?? parseNumber(responsePayload.houseCanaryEstimate)
          ?? (valuationProvider === 'housecanary_estimate' ? parseNumber(responsePayload.hcValue) : null),
      fsd: parseNumber(responsePayload.fsd) ?? parseNumber(responsePayload.houseCanaryFsd),
      is_winner: winnerProvider === 'HouseCanary',
      failure_message: null,
      created_at: row.created_at,
    });
  }

  const hasClearCapitalEvidence = winnerProvider === 'Clear Capital'
    || parseNumber(responsePayload.clearCapitalForecastStdDev) !== null
    || typeof responsePayload.clearCapitalConfidenceScore === 'string'
    || typeof responsePayload.clearCapitalRunDate === 'string'
    || typeof responsePayload.clearCapitalEffectiveDate === 'string';

  if (hasClearCapitalEvidence) {
    rows.push({
      provider: 'Clear Capital',
      source: 'fresh',
      vendor_product: 'property_analytics',
      value: winnerProvider === 'Clear Capital' ? getFinalValue(row) : null,
      fsd: parseNumber(responsePayload.clearCapitalForecastStdDev),
      is_winner: winnerProvider === 'Clear Capital',
      failure_message: null,
      created_at: row.created_at,
    });
  }

  return rows.filter((vendorRow) => vendorRow.value !== null || vendorRow.fsd !== null || vendorRow.failure_message !== null || vendorRow.is_winner);
}

async function fetchApplicationsById(ids) {
  const result = new Map();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniqueIds.length; i += 500) {
    const batch = uniqueIds.slice(i, i + 500);
    const { data, error } = await supabase
      .from('applications')
      .select('id, anonymous_id, form_data')
      .in('id', batch);
    if (error) throw error;
    for (const row of data || []) result.set(row.id, row);
  }
  return result;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const { data: cacheRows, error } = await supabase
    .from('avm_cache')
    .select('id, application_id, address, city, state, zipcode, max_ltv, tier, created_at, response_payload, final_provider, final_value, final_fsd, final_new_max_loan')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const applicationMap = await fetchApplicationsById((cacheRows || []).map((row) => row.application_id));

  const runRows = [];
  const vendorRows = [];

  for (const row of cacheRows || []) {
    const responsePayload = row.response_payload || {};
    const application = row.application_id ? applicationMap.get(row.application_id) : null;
    const quotedInvestor = getQuotedInvestor(application);
    const winnerProvider = mapWinnerProvider(row.final_provider || responsePayload.valuationProvider);
    const providerRows = buildVendorRows(row);
    const runId = randomUUID();

    runRows.push({
      run_id: runId,
      application_id: row.application_id || null,
      anonymous_id: typeof application?.anonymous_id === 'string' ? application.anonymous_id : null,
      quoted_investor: quotedInvestor,
      property_address: row.address,
      property_city: row.city || null,
      property_state: row.state || null,
      property_zipcode: row.zipcode || null,
      property_type: null,
      max_ltv: parseNumber(row.max_ltv),
      tier: row.tier || responsePayload.tier || null,
      cascade_decision: responsePayload.cascadeDecision || null,
      winner_provider: winnerProvider,
      winner_value: getFinalValue(row),
      winner_fsd: getFinalFsd(row),
      winner_new_max_loan: getFinalNewMaxLoan(row),
      cache_hit: false,
      vendor_results_count: providerRows.length,
      completed_successfully: (row.tier || responsePayload.tier || null) !== 'error',
      needs_human: Boolean(responsePayload.needsHuman || responsePayload.needsClearCapital),
      created_at: row.created_at,
      updated_at: row.created_at,
    });

    for (const providerRow of providerRows) {
      vendorRows.push({
        run_id: runId,
        provider: providerRow.provider,
        source: providerRow.source,
        vendor_product: providerRow.vendor_product,
        value: providerRow.value,
        fsd: providerRow.fsd,
        is_winner: providerRow.is_winner,
        failure_message: providerRow.failure_message,
        created_at: providerRow.created_at,
      });
    }
  }

  if (!dryRun) {
    const { error: deleteVendorError } = await supabase
      .from('web_avm_vendor_results')
      .delete()
      .neq('run_id', '00000000-0000-0000-0000-000000000000');
    if (deleteVendorError) throw deleteVendorError;

    const { error: deleteRunError } = await supabase
      .from('web_avm_analytics_runs')
      .delete()
      .neq('run_id', '00000000-0000-0000-0000-000000000000');
    if (deleteRunError) throw deleteRunError;

    for (let i = 0; i < runRows.length; i += 200) {
      const batch = runRows.slice(i, i + 200);
      const { error: insertError } = await supabase.from('web_avm_analytics_runs').insert(batch);
      if (insertError) throw insertError;
    }

    for (let i = 0; i < vendorRows.length; i += 500) {
      const batch = vendorRows.slice(i, i + 500);
      const { error: insertError } = await supabase.from('web_avm_vendor_results').insert(batch);
      if (insertError) throw insertError;
    }
  }

  console.log(JSON.stringify({
    cacheRowsSeen: cacheRows?.length || 0,
    runRowsPrepared: runRows.length,
    vendorRowsPrepared: vendorRows.length,
    dryRun,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
