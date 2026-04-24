import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hashOtpCode, normalizePhone } from '@/lib/otp';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';

const SEND_OTP_PHONE_LIMIT = 3;
const SEND_OTP_IP_LIMIT = 10;
const SEND_OTP_WINDOW_SECONDS = 5 * 60;

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    const clientIp = getClientIp(req);
    const [phoneRate, ipRate] = await Promise.all([
      consumeRateLimit({
        scope: 'send-otp:phone',
        key: normalized,
        limit: SEND_OTP_PHONE_LIMIT,
        windowSeconds: SEND_OTP_WINDOW_SECONDS,
      }),
      consumeRateLimit({
        scope: 'send-otp:ip',
        key: clientIp,
        limit: SEND_OTP_IP_LIMIT,
        windowSeconds: SEND_OTP_WINDOW_SECONDS,
      }),
    ]);

    if (!phoneRate.allowed || !ipRate.allowed) {
      const retryAfterSeconds = Math.max(phoneRate.retryAfterSeconds, ipRate.retryAfterSeconds);
      return NextResponse.json(
        { error: 'Too many attempts. Please wait before requesting another code.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds),
          },
        }
      );
    }

    // Generate 4-digit code
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const codeHash = hashOtpCode(normalized, code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    const supabase = getSupabaseAdmin();

    // Invalidate any existing codes for this phone
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq('phone', normalized)
      .eq('used', false);

    // Store new code
    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        phone: normalized,
        code: codeHash,
        expires_at: expiresAt,
        used: false,
        attempts: 0
      });

    if (insertError) {
      console.error('OTP insert error:', insertError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    // Send via GHL SMS webhook (Blooio ready but needs device linked - see getaccess/api docs/)
    const webhookUrl = process.env.GHL_SMS_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('GHL_SMS_WEBHOOK_URL not configured');
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 500 });
    }

    const smsResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: normalized,
        text: `Your First Access verification code is ${code}. Expires in 5 minutes.`
      })
    });

    if (!smsResponse.ok) {
      console.error('GHL webhook failed:', { status: smsResponse.status });
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent',
      // Don't expose the phone back in production; masking for UX
      phoneMask: normalized.slice(0, -4).replace(/\d/g, '*') + normalized.slice(-4)
    });

  } catch (err) {
    console.error('Send OTP error');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
