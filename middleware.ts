import { NextRequest, NextResponse } from 'next/server';

const PRICER_HOST = 'pricer.firstaccesslending.com';
const PRICER_ALLOWED_PREFIXES = [
  '/pricer',
  '/api/pricer-auth',
  '/api/pricer-stage1-pricing',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

function isPricerHost(host: string) {
  return host.split(':')[0].toLowerCase() === PRICER_HOST;
}

function isAllowedOnPricerHost(pathname: string) {
  return PRICER_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  if (!isPricerHost(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/pricer';
    return NextResponse.redirect(url);
  }

  if (isAllowedOnPricerHost(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/pricer';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_vercel).*)'],
};
