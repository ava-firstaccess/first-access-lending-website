import { cookies } from 'next/headers';

export const SITE_ACCESS_COOKIE = 'fal_site_access';

function getSiteAccessPassword() {
  return process.env.SITE_ACCESS_PASSWORD || '';
}

export function isSiteAccessConfigured() {
  return Boolean(getSiteAccessPassword());
}

export function verifySiteAccessPassword(candidate: string) {
  const configured = getSiteAccessPassword();
  if (!configured) return false;
  return String(candidate || '') === configured;
}

export function buildSiteAccessToken() {
  const configured = getSiteAccessPassword();
  if (!configured) throw new Error('SITE_ACCESS_PASSWORD is not configured.');
  return configured;
}

export async function hasSiteAccess() {
  if (!isSiteAccessConfigured()) return false;
  const store = await cookies();
  const cookieValue = store.get(SITE_ACCESS_COOKIE)?.value || '';
  return cookieValue === getSiteAccessPassword();
}
