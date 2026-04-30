import { NextRequest, NextResponse } from 'next/server';
import { isLoanOfficerPortalHost } from '@/lib/lo-portal-auth';

const LO_ALLOWED_PATH_PREFIXES = ['/login', '/pricer', '/avm', '/api/lo-auth'];
const LO_ALLOWED_EXACT_PATHS = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

function isAllowedLoanOfficerPath(pathname: string) {
  if (pathname.startsWith('/_next/')) return true;
  if (LO_ALLOWED_EXACT_PATHS.has(pathname)) return true;
  return LO_ALLOWED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(':')[0].toLowerCase();

  if (!isLoanOfficerPortalHost(host)) {
    return NextResponse.next();
  }

  if (isAllowedLoanOfficerPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)', '/', '/api/:path*'],
};
