import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashOtpCode, normalizePhone } from '@/lib/otp';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { findLoanOfficerPortalUser, getRequestHost, isLoanOfficerPortalHost, maskPhone } from '@/lib/lo-portal-auth';
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
    const user = findLoanOfficerPortalUser(String(identifier || ''));
    if (!user) {
      return NextResponse.json({ error: 'Unknown loan officer login.' }, { status: 404 });
    }

    const normalizedPhone = normalizePhone(user.phone);
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
    const codeHash = hashOtpCode(normalizedPhone, code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const supabase = getSupabaseAdmin();

    await supabase.from('otp_codes').update({ used: true }).eq('phone', normalizedPhone).eq('used', false);

    const { error: insertError } = await supabase.from('otp_codes').insert({
      phone: normalizedPhone,
      code: codeHash,
      expires_at: expiresAt,
      used: false,
      attempts: 0,
    });

    if (insertError) {
      console.error('LO OTP insert error:', insertError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    const webhookUrl = process.env.GHL_SMS_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('GHL_SMS_WEBHOOK_URL not configured');
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
    }

    const smsResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: normalizedPhone,
        text: `Your First Access Lending LO portal verification code is ${code}. Expires in 5 minutes.`
      })
    });

    if (!smsResponse.ok) {
      console.error('LO OTP SMS webhook failed:', { status: smsResponse.status });
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email: user.email,
      phoneMask: maskPhone(normalizedPhone),
    });
  } catch {
    console.error('LO send OTP error');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
