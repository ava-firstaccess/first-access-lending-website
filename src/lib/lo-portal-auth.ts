import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const LO_PORTAL_SESSION_COOKIE = 'lo_portal_session';
const DEFAULT_SESSION_TTL_MINUTES = 12 * 60;
const DEFAULT_EMAIL_DOMAIN = 'firstaccesslending.com';
const LO_PORTAL_USERS_TABLE = 'loan_officer_portal_users';

export type LoanOfficerPortalUser = {
  prefix: string;
  email: string;
  phone: string;
  name?: string;
};

export type LoanOfficerPortalSession = {
  prefix: string;
  email: string;
  phone: string;
  name?: string;
  exp: number;
};

function normalizePrefix(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function sessionSecret() {
  return process.env.LO_PORTAL_SESSION_SECRET || process.env.APPLICATION_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function sign(value: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error('LO_PORTAL_SESSION_SECRET or fallback secret is required.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function encodePayload(payload: LoanOfficerPortalSession) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePayload(encoded: string) {
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as LoanOfficerPortalSession;
}

function cookieSecure() {
  return process.env.NODE_ENV === 'production';
}

export function maskPhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function getLoanOfficerPortalHost() {
  return String(process.env.LO_PORTAL_HOST || 'lo.firstaccesslending.com').trim().toLowerCase();
}

export function isLoanOfficerPortalHost(host: string) {
  const normalized = String(host || '').split(':')[0].trim().toLowerCase();
  if (!normalized) return false;
  const configured = getLoanOfficerPortalHost();
  const knownHosts = new Set([configured, 'lo.firstaccesslending.com', 'lo.firstaccessslending.com']);
  return knownHosts.has(normalized) || normalized.startsWith('lo.localhost') || normalized.startsWith('lo.127.0.0.1');
}

export function getRequestHost(req: NextRequest) {
  return (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(':')[0].toLowerCase();
}

function normalizeLoanOfficerPortalUser(record: Record<string, unknown>): LoanOfficerPortalUser | null {
  const emailDomain = String(process.env.LO_PORTAL_EMAIL_DOMAIN || DEFAULT_EMAIL_DOMAIN).trim().toLowerCase();
  const prefix = normalizePrefix(String(record.prefix || record.username || record.emailPrefix || ''));
  const email = String(record.email || (prefix ? `${prefix}@${emailDomain}` : '')).trim().toLowerCase();
  const phone = String(record.phone || '').trim();
  const name = typeof record.name === 'string' ? record.name.trim() : undefined;
  if (!prefix || !email || !phone) return null;
  return { prefix, email, phone, name };
}

export async function findLoanOfficerPortalUser(identifier: string): Promise<LoanOfficerPortalUser | null> {
  const normalized = String(identifier || '').trim().toLowerCase();
  const prefix = normalizePrefix(normalized.includes('@') ? normalized.split('@')[0] : normalized);
  if (!prefix && !normalized) return null;

  const supabase = getSupabaseAdmin();
  const query = supabase
    .from(LO_PORTAL_USERS_TABLE)
    .select('prefix, email, phone, name')
    .eq('active', true)
    .limit(1);

  const { data, error } = normalized.includes('@')
    ? await query.eq('email', normalized).maybeSingle()
    : await query.eq('prefix', prefix).maybeSingle();

  if (error) {
    console.error('LO portal user lookup error:', error);
    return null;
  }

  if (!data) return null;
  return normalizeLoanOfficerPortalUser(data as Record<string, unknown>);
}

export function createLoanOfficerPortalSession(user: LoanOfficerPortalUser): string {
  const ttlMinutes = Number(process.env.LO_PORTAL_SESSION_TTL_MINUTES || DEFAULT_SESSION_TTL_MINUTES);
  const payload: LoanOfficerPortalSession = {
    prefix: user.prefix,
    email: user.email,
    phone: user.phone,
    name: user.name,
    exp: Date.now() + ttlMinutes * 60 * 1000,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function parseLoanOfficerPortalSession(token: string | undefined | null): LoanOfficerPortalSession | null {
  if (!token) return null;
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) return null;
  try {
    const payload = decodePayload(encoded);
    if (!payload?.email || !payload?.prefix || !payload?.phone || typeof payload?.exp !== 'number') return null;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearLoanOfficerPortalSessionCookie(response: NextResponse) {
  response.cookies.set(LO_PORTAL_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
}

export function setLoanOfficerPortalSessionCookie(response: NextResponse, token: string) {
  const parsed = parseLoanOfficerPortalSession(token);
  response.cookies.set(LO_PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    expires: parsed ? new Date(parsed.exp) : undefined,
    path: '/',
  });
}

export async function getLoanOfficerPortalSession() {
  const store = await cookies();
  return parseLoanOfficerPortalSession(store.get(LO_PORTAL_SESSION_COOKIE)?.value);
}

export function getLoanOfficerPortalSessionFromRequest(req: NextRequest) {
  return parseLoanOfficerPortalSession(req.cookies.get(LO_PORTAL_SESSION_COOKIE)?.value);
}

export function buildLoanOfficerPortalUnauthorizedResponse(message = 'Login required') {
  const response = NextResponse.json({ error: message }, { status: 401 });
  clearLoanOfficerPortalSessionCookie(response);
  return response;
}
