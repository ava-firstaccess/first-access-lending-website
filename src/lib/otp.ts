import { createHmac, timingSafeEqual } from 'crypto';

export const OTP_LENGTH = 4;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function getOtpHashSecret() {
  const secret = process.env.OTP_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) throw new Error('OTP_CODE_SECRET or SUPABASE_SERVICE_ROLE_KEY is required for OTP hashing.');
  return secret;
}

export function hashOtpCode(phone: string, code: string) {
  return createHmac('sha256', getOtpHashSecret())
    .update(`${normalizePhone(phone)}:${String(code).trim()}`)
    .digest('hex');
}

export function verifyOtpCode(phone: string, candidateCode: string, storedValue: string) {
  const candidateHash = hashOtpCode(phone, candidateCode);
  const normalizedStored = String(storedValue || '').trim();

  if (/^[a-f0-9]{64}$/i.test(normalizedStored)) {
    const left = Buffer.from(candidateHash, 'utf8');
    const right = Buffer.from(normalizedStored, 'utf8');
    return left.length === right.length && timingSafeEqual(left, right);
  }

  // Legacy plaintext fallback for already-issued short-lived OTPs created before hashing was deployed.
  return normalizedStored === String(candidateCode).trim();
}
