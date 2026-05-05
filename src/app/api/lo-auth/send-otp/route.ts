import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashOtpCode } from '@/lib/otp';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { findLoanOfficerPortalUser, getRequestHost, isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';
import { requireTrustedBrowserRequest } from '@/lib/application-session';

const SEND_OTP_USER_LIMIT = 3;
const SEND_OTP_IP_LIMIT = 10;
const SEND_OTP_WINDOW_SECONDS = 5 * 60;

export async function POST(req: NextRequest) {
  try {
    const trusted = requireTrustedBrowserRequest(req);
    if (trusted) return trusted;
    if (!isLoanOfficerPortalHost(getRequestHost(req))) {
      return NextResponse.json({ error: 'Loan Officer portal host required.' }, { status: 403 });
    }

    const { identifier } = await req.json();
    const user = await findLoanOfficerPortalUser(String(identifier || ''));
    if (!user) {
      return NextResponse.json({ error: 'Unknown loan officer login.' }, { status: 404 });
    }

    const email = user.email.trim().toLowerCase();
    const clientIp = getClientIp(req);
    const [userRate, ipRate] = await Promise.all([
      consumeRateLimit({ scope: 'lo-send-otp:user', key: user.prefix, limit: SEND_OTP_USER_LIMIT, windowSeconds: SEND_OTP_WINDOW_SECONDS }),
      consumeRateLimit({ scope: 'lo-send-otp:ip', key: clientIp, limit: SEND_OTP_IP_LIMIT, windowSeconds: SEND_OTP_WINDOW_SECONDS }),
    ]);

    if (!userRate.allowed || !ipRate.allowed) {
      const retryAfterSeconds = Math.max(userRate.retryAfterSeconds, ipRate.retryAfterSeconds);
      return NextResponse.json(
        { error: 'Too many attempts. Please wait before requesting another code.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const codeHash = hashOtpCode(email, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const supabase = getSupabaseAdmin();

    await supabase.from('otp_codes').update({ used: true }).eq('phone', email).eq('used', false);

    const { error: insertError } = await supabase.from('otp_codes').insert({
      phone: email,
      code: codeHash,
      expires_at: expiresAt,
      used: false,
      attempts: 0,
    });

    if (insertError) {
      console.error('LO OTP insert error:', insertError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'First Access Lending <noreply@firstaccesslending.com>',
        to: [email],
        subject: 'Your First Access Lending portal verification code',
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a"><p>Your First Access Lending Loan Officer portal verification code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p><p>This code expires in 10 minutes.</p></div>`,
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text().catch(() => '');
      console.error('LO OTP email send failed:', {
        status: emailResponse.status,
        body: errorBody.slice(0, 1000),
        to: email,
      });
      await supabase.from('otp_codes').update({ used: true }).eq('phone', email).eq('code', codeHash).eq('used', false);
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email,
    });
  } catch {
    console.error('LO send OTP error');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
