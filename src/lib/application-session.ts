import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const APPLICATION_SESSION_TTL_MINUTES = 30;

function getRequestHost(req: NextRequest) {
  return (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(':')[0].toLowerCase();
}

function isAllowedOriginHost(originHost: string, requestHost: string) {
  if (!originHost || !requestHost) return false;
  if (originHost === requestHost) return true;

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://first-access-lending-website.vercel.app',
    'https://pricer.firstaccesslending.com',
  ].filter(Boolean);

  return allowedOrigins.some((origin) => {
    try {
      return new URL(origin as string).host.toLowerCase() === originHost;
    } catch {
      return false;
    }
  });
}

export function requireTrustedBrowserRequest(req: NextRequest) {
  const fetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    return NextResponse.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 });
  }

  const origin = req.headers.get('origin');
  if (!origin) return null;

  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = getRequestHost(req);
    if (!isAllowedOriginHost(originHost, requestHost)) {
      return NextResponse.json({ error: 'Untrusted origin.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid origin.' }, { status: 403 });
  }

  return null;
}

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

export async function getAuthenticatedApplication(req: NextRequest, select: string) {
  const sessionToken = req.cookies.get('session_token')?.value;
  if (!sessionToken) {
    return { response: buildSessionErrorResponse('Not authenticated') } as const;
  }

  const supabase = getSupabaseAdmin();
  const applicationQuery = (supabase as any)
    .from('applications')
    .select(select)
    .eq('session_token', sessionToken)
    .single();
  const { data: app, error } = await applicationQuery;

  if (error || !app) {
    return { response: buildSessionErrorResponse('Session expired. Please verify again.') } as const;
  }

  const typedApp = app as Record<string, unknown>;
  const sessionExpiresAt = typeof typedApp.session_expires_at === 'string' ? typedApp.session_expires_at : null;
  if (!sessionExpiresAt || new Date(sessionExpiresAt).getTime() <= Date.now()) {
    const appId = typeof typedApp.id === 'string' ? typedApp.id : null;
    if (appId) {
      await (supabase as any)
        .from('applications')
        .update({ session_token: null, session_expires_at: null, updated_at: new Date().toISOString() })
        .eq('id', appId);
    }
    return { response: buildSessionErrorResponse('Session expired. Please verify again.') } as const;
  }

  return { supabase, app: typedApp, sessionToken } as const;
}
