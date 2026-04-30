import { NextRequest, NextResponse } from 'next/server';
import { requireTrustedBrowserRequest } from '@/lib/application-session';
import {
  clearLoanOfficerPortalSessionCookie,
  clearTrustedLoanOfficerBrowserCookie,
  createLoanOfficerPortalSession,
  getRequestHost,
  isLoanOfficerPortalHost,
  restoreLoanOfficerPortalSessionFromTrustedBrowser,
  setLoanOfficerPortalSessionCookie,
  setTrustedLoanOfficerBrowserCookie,
} from '@/lib/lo-portal-auth';

const DEFAULT_NEXT_PATH = '/pricer';
const ALLOWED_NEXT_PATHS = new Set(['/login', '/pricer', '/avm']);

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith('/')) return DEFAULT_NEXT_PATH;
  return ALLOWED_NEXT_PATHS.has(nextPath) ? nextPath : DEFAULT_NEXT_PATH;
}

export async function GET(req: NextRequest) {
  const trusted = requireTrustedBrowserRequest(req);
  if (trusted) return trusted;

  if (!isLoanOfficerPortalHost(getRequestHost(req))) {
    return NextResponse.json({ error: 'Loan Officer portal host required.' }, { status: 403 });
  }

  const nextPath = normalizeNextPath(req.nextUrl.searchParams.get('next'));
  const bootstrap = await restoreLoanOfficerPortalSessionFromTrustedBrowser(req);

  if (!bootstrap) {
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
