import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Get application data (authenticated via session cookie)
export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: app, error } = await supabase
      .from('applications')
      .select('id, phone, form_data, stage, status, created_at, updated_at')
      .eq('session_token', sessionToken)
      .single();

    if (error || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({ application: app });

  } catch (err) {
    console.error('Get application error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Save application data (partial updates)
export async function PATCH(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { formData, stage } = await req.json();

    const supabase = getSupabaseAdmin();

    // Find application by session token
    const { data: app, error: findError } = await supabase
      .from('applications')
      .select('id, form_data')
      .eq('session_token', sessionToken)
      .single();

    if (findError || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Merge form data (partial update)
    const mergedData = { ...(app.form_data || {}), ...(formData || {}) };

    const { error: updateError } = await supabase
      .from('applications')
      .update({
        form_data: mergedData,
        stage: stage || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', app.id);

    if (updateError) {
      console.error('Application update error:', updateError);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedAt: new Date().toISOString() });

  } catch (err) {
    console.error('Save application error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
