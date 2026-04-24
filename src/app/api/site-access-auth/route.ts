import { NextRequest, NextResponse } from 'next/server';
import { buildSiteAccessToken, isSiteAccessConfigured, SITE_ACCESS_COOKIE, verifySiteAccessPassword } from '@/lib/site-access';

export async function POST(req: NextRequest) {
  try {
    if (!isSiteAccessConfigured()) {
      return NextResponse.json({ error: 'Site access password is not configured.' }, { status: 503 });
    }

    const { password } = await req.json();
    if (!verifySiteAccessPassword(String(password || ''))) {
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(SITE_ACCESS_COOKIE, buildSiteAccessToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 12 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Site access auth failed', error);
    return NextResponse.json({ error: 'Unable to unlock site.' }, { status: 500 });
  }
}
