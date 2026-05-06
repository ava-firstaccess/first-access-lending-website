import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const LO_PORTAL_SESSION_COOKIE = 'lo_portal_session';
export const LO_PORTAL_TRUSTED_BROWSER_COOKIE = 'lo_portal_trusted_browser';

const DEFAULT_SESSION_TTL_MINUTES = 12 * 60;
const DEFAULT_TRUSTED_BROWSER_TTL_DAYS = 30;
const DEFAULT_EMAIL_DOMAIN = 'firstaccesslending.com';
const PORTAL_USERS_TABLE = 'portal_users';
const LEGACY_PORTAL_USERS_TABLE = 'loan_officer_portal_users';
const TRUSTED_DEVICES_TABLE = 'trusted_devices';
const TRUSTED_DEVICE_USER_TYPES = ['portal_user', 'loan_officer'] as const;

export type PortalRole = 'loan_officer' | 'loan_processor';

export type LoanOfficerPortalUser = {
  prefix: string;
  email: string;
  phone?: string;
  name?: string;
  position: PortalRole;
};

export type LoanOfficerPortalSession = {
  prefix: string;
  email: string;
  phone?: string;
  name?: string;
  position: PortalRole;
  exp: number;
};

type TrustedLoanOfficerBrowser = {
  deviceId: string;
  token: string;
  expiresAt: string;
  user: LoanOfficerPortalUser;
};

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePrefix(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

function normalizePortalRole(value: unknown): PortalRole {
  return value === 'loan_processor' ? 'loan_processor' : 'loan_officer';
}

function sessionSecret() {
  return process.env.LO_PORTAL_SESSION_SECRET || process.env.APPLICATION_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function sign(value: string) {
  const secret = sessionSecret();
  if (!secret) throw new Error('LO_PORTAL_SESSION_SECRET or fallback secret is required.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function trustedDeviceSecret() {
  return process.env.LO_PORTAL_TRUSTED_DEVICE_SECRET || sessionSecret();
}

function hashTrustedDeviceToken(token: string) {
  const secret = trustedDeviceSecret();
  if (!secret) throw new Error('LO_PORTAL_TRUSTED_DEVICE_SECRET or fallback secret is required.');
  return createHmac('sha256', secret).update(token).digest('hex');
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

function getTrustedBrowserExpiresAt(now = Date.now()) {
  const ttlDays = readPositiveNumber(process.env.LO_PORTAL_TRUSTED_BROWSER_TTL_DAYS, DEFAULT_TRUSTED_BROWSER_TTL_DAYS);
  return new Date(now + ttlDays * 24 * 60 * 60 * 1000);
}

export function maskPhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function getLoanOfficerPortalHost() {
  return String(process.env.LO_PORTAL_HOST || 'lo.firstaccesslending.com').trim().toLowerCase();
}

export function getLoanProcessorPortalHost() {
  return String(process.env.LP_PORTAL_HOST || 'lp.firstaccesslending.com').trim().toLowerCase();
}

export function getPortalHomePath() {
  return '/dashboard';
}

export function resolvePortalRoleFromHost(host: string): PortalRole | null {
  const normalized = String(host || '').split(':')[0].trim().toLowerCase();
  if (!normalized) return null;

  const loanOfficerHosts = new Set([getLoanOfficerPortalHost(), 'lo.firstaccesslending.com', 'lo.firstaccessslending.com']);
  if (loanOfficerHosts.has(normalized) || normalized.startsWith('lo.localhost') || normalized.startsWith('lo.127.0.0.1')) {
    return 'loan_officer';
  }

  const loanProcessorHosts = new Set([getLoanProcessorPortalHost(), 'lp.firstaccesslending.com']);
  if (loanProcessorHosts.has(normalized) || normalized.startsWith('lp.localhost') || normalized.startsWith('lp.127.0.0.1')) {
    return 'loan_processor';
  }

  return null;
}

export function isInternalPortalHost(host: string) {
  return Boolean(resolvePortalRoleFromHost(host));
}

export function isLoanOfficerPortalHost(host: string) {
  return resolvePortalRoleFromHost(host) === 'loan_officer';
}

export function isLoanProcessorPortalHost(host: string) {
  return resolvePortalRoleFromHost(host) === 'loan_processor';
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
  const position = normalizePortalRole(record.position ?? record.role);
  if (!prefix || !email) return null;
  return { prefix, email, phone, name, position };
}

async function findPortalUserInTable(tableName: string, normalized: string, prefix: string) {
  const supabase = getSupabaseAdmin();
  const query = supabase
    .from(tableName)
    .select('*')
    .eq('active', true)
    .limit(1);

  return normalized.includes('@')
    ? query.eq('email', normalized).maybeSingle()
    : query.eq('prefix', prefix).maybeSingle();
}

export async function findLoanOfficerPortalUser(identifier: string, expectedRole?: PortalRole): Promise<LoanOfficerPortalUser | null> {
  const normalized = String(identifier || '').trim().toLowerCase();
  const prefix = normalizePrefix(normalized.includes('@') ? normalized.split('@')[0] : normalized);
  if (!prefix && !normalized) return null;

  let data: unknown = null;
  let error: any = null;

  const primary = await findPortalUserInTable(PORTAL_USERS_TABLE, normalized, prefix);
  data = primary.data;
  error = primary.error;

  if (error?.code === '42P01') {
    const legacy = await findPortalUserInTable(LEGACY_PORTAL_USERS_TABLE, normalized, prefix);
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    console.error('Portal user lookup error:', error);
    return null;
  }

  if (!data) return null;
  const user = normalizeLoanOfficerPortalUser(data as Record<string, unknown>);
  if (!user) return null;
  if (expectedRole && user.position !== expectedRole) return null;
  return user;
}

export function createLoanOfficerPortalSession(user: LoanOfficerPortalUser): string {
  const ttlMinutes = readPositiveNumber(process.env.LO_PORTAL_SESSION_TTL_MINUTES, DEFAULT_SESSION_TTL_MINUTES);
  const payload: LoanOfficerPortalSession = {
    prefix: user.prefix,
    email: user.email,
    phone: user.phone,
    name: user.name,
    position: user.position,
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
    if (!payload?.email || !payload?.prefix || typeof payload?.exp !== 'number') return null;
    if (payload.exp <= Date.now()) return null;
    return {
      ...payload,
      position: normalizePortalRole((payload as LoanOfficerPortalSession & { role?: PortalRole }).position ?? (payload as LoanOfficerPortalSession & { role?: PortalRole }).role),
    };
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

export function clearTrustedLoanOfficerBrowserCookie(response: NextResponse) {
  response.cookies.set(LO_PORTAL_TRUSTED_BROWSER_COOKIE, '', {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
}

export function setTrustedLoanOfficerBrowserCookie(response: NextResponse, token: string, expiresAt: string | Date) {
  response.cookies.set(LO_PORTAL_TRUSTED_BROWSER_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'lax',
    expires: expiresAt instanceof Date ? expiresAt : new Date(expiresAt),
    path: '/',
  });
}

async function resolveTrustedLoanOfficerBrowser(token: string | undefined | null): Promise<TrustedLoanOfficerBrowser | null> {
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from(TRUSTED_DEVICES_TABLE)
    .select('id, user_key, expires_at')
    .in('user_type', [...TRUSTED_DEVICE_USER_TYPES])
    .eq('token_hash', hashTrustedDeviceToken(token))
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Trusted portal browser lookup error:', error);
    return null;
  }

  if (!data) return null;

  const user = await findLoanOfficerPortalUser(String(data.user_key || ''));
  if (!user) {
    await supabase
      .from(TRUSTED_DEVICES_TABLE)
      .update({ revoked_at: nowIso, updated_at: nowIso })
      .eq('id', data.id);
    return null;
  }

  return {
    deviceId: String(data.id),
    token: String(token),
    expiresAt: String(data.expires_at),
    user,
  };
}

export async function hasTrustedLoanOfficerBrowser() {
  const store = await cookies();
  const token = store.get(LO_PORTAL_TRUSTED_BROWSER_COOKIE)?.value;
  return Boolean(await resolveTrustedLoanOfficerBrowser(token));
}

export async function issueTrustedLoanOfficerBrowser(response: NextResponse, user: LoanOfficerPortalUser, req: NextRequest) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = getTrustedBrowserExpiresAt();
  const nowIso = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from(TRUSTED_DEVICES_TABLE).insert({
    user_type: 'portal_user',
    user_key: user.prefix,
    token_hash: hashTrustedDeviceToken(token),
    user_agent: req.headers.get('user-agent')?.slice(0, 1000) || null,
    expires_at: expiresAt.toISOString(),
    last_seen_at: nowIso,
  });

  if (error) {
    console.error('Trusted portal browser insert error:', error);
    return false;
  }

  setTrustedLoanOfficerBrowserCookie(response, token, expiresAt);
  return true;
}

export async function restoreLoanOfficerPortalSessionFromTrustedBrowser(req: NextRequest) {
  const token = req.cookies.get(LO_PORTAL_TRUSTED_BROWSER_COOKIE)?.value;
  const trusted = await resolveTrustedLoanOfficerBrowser(token);
  if (!trusted) return null;

  const nowIso = new Date().toISOString();
  await getSupabaseAdmin()
    .from(TRUSTED_DEVICES_TABLE)
    .update({ last_seen_at: nowIso, updated_at: nowIso })
    .eq('id', trusted.deviceId);

  return trusted;
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
