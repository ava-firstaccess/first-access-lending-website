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
            <p>Calculator will show blank rate until fetch succeeds or user enters manually.</p>
          `,
          from: 'ava@fal.firstaccesslending.com',
        }),
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }
    
    // Return null if fetch fails - let user enter manually
    return NextResponse.json({ 
      rate: null,
      error: 'Failed to fetch current rate',
      cached: false 
    }, { status: 500 });
  }
}
