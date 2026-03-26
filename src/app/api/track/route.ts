import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Real-time application tracking - saves progress on each step transition.
 * Supports both anonymous (Stage 1) and authenticated (Stage 2) users.
 * 
 * Two tables:
 * - analytics_events: permanent, one row per step (conversion funnel)
 * - applications: ephemeral (30-day retention), stores full form data
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { anonymousId, formData, currentStep, stepNumber, totalSteps, referrer, userAgent } = body;

    const sessionToken = req.cookies.get('session_token')?.value;
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // ── 1. Write permanent analytics event (survives 30-day retention) ──
    const [stage, stepName] = (currentStep || ':').split(':');
    supabase
      .from('analytics_events')
      .insert({
        anonymous_id: anonymousId || sessionToken || 'unknown',
        session_stage: stage || 'unknown',
        step_name: stepName || 'unknown',
        step_number: stepNumber ?? null,
        total_steps: totalSteps ?? null,
        referrer: referrer || null,
        user_agent: userAgent || null,
      })
      .then(({ error }) => {
        if (error) console.error('Analytics insert error (non-fatal):', error.message);
      });

    // ── 2. Update ephemeral applications table with form data ──

    // Authenticated user (has session from OTP)
    if (sessionToken) {
      const { data: app } = await supabase
        .from('applications')
        .select('id, form_data')
        .eq('session_token', sessionToken)
        .single();

      if (app) {
        const mergedData = { ...(app.form_data || {}), ...(formData || {}) };

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

    // Anonymous user - use proper anonymous_id column
    if (!anonymousId) {
      return NextResponse.json({ error: 'anonymousId required for anonymous tracking' }, { status: 400 });
    }

    // Find existing anonymous application
    const { data: existing } = await supabase
      .from('applications')
      .select('id, form_data')
      .eq('anonymous_id', anonymousId)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      const mergedData = { ...(existing.form_data || {}), ...(formData || {}) };

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
      const { data: newApp, error: createError } = await supabase
        .from('applications')
        .insert({
          anonymous_id: anonymousId,
          status: 'in_progress',
          form_data: formData || {},
          stage: currentStep || 'stage1:start',
          referrer: referrer || null,
          user_agent: userAgent || null,
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
