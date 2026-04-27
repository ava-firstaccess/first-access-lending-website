import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  return req.headers.get('x-real-ip') || 'unknown';
}

export async function consumeRateLimit(params: {
  scope: string;
  key: string;
  limit: number;
  windowSeconds: number;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('consume_auth_rate_limit', {
    p_scope: params.scope,
    p_key: params.key,
    p_limit: params.limit,
    p_window_seconds: params.windowSeconds,
  });

  if (error) {
    console.error('Rate limit RPC error');
    throw new Error('Rate limit check failed');
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    remaining: Number(row?.remaining ?? 0),
    retryAfterSeconds: Number(row?.retry_after_seconds ?? params.windowSeconds),
  };
}
