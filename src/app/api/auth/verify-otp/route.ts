import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { getApplicationSessionExpiryIso, hashApplicationSessionToken } from '@/lib/application-session';
import { normalizePhone, verifyOtpCode } from '@/lib/otp';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_OTP_PHONE_LIMIT = 10;
const VERIFY_OTP_IP_LIMIT = 25;
const VERIFY_OTP_WINDOW_SECONDS = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const clientIp = getClientIp(req);
    const [phoneRate, ipRate] = await Promise.all([
      consumeRateLimit({
        scope: 'verify-otp:phone',
        key: normalized,
        limit: VERIFY_OTP_PHONE_LIMIT,
        windowSeconds: VERIFY_OTP_WINDOW_SECONDS,
      }),
      consumeRateLimit({
        scope: 'verify-otp:ip',
        key: clientIp,
        limit: VERIFY_OTP_IP_LIMIT,
        windowSeconds: VERIFY_OTP_WINDOW_SECONDS,
      }),
    ]);

    if (!phoneRate.allowed || !ipRate.allowed) {
      const retryAfterSeconds = Math.max(phoneRate.retryAfterSeconds, ipRate.retryAfterSeconds);
      return NextResponse.json(
        { error: 'Too many verification attempts. Please request a new code shortly.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    const supabase = getSupabaseAdmin();

    // Find the most recent unused code for this phone
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', normalized)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return NextResponse.json({ error: 'No verification code found. Request a new one.' }, { status: 400 });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);
      return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
    }

    // Check max attempts
    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);
      return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
    }

    // Verify code
    if (!verifyOtpCode(normalized, code, otpRecord.code)) {
      // Increment attempts
      await supabase
        .from('otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);
      
      const remaining = MAX_VERIFY_ATTEMPTS - otpRecord.attempts - 1;
      return NextResponse.json(
        { error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
        { status: 400 }
      );
    }

    // Code is correct - mark as used
    await supabase.from('otp_codes').update({ used: true }).eq('id', otpRecord.id);

    // Create or find the application session
    const sessionToken = randomUUID();
    const sessionTokenHash = hashApplicationSessionToken(sessionToken);

    // Find existing application for this phone, or create new
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('phone', normalized)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    let applicationId: string;

    if (existingApp) {
      applicationId = existingApp.id;
      // Update session token
      await supabase
        .from('applications')
        .update({
          session_token: null,
          session_token_hash: sessionTokenHash,
          session_expires_at: getApplicationSessionExpiryIso(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);
    } else {
      // Create new application
      const { data: newApp, error: createError } = await supabase
        .from('applications')
        .insert({
          phone: normalized,
          session_token: null,
          session_token_hash: sessionTokenHash,
          status: 'in_progress',
          form_data: {},
          stage: 'stage2',
          session_expires_at: getApplicationSessionExpiryIso()
        })
        .select('id')
        .single();

      if (createError || !newApp) {
        console.error('Application create error:', createError);
        return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
      }
      applicationId = newApp.id;
    }

    // Set session cookie
    const response = NextResponse.json({
      success: true,
      applicationId,
      resumed: !!existingApp
    });

    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return response;

  } catch (err) {
    console.error('Verify OTP error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
