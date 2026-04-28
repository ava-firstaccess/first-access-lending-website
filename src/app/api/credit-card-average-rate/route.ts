import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const CACHE_KEY = 'credit_card_average_interest_rate';
const SOURCE_URL = 'https://fred.stlouisfed.org/series/TERMCBCCINTNS';
const CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=TERMCBCCINTNS';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseLatestFredValue(csv: string) {
  const lines = csv.trim().split(/\r?\n/).slice(1);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const [date, rawValue] = lines[i].split(',');
    const value = Number(rawValue);
    if (date && Number.isFinite(value)) {
      return { date, value };
    }
  }

  throw new Error('Could not parse TERMCBCCINTNS from FRED CSV.');
}

export async function GET() {
  const cacheDate = getTodayKey();

  try {
    const supabase = getSupabaseAdmin();
    const { data: cached, error: cacheError } = await supabase
      .from('market_rate_cache')
      .select('cache_date, value_numeric, payload, updated_at')
      .eq('cache_key', CACHE_KEY)
      .eq('cache_date', cacheDate)
      .maybeSingle();

    if (cacheError) {
      console.warn('market_rate_cache lookup failed:', cacheError.message);
    }

    if (cached?.value_numeric !== null && cached?.value_numeric !== undefined) {
      return NextResponse.json({
        rate: Number(cached.value_numeric),
        averageLabel: `${Number(cached.value_numeric).toFixed(2)}%`,
        source: SOURCE_URL,
        sourceSeries: 'TERMCBCCINTNS',
        cached: true,
        cacheDate,
        observedDate: cached.payload?.observedDate || null,
        updatedAt: cached.updated_at || null,
      });
    }

    const response = await fetch(CSV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FirstAccessLending/1.0)',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch FRED data (${response.status}).`);
    }

    const csv = await response.text();
    const parsed = parseLatestFredValue(csv);

    const payload = {
      observedDate: parsed.date,
      value: parsed.value,
      sourceUrl: SOURCE_URL,
      series: 'TERMCBCCINTNS',
    };

    const { error: upsertError } = await supabase.from('market_rate_cache').upsert(
      {
        cache_key: CACHE_KEY,
        cache_date: cacheDate,
        value_numeric: parsed.value,
        source_url: SOURCE_URL,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cache_key,cache_date' }
    );

    if (upsertError) {
      console.warn('market_rate_cache upsert failed:', upsertError.message);
    }

    return NextResponse.json({
      rate: parsed.value,
      averageLabel: `${parsed.value.toFixed(2)}%`,
      source: SOURCE_URL,
      sourceSeries: 'TERMCBCCINTNS',
      cached: false,
      cacheDate,
      observedDate: parsed.date,
    });
  } catch (error) {
    console.error('Error fetching average credit card rate:', error);
    return NextResponse.json(
      {
        rate: null,
        averageLabel: null,
        source: SOURCE_URL,
        sourceSeries: 'TERMCBCCINTNS',
        cached: false,
        error: error instanceof Error ? error.message : 'Failed to fetch average credit card rate.',
      },
      { status: 500 }
    );
  }
}
