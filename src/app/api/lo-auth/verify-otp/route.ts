import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizePhone, verifyOtpCode } from '@/lib/otp';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { createLoanOfficerPortalSession, findLoanOfficerPortalUser, getRequestHost, isLoanOfficerPortalHost, setLoanOfficerPortalSessionCookie } from '@/lib/lo-portal-auth';
import { requireTrustedBrowserRequest } from '@/lib/application-session';

const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_OTP_USER_LIMIT = 10;
const VERIFY_OTP_IP_LIMIT = 25;
const VERIFY_OTP_WINDOW_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    const trusted = requireTrustedBrowserRequest(req);
    if (trusted) return trusted;
    if (!isLoanOfficerPortalHost(getRequestHost(req))) {
      return NextResponse.json({ error: 'Loan Officer portal host required.' }, { status: 403 });
    }

    const { identifier, code } = await req.json();
    const user = await findLoanOfficerPortalUser(String(identifier || ''));
    if (!user || !code) {
      return NextResponse.json({ error: 'Login and code required.' }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(user.phone);
    const clientIp = getClientIp(req);
    const [userRate, ipRate] = await Promise.all([
      consumeRateLimit({ scope: 'lo-verify-otp:user', key: user.prefix, limit: VERIFY_OTP_USER_LIMIT, windowSeconds: VERIFY_OTP_WINDOW_SECONDS }),
      consumeRateLimit({ scope: 'lo-verify-otp:ip', key: clientIp, limit: VERIFY_OTP_IP_LIMIT, windowSeconds: VERIFY_OTP_WINDOW_SECONDS }),
    ]);

    if (!userRate.allowed || !ipRate.allowed) {
      const retryAfterSeconds = Math.max(userRate.retryAfterSeconds, ipRate.retryAfterSeconds);
      return NextResponse.json(
        { error: 'Too many verification attempts. Please request a new code shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return NextResponse.json({ error: 'No verification code found. Request a new one.' }, { status: 400 });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);
      return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
    }

    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);
      return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
    }

    if (!verifyOtpCode(normalizedPhone, String(code), otpRecord.code)) {
      await supabase.from('otp_codes').update({ attempts: otpRecord.attempts + 1 }).eq('id', otpRecord.id);
      const remaining = MAX_VERIFY_ATTEMPTS - otpRecord.attempts - 1;
      return NextResponse.json(
        { error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
        { status: 400 }
      );
    }

    await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);

    const response = NextResponse.json({
      success: true,
      prefix: user.prefix,
      email: user.email,
      name: user.name || null,
    });
    setLoanOfficerPortalSessionCookie(response, createLoanOfficerPortalSession(user));
    return response;
  } catch {
    console.error('LO verify OTP error');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
