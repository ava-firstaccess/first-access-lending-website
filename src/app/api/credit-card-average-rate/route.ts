import { NextResponse } from 'next/server';
import {
  getMarketRateCache,
  getNextPacificMidnightIso,
  getPacificDateKey,
  isMarketRateCacheFresh,
  upsertMarketRateCache,
} from '@/lib/market-rate-cache';

const CACHE_KEY = 'credit_card_average_interest_rate';
const SOURCE_URL = 'https://fred.stlouisfed.org/series/TERMCBCCINTNS';
const CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=TERMCBCCINTNS';

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
  const cacheDate = getPacificDateKey();

  try {
    const cached = await getMarketRateCache(CACHE_KEY);

    if (cached?.value_numeric !== null && cached?.value_numeric !== undefined && isMarketRateCacheFresh(cached)) {
      return NextResponse.json({
        rate: Number(cached.value_numeric),
        averageLabel: `${Number(cached.value_numeric).toFixed(2)}%`,
        source: SOURCE_URL,
        sourceSeries: 'TERMCBCCINTNS',
        cached: true,
        cacheDate: cached.refresh_date || cacheDate,
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

    await upsertMarketRateCache({
      cacheKey: CACHE_KEY,
      valueNumeric: parsed.value,
      sourceUrl: SOURCE_URL,
      payload,
      refreshDate: cacheDate,
      expiresAt: getNextPacificMidnightIso(),
    });

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
