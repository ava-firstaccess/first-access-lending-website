import { NextRequest, NextResponse } from 'next/server';
import { buildSiteAccessToken, isSiteAccessConfigured, SITE_ACCESS_COOKIE } from '@/lib/site-access';

const LO_ALLOWED_PREFIXES = [
  '/login',
  '/dashboard',
  '/pricer',
  '/avm',
  '/processor',
  '/api/lo-auth',
  '/api/lo-avm',
  '/api/clear-capital',
  '/api/pricer-stage1-pricing',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];
const SITE_GATE_ALLOWED_PREFIXES = [
  '/preview-access',
  '/calculator',
  '/calc-preview-9d4f2a8e',
  '/api/site-access-auth',
  '/api/current-rate',
  '/api/credit-card-average-rate',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

function normalizeHost(host: string) {
  return host.split(':')[0].toLowerCase();
}

function isInternalPortalHost(host: string) {
  const normalized = normalizeHost(host);
  return normalized === 'lo.firstaccesslending.com'
    || normalized === 'lo.firstaccessslending.com'
    || normalized === 'lp.firstaccesslending.com'
    || normalized.startsWith('lo.localhost')
    || normalized.startsWith('lo.127.0.0.1')
    || normalized.startsWith('lp.localhost')
    || normalized.startsWith('lp.127.0.0.1');
}

function isVercelProjectHost(host: string) {
  const normalized = normalizeHost(host);
  return normalized.endsWith('.vercel.app');
}

function isAllowedPath(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasValidSiteAccessCookie(request: NextRequest) {
  if (!isSiteAccessConfigured()) return false;
  const cookieValue = request.cookies.get(SITE_ACCESS_COOKIE)?.value || '';
  try {
    return cookieValue === buildSiteAccessToken();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.hostname || '';
  const { pathname } = request.nextUrl;

  if (isInternalPortalHost(host)) {
    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (isAllowedPath(pathname, LO_ALLOWED_PREFIXES)) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (isVercelProjectHost(host)) {
    if (isAllowedPath(pathname, SITE_GATE_ALLOWED_PREFIXES)) {
      return NextResponse.next();
    }

    if (!hasValidSiteAccessCookie(request)) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse('Not Found', { status: 404 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/preview-access';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_vercel).*)'],
};
