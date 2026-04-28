import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getApplicationSessionExpiryIso, hashApplicationSessionToken, requireTrustedBrowserRequest } from '@/lib/application-session';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const trusted = requireTrustedBrowserRequest(req);
    if (trusted) return trusted;

    // TODO(launch): remove this test-session bootstrap route after direct step testing is no longer needed.
    if (process.env.NEXT_PUBLIC_SKIP_OTP !== 'true') {
      return NextResponse.json({ error: 'Test session bootstrap is disabled.' }, { status: 403 });
    }

    const body = await req.json();
    const formData = (body?.formData && typeof body.formData === 'object') ? body.formData : {};
    const stage = typeof body?.stage === 'string' ? body.stage : 'stage2';
    const phone = typeof formData.phone === 'string'
      ? formData.phone
      : typeof formData['Borrower - Phone'] === 'string'
        ? formData['Borrower - Phone']
        : null;

    const sessionToken = randomBytes(24).toString('hex');
    const sessionTokenHash = hashApplicationSessionToken(sessionToken);
    const supabase = getSupabaseAdmin();

    const { data: app, error } = await supabase
      .from('applications')
      .insert({
        phone,
        status: 'in_progress',
        form_data: formData,
        stage,
        session_token: null,
        session_token_hash: sessionTokenHash,
        session_expires_at: getApplicationSessionExpiryIso(),
      })
      .select('id')
      .single();

    if (error || !app) {
      console.error('Test session bootstrap error:', error);
      return NextResponse.json({ error: 'Failed to create test session.' }, { status: 500 });
    }

    const response = NextResponse.json({ success: true, applicationId: app.id, sessionToken });
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Test session bootstrap failed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
