import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const MAX_VERIFY_ATTEMPTS = 5;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and code required' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
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
    if (otpRecord.code !== code.trim()) {
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
        .update({ session_token: sessionToken, updated_at: new Date().toISOString() })
        .eq('id', applicationId);
    } else {
      // Create new application
      const { data: newApp, error: createError } = await supabase
        .from('applications')
        .insert({
          phone: normalized,
          session_token: sessionToken,
          status: 'in_progress',
          form_data: {},
          stage: 'stage2'
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
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    return response;

  } catch (err) {
    console.error('Verify OTP error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
