import { NextRequest, NextResponse } from 'next/server';
import { mergeSanitizedApplicationFormData } from '@/lib/application-data';
import { getApplicationBySessionToken, getAuthenticatedApplication, requireTrustedBrowserRequest } from '@/lib/application-session';

// Get application data (authenticated via session cookie)
export async function GET(req: NextRequest) {
  try {
    const trusted = requireTrustedBrowserRequest(req);
    if (trusted) return trusted;

    const params = req.nextUrl.searchParams;
    const querySessionToken = params.get('sessionToken') || '';
    const queryApplicationId = params.get('applicationId') || '';
    const auth = querySessionToken
      ? await getApplicationBySessionToken(
          querySessionToken,
          'id, phone, form_data, stage, status, created_at, updated_at, session_expires_at'
        )
      : await getAuthenticatedApplication(
          req,
          'id, phone, form_data, stage, status, created_at, updated_at, session_expires_at'
        );
    if ('response' in auth) return auth.response;

    if (queryApplicationId && auth.app.id !== queryApplicationId) {
      return NextResponse.json({ error: 'Application/session mismatch.' }, { status: 401 });
    }

    const { session_expires_at: _sessionExpiresAt, ...application } = auth.app as Record<string, unknown>;
    const response = NextResponse.json({ application });

    if (querySessionToken && !req.cookies.get('session_token')?.value) {
      // TODO(launch): remove this query-token cookie bootstrap after direct step testing is no longer needed.
      response.cookies.set('session_token', querySessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return response;

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
    const mergedData = mergeSanitizedApplicationFormData(app.form_data, formData);

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
