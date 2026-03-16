import { NextResponse } from 'next/server';

let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  try {
    // Return cached rate if fresh
    if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
      return NextResponse.json({ rate: cachedRate.rate, cached: true });
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

    // Extract 30-year fixed rate from the page
    // Pattern: <span>6.41%</span> or similar in the 30 YR Fixed section
    const rateMatch = html.match(/30 Yr\. Fixed[^]*?(\d+\.\d+)%/i);
    
    if (rateMatch && rateMatch[1]) {
      const rate = parseFloat(rateMatch[1]);
      
      // Cache the result
      cachedRate = {
        rate,
        timestamp: Date.now(),
      };

      return NextResponse.json({ rate, cached: false });
    }

    // Fallback if parsing fails
    throw new Error('Could not parse rate from page');

  } catch (error) {
    console.error('Error fetching current rate:', error);
    
    // Return fallback rate if fetch fails
    return NextResponse.json({ 
      rate: 6.5, // Conservative fallback
      error: 'Failed to fetch current rate',
      cached: false 
    });
  }
}
