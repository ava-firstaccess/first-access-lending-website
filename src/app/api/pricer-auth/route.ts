import { NextRequest, NextResponse } from 'next/server';
import { buildPricerAuthToken, isPricerConfigured, PRICER_AUTH_COOKIE, verifyPricerPassword } from '@/lib/pricer-auth';

export async function POST(req: NextRequest) {
  try {
    if (!isPricerConfigured()) {
      return NextResponse.json({ error: 'Pricer password is not configured.' }, { status: 503 });
    }

    const { password } = await req.json();
    if (!verifyPricerPassword(String(password || ''))) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(PRICER_AUTH_COOKIE, buildPricerAuthToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Pricer auth failed', error);
    return NextResponse.json({ error: 'Unable to unlock pricer.' }, { status: 500 });
  }
}
