import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// In-memory rate limiting (per-process; swap for Upstash later)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phone, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    // Rate limit
    if (isRateLimited(normalized)) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait 5 minutes.' },
        { status: 429 }
      );
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
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
        code,
        expires_at: expiresAt,
        used: false,
        attempts: 0
      });

    if (insertError) {
      console.error('OTP insert error:', insertError);
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    // Send via GHL webhook
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
      console.error('GHL webhook failed:', smsResponse.status, await smsResponse.text());
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent',
      // Don't expose the phone back in production; masking for UX
      phoneMask: normalized.slice(0, -4).replace(/\d/g, '*') + normalized.slice(-4)
    });

  } catch (err) {
    console.error('Send OTP error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
