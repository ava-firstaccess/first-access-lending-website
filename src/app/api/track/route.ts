import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Real-time application tracking - saves progress on each step transition.
 * Supports both anonymous (Stage 1) and authenticated (Stage 2) users.
 * 
 * Anonymous tracking uses a phone placeholder with the anonymousId embedded,
 * since the `phone` column is NOT NULL. Format: `anon:<uuid>`
 * When user later verifies via OTP, we can link their anonymous record.
 * 
 * Tracking metadata (referrer, userAgent, stepHistory) stored inside form_data JSONB
 * under `_tracking` key to avoid schema changes.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { anonymousId, formData, currentStep, stepNumber, totalSteps, referrer, userAgent } = body;

    const sessionToken = req.cookies.get('session_token')?.value;
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Build tracking metadata to embed in form_data
    const trackingMeta = {
      currentStep,
      stepNumber,
      totalSteps,
      lastActiveAt: now,
      referrer: referrer || undefined,
      userAgent: userAgent || undefined,
    };

    // Authenticated user (has session from OTP)
    if (sessionToken) {
      const { data: app } = await supabase
        .from('applications')
        .select('id, form_data')
        .eq('session_token', sessionToken)
        .single();

      if (app) {
        const mergedData = { ...(app.form_data || {}), ...(formData || {}), _tracking: trackingMeta };

        await supabase
          .from('applications')
          .update({
            form_data: mergedData,
            stage: currentStep || undefined,
            updated_at: now,
          })
          .eq('id', app.id);

        return NextResponse.json({ success: true, applicationId: app.id, mode: 'authenticated' });
      }
    }

    // Anonymous user - use anonymousId
    if (!anonymousId) {
      return NextResponse.json({ error: 'anonymousId required for anonymous tracking' }, { status: 400 });
    }

    // Anonymous phone placeholder (NOT NULL constraint workaround)
    const anonPhone = `anon:${anonymousId}`;

    // Check for existing anonymous application by phone placeholder
    const { data: existing } = await supabase
      .from('applications')
      .select('id, form_data')
      .eq('phone', anonPhone)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      const mergedData = { ...(existing.form_data || {}), ...(formData || {}), _tracking: trackingMeta };

      await supabase
        .from('applications')
        .update({
          form_data: mergedData,
          stage: currentStep || undefined,
          updated_at: now,
        })
        .eq('id', existing.id);

      return NextResponse.json({ success: true, applicationId: existing.id, mode: 'anonymous-update' });
    } else {
      const initialData = { ...(formData || {}), _tracking: { ...trackingMeta, createdAt: now } };

      const { data: newApp, error: createError } = await supabase
        .from('applications')
        .insert({
          phone: anonPhone,
          status: 'in_progress',
          form_data: initialData,
          stage: currentStep || 'stage1:start',
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Track create error:', createError);
        return NextResponse.json({ error: 'Failed to create tracking record' }, { status: 500 });
      }

      return NextResponse.json({ success: true, applicationId: newApp?.id, mode: 'anonymous-new' });
    }

  } catch (err: any) {
    console.error('Track error:', err);
    return NextResponse.json({ error: err.message || 'Tracking failed' }, { status: 500 });
  }
}
