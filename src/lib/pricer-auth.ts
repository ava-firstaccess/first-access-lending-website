import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const PRICER_AUTH_COOKIE = 'fal_pricer_auth';

function getPricerPassword() {
  return process.env.PRICER_PASSWORD || '';
}

function getPricerAuthSecret() {
  return process.env.PRICER_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function signValue(value: string) {
  const secret = getPricerAuthSecret();
  if (!secret) throw new Error('PRICER_AUTH_SECRET or SUPABASE_SERVICE_ROLE_KEY is required.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isPricerConfigured() {
  return Boolean(getPricerPassword());
}

export function verifyPricerPassword(candidate: string) {
  const configured = getPricerPassword();
  if (!configured) return false;
  return safeEqual(String(candidate || ''), configured);
}

export function buildPricerAuthToken() {
  const configured = getPricerPassword();
  if (!configured) throw new Error('PRICER_PASSWORD is not configured.');
  return signValue(configured);
}

export async function hasPricerAccess() {
  if (!isPricerConfigured()) return false;
  const store = await cookies();
  const cookieValue = store.get(PRICER_AUTH_COOKIE)?.value || '';
  const expected = buildPricerAuthToken();
  return safeEqual(cookieValue, expected);
}
