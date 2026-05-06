import { NextRequest, NextResponse } from 'next/server';
import { requireTrustedBrowserRequest } from '@/lib/application-session';
import {
  clearLoanOfficerPortalSessionCookie,
  clearTrustedLoanOfficerBrowserCookie,
  createLoanOfficerPortalSession,
  getPortalHomePath,
  getRequestHost,
  isInternalPortalHost,
  resolvePortalRoleFromHost,
  restoreLoanOfficerPortalSessionFromTrustedBrowser,
  setLoanOfficerPortalSessionCookie,
  setTrustedLoanOfficerBrowserCookie,
} from '@/lib/lo-portal-auth';

const ALLOWED_NEXT_PATHS = new Set(['/login', '/pricer', '/avm', '/processor']);

function normalizeNextPath(nextPath: string | null, fallbackPath: string) {
  if (!nextPath || !nextPath.startsWith('/')) return fallbackPath;
  return ALLOWED_NEXT_PATHS.has(nextPath) ? nextPath : fallbackPath;
}

export async function GET(req: NextRequest) {
  const trusted = requireTrustedBrowserRequest(req);
  if (trusted) return trusted;

  const portalRole = resolvePortalRoleFromHost(getRequestHost(req));
  if (!portalRole || !isInternalPortalHost(getRequestHost(req))) {
    return NextResponse.json({ error: 'Internal portal host required.' }, { status: 403 });
  }

  const nextPath = normalizeNextPath(req.nextUrl.searchParams.get('next'), getPortalHomePath(portalRole));
  const bootstrap = await restoreLoanOfficerPortalSessionFromTrustedBrowser(req);

  if (!bootstrap || bootstrap.user.role !== portalRole) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    const response = NextResponse.redirect(loginUrl);
    clearLoanOfficerPortalSessionCookie(response);
    clearTrustedLoanOfficerBrowserCookie(response);
    return response;
  }

  const destination = req.nextUrl.clone();
  destination.pathname = nextPath;
  destination.search = '';

  const response = NextResponse.redirect(destination);
  setLoanOfficerPortalSessionCookie(response, createLoanOfficerPortalSession(bootstrap.user));
  setTrustedLoanOfficerBrowserCookie(response, bootstrap.token, bootstrap.expiresAt);
  return response;
}
