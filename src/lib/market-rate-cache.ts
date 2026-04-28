import { getSupabaseAdmin } from '@/lib/supabase';

export interface MarketRateCacheRecord {
  cache_key: string;
  refresh_date: string | null;
  expires_at: string | null;
  value_numeric: number | null;
  payload: Record<string, unknown> | null;
  source_url: string | null;
  updated_at: string | null;
}

function getPacificDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not derive Pacific date parts.');
  }

  return { year, month, day };
}

export function getPacificDateKey(date = new Date()) {
  const { year, month, day } = getPacificDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getNextPacificMidnightIso(date = new Date()) {
  const { year, month, day } = getPacificDateParts(date);
  const pacificMidnightUtc = new Date(`${year}-${month}-${day}T08:00:00.000Z`);
  pacificMidnightUtc.setUTCDate(pacificMidnightUtc.getUTCDate() + 1);
  return pacificMidnightUtc.toISOString();
}

export async function getMarketRateCache(cacheKey: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('market_rate_cache')
    .select('cache_key, refresh_date, expires_at, value_numeric, payload, source_url, updated_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) {
    console.warn(`market_rate_cache lookup failed for ${cacheKey}:`, error.message);
    return null;
  }

  return (data as MarketRateCacheRecord | null) || null;
}

export function isMarketRateCacheFresh(entry: MarketRateCacheRecord | null, now = new Date()) {
  if (!entry?.expires_at) return false;
  const expiresAt = new Date(entry.expires_at);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export async function upsertMarketRateCache(params: {
  cacheKey: string;
  valueNumeric?: number | null;
  payload?: Record<string, unknown> | null;
  sourceUrl?: string | null;
  refreshDate?: string;
  expiresAt?: string;
}) {
  const supabase = getSupabaseAdmin();
  const refreshDate = params.refreshDate || getPacificDateKey();
  const expiresAt = params.expiresAt || getNextPacificMidnightIso();

  const { error } = await supabase.from('market_rate_cache').upsert(
    {
      cache_key: params.cacheKey,
      refresh_date: refreshDate,
      expires_at: expiresAt,
      value_numeric: params.valueNumeric ?? null,
      payload: params.payload ?? null,
      source_url: params.sourceUrl ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cache_key' }
  );

  if (error) {
    console.warn(`market_rate_cache upsert failed for ${params.cacheKey}:`, error.message);
  }
}
