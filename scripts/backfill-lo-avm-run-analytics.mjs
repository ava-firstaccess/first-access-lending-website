import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const KNOWN_PROVIDERS = [
  'HouseCanary',
  'Clear Capital',
  'Veros',
  'CA Value',
  'Black Knight (Valusure)',
  'CoreLogic',
  'Red Bell',
  'Home Genius',
];

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

function mapOrderProvider(order) {
  if (order?.provider === 'housecanary') return 'HouseCanary';
  if (order?.provider === 'clearcapital') return 'Clear Capital';
  return null;
}

function parseOrderValue(order) {
  const payload = order?.response_payload || {};
  return typeof payload?.value === 'number'
    ? payload.value
    : typeof payload?.estimatedValue === 'number'
      ? payload.estimatedValue
      : null;
}

function parseOrderFsd(order) {
  const payload = order?.response_payload || {};
  if (typeof payload?.fsd === 'number') return payload.fsd;
  if (typeof payload?.forecastStdDev === 'number') return payload.forecastStdDev;
  return null;
}

function parseOrderLink(order) {
  const payload = order?.response_payload || {};
  return typeof payload?.reportLink === 'string' && payload.reportLink.trim()
    ? payload.reportLink.trim()
    : null;
}

function buildProviderRowsFromOrders(orders) {
  const latestByProvider = new Map();
  for (const order of orders) {
    const provider = mapOrderProvider(order);
    if (!provider || latestByProvider.has(provider)) continue;
    latestByProvider.set(provider, order);
  }

  return KNOWN_PROVIDERS.map((provider) => {
    const order = latestByProvider.get(provider) || null;
    const requestedMaxFsd = typeof order?.requested_max_fsd === 'number'
      ? order.requested_max_fsd
      : typeof order?.response_payload?.requestedMaxFsd === 'number'
        ? order.response_payload.requestedMaxFsd
        : null;
    const fsdThresholdStatus = order?.fsd_threshold_status === 'pending' || order?.fsd_threshold_status === 'passed' || order?.fsd_threshold_status === 'failed'
      ? order.fsd_threshold_status
      : order?.response_payload?.fsdThresholdStatus === 'pending' || order?.response_payload?.fsdThresholdStatus === 'passed' || order?.response_payload?.fsdThresholdStatus === 'failed'
        ? order.response_payload.fsdThresholdStatus
        : null;
    return {
      provider,
      supported: Boolean(order),
      maxFsdAllowed: requestedMaxFsd,
      source: order ? 'fresh' : null,
      orderStatus: order?.order_status || null,
      orderRunId: order?.order_run_id || null,
      providerProduct: order?.provider_product || null,
      targetedInvestor: order?.investor || null,
      requestedMaxFsd,
      fsdThresholdStatus,
      value: order ? parseOrderValue(order) : null,
      fsd: order ? parseOrderFsd(order) : null,
      reportLink: order ? parseOrderLink(order) : null,
      failureMessage: order?.response_payload?.errorMessage || null,
    };
  });
}

function providerRowSatisfiesSelectedInvestor(row) {
  if (!row?.supported) return false;
  if (row.orderStatus !== 'completed') return false;
  if (row.value === null) return false;
  if (row.maxFsdAllowed !== null && row.fsd !== null && row.fsd > row.maxFsdAllowed + 0.0001) return false;
  return true;
}

function chooseWinnerProvider(rows) {
  const eligible = rows.filter((row) => providerRowSatisfiesSelectedInvestor(row) && row.value !== null);
  if (eligible.length > 0) {
    return eligible.reduce((best, row) => ((row.value || 0) > (best.value || 0) ? row : best)).provider;
  }

  const supportedWithValue = rows.filter((row) => row.supported && row.orderStatus === 'completed' && row.value !== null);
  if (supportedWithValue.length > 0) {
    return supportedWithValue.reduce((best, row) => ((row.value || 0) > (best.value || 0) ? row : best)).provider;
  }

  const anyWithValue = rows.filter((row) => row.value !== null);
  if (anyWithValue.length > 0) {
    return anyWithValue.reduce((best, row) => ((row.value || 0) > (best.value || 0) ? row : best)).provider;
  }

  return null;
}

function isSyntheticBackfillRow(order) {
  return order?.request_payload?.type === 'housecanary_billing_backfill'
    || order?.response_payload?.backfill === true
    || order?.notes === 'Manual backfill to align HouseCanary cycle count to 28'
    || (order?.loan_officer_prefix === 'system' && order?.address === 'HouseCanary billing backfill');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { data: orders, error } = await supabase
    .from('loan_officer_avm_orders')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const realOrders = (orders || []).filter((order) => !isSyntheticBackfillRow(order));
  const groups = new Map();
  for (const order of realOrders) {
    const key = order.order_run_id || order.id;
    const list = groups.get(key) || [];
    list.push(order);
    groups.set(key, list);
  }

  const runResults = [];
  const providerRowsToInsert = [];

  for (const [runId, group] of groups.entries()) {
    group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const first = group[0];
    const providerRows = buildProviderRowsFromOrders([...group].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    const winnerProvider = chooseWinnerProvider(providerRows);
    const winnerRow = providerRows.find((row) => row.provider === winnerProvider) || null;
    const latestOrderedAt = group
      .map((row) => row.ordered_at || row.created_at)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || null;

    runResults.push({
      run_id: runId,
      order_run_id: first.order_run_id || null,
      loan_officer_prefix: first.loan_officer_prefix,
      loan_officer_email: first.loan_officer_email,
      loan_number: first.loan_number || null,
      investor: first.investor || null,
      engine: first.engine || null,
      program: first.program || null,
      product: first.product || null,
      address_id: first.address_id || null,
      address: first.address,
      city: first.city || null,
      state: first.state || null,
      zipcode: first.zipcode,
      run_source: first.run_source || 'cascade',
      manual_provider_requested: first.run_source === 'manual' ? mapOrderProvider(first) : null,
      cache_only: false,
      cache_hit: false,
      selected_investor_satisfied: null,
      selected_investor_in_flight: null,
      orders_placed_count: group.length,
      winner_provider: winnerProvider,
      winner_source: winnerProvider ? 'fresh' : null,
      winner_provider_product: winnerRow?.providerProduct || null,
      winner_order_run_id: winnerRow?.orderRunId || null,
      winner_order_status: winnerRow?.orderStatus || null,
      winner_value: winnerRow?.value ?? null,
      winner_fsd: winnerRow?.fsd ?? null,
      latest_ordered_at: latestOrderedAt,
      completed_successfully: group.some((row) => row.order_status === 'completed'),
      response_message: 'Backfilled from historical outbound LO AVM orders.',
      created_at: first.created_at,
      updated_at: first.updated_at || first.created_at,
    });

    for (const row of providerRows) {
      if (!row.supported && row.value === null && row.fsd === null && row.orderStatus === null && !row.failureMessage) continue;
      providerRowsToInsert.push({
        run_id: runId,
        provider: row.provider,
        supported: row.supported,
        max_fsd_allowed: row.maxFsdAllowed,
        source: row.source,
        order_status: row.orderStatus,
        order_run_id: row.orderRunId,
        provider_product: row.providerProduct,
        targeted_investor: row.targetedInvestor,
        requested_max_fsd: row.requestedMaxFsd,
        fsd_threshold_status: row.fsdThresholdStatus,
        value: row.value,
        fsd: row.fsd,
        is_winner: row.provider === winnerProvider,
        has_report_link: Boolean(row.reportLink),
        failure_message: row.failureMessage,
        created_at: first.created_at,
      });
    }
  }

  if (!dryRun) {
    const { error: deleteProviderError } = await supabase
      .from('loan_officer_avm_run_providers')
      .delete()
      .neq('run_id', '00000000-0000-0000-0000-000000000000');
    if (deleteProviderError) throw deleteProviderError;

    const { error: deleteRunError } = await supabase
      .from('loan_officer_avm_run_results')
      .delete()
      .neq('run_id', '00000000-0000-0000-0000-000000000000');
    if (deleteRunError) throw deleteRunError;

    for (let i = 0; i < runResults.length; i += 200) {
      const batch = runResults.slice(i, i + 200);
      const { error: insertError } = await supabase.from('loan_officer_avm_run_results').insert(batch);
      if (insertError) throw insertError;
    }

    for (let i = 0; i < providerRowsToInsert.length; i += 500) {
      const batch = providerRowsToInsert.slice(i, i + 500);
      const { error: insertError } = await supabase.from('loan_officer_avm_run_providers').insert(batch);
      if (insertError) throw insertError;
    }
  }

  console.log(JSON.stringify({
    ordersSeen: orders?.length || 0,
    syntheticOrdersSkipped: (orders?.length || 0) - realOrders.length,
    runResultsInserted: runResults.length,
    providerRowsInserted: providerRowsToInsert.length,
    dryRun,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
