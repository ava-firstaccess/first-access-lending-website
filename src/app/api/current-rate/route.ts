import { NextResponse } from 'next/server';
import {
  getMarketRateCache,
  getNextPacificMidnightIso,
  getPacificDateKey,
  isMarketRateCacheFresh,
  upsertMarketRateCache,
} from '@/lib/market-rate-cache';

const CACHE_KEY = 'mortgage_news_daily_rates';

export async function GET() {
  try {
    const cachedRates = await getMarketRateCache(CACHE_KEY);
    if (cachedRates?.payload && isMarketRateCacheFresh(cachedRates)) {
      return NextResponse.json({
        conventional: typeof cachedRates.payload.conventional === 'number' ? cachedRates.payload.conventional : null,
        fha: typeof cachedRates.payload.fha === 'number' ? cachedRates.payload.fha : null,
        va: typeof cachedRates.payload.va === 'number' ? cachedRates.payload.va : null,
        cached: true,
        cacheDate: cachedRates.refresh_date || getPacificDateKey(),
      });
    }

    // Fetch from Mortgage News Daily
    const response = await fetch('https://www.mortgagenewsdaily.com/mortgage-rates', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FirstAccessLending/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch rates');
    }

    const html = await response.text();

    // Extract 30-year fixed conventional rate
    const conventionalMatch = html.match(/30 Yr\. Fixed[^]*?(\d+\.\d+)%/i);
    
    // Extract 30-year FHA rate
    const fhaMatch = html.match(/30 Yr\. FHA[^]*?(\d+\.\d+)%/i);
    
    // Extract 30-year VA rate
    const vaMatch = html.match(/30 Yr\. VA[^]*?(\d+\.\d+)%/i);
    
    const conventionalRate = conventionalMatch ? parseFloat(conventionalMatch[1]) : null;
    const fhaRate = fhaMatch ? parseFloat(fhaMatch[1]) : null;
    const vaRate = vaMatch ? parseFloat(vaMatch[1]) : null;

    if (!conventionalRate && !fhaRate && !vaRate) {
      throw new Error('Could not parse rates from page');
    }
    
    await upsertMarketRateCache({
      cacheKey: CACHE_KEY,
      sourceUrl: 'https://www.mortgagenewsdaily.com/mortgage-rates',
      payload: {
        conventional: conventionalRate,
        fha: fhaRate,
        va: vaRate,
      },
      refreshDate: getPacificDateKey(),
      expiresAt: getNextPacificMidnightIso(),
    });

    return NextResponse.json({ 
      conventional: conventionalRate,
      fha: fhaRate,
      va: vaRate,
      cached: false 
    });

  } catch (error) {
    console.error('Error fetching current rates:', error);
    
    // Send email notification about failure
    try {
      await fetch(process.env.EMAIL_API_URL || 'http://localhost:3000/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'zachbosson@gmail.com',
          subject: 'MND Rate Fetch Failed',
          html: `
            <p>The Mortgage News Daily rate fetch failed.</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Error:</strong> ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <p>Calculator will show blank rates until fetch succeeds or user enters manually.</p>
          `,
          from: 'ava@fal.firstaccesslending.com',
        }),
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }
    
    // Return null if fetch fails - let user enter manually
    return NextResponse.json({ 
      conventional: null,
      fha: null,
      va: null,
      error: 'Failed to fetch current rates',
      cached: false 
    }, { status: 500 });
  }
}
