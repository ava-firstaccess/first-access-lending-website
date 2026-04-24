import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApplication, requireTrustedBrowserRequest } from '@/lib/application-session';

// Get application data (authenticated via session cookie)
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedApplication(
      req,
      'id, phone, form_data, stage, status, created_at, updated_at, session_expires_at'
    );
    if ('response' in auth) return auth.response;

    const { session_expires_at: _sessionExpiresAt, ...application } = auth.app as Record<string, unknown>;
    return NextResponse.json({ application });

  } catch (err) {
    console.error('Get application error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Save application data (partial updates)
export async function PATCH(req: NextRequest) {
  try {
    const trusted = requireTrustedBrowserRequest(req);
    if (trusted) return trusted;

    const auth = await getAuthenticatedApplication(req, 'id, form_data, session_expires_at');
    if ('response' in auth) return auth.response;

    const { formData, stage } = await req.json();
    const { supabase, app } = auth;

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
