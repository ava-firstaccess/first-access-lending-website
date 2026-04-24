import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const APPLICATION_SESSION_TTL_MINUTES = 30;

export function getApplicationSessionExpiryIso(now = Date.now()) {
  return new Date(now + APPLICATION_SESSION_TTL_MINUTES * 60 * 1000).toISOString();
}

export function buildSessionErrorResponse(message = 'Session expired. Please verify again.') {
  const response = NextResponse.json({ error: message }, { status: 401 });
  response.cookies.set('session_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
  return response;
}

export async function getAuthenticatedApplication<TSelect extends string>(req: NextRequest, select: TSelect) {
  const sessionToken = req.cookies.get('session_token')?.value;
  if (!sessionToken) {
    return { response: buildSessionErrorResponse('Not authenticated') } as const;
  }

  const supabase = getSupabaseAdmin();
  const { data: app, error } = await supabase
    .from('applications')
    .select(select)
    .eq('session_token', sessionToken)
    .single();

  if (error || !app) {
    return { response: buildSessionErrorResponse('Session expired. Please verify again.') } as const;
  }

  const sessionExpiresAt = (app as { session_expires_at?: string | null }).session_expires_at || null;
  if (!sessionExpiresAt || new Date(sessionExpiresAt).getTime() <= Date.now()) {
    const appId = (app as { id?: string | null }).id || null;
    if (appId) {
      await supabase
        .from('applications')
        .update({ session_token: null, session_expires_at: null, updated_at: new Date().toISOString() })
        .eq('id', appId);
    }
    return { response: buildSessionErrorResponse('Session expired. Please verify again.') } as const;
  }

  return { supabase, app, sessionToken } as const;
}
