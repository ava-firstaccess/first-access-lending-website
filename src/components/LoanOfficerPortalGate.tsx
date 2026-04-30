'use client';

import { useMemo, useState } from 'react';

type LoanOfficerPortalGateProps = {
  nextPath: string;
  title?: string;
  subtitle?: string;
};

export function LoanOfficerPortalGate({ nextPath, title = 'Loan Officer Portal', subtitle = 'Login with your email prefix, then verify with the code sent to your work email.' }: LoanOfficerPortalGateProps) {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'request' | 'verify'>('request');
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizedIdentifier = useMemo(() => identifier.trim().toLowerCase(), [identifier]);

  async function requestCode() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lo-auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalizedIdentifier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Unable to send code.');
        return;
      }
      setDeliveryEmail(data.email || '');
      setResolvedEmail(data.email || '');
      setPhase('verify');
    } catch {
      setError('Unable to send code.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lo-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalizedIdentifier, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Unable to verify code.');
        return;
      }
      window.location.href = nextPath;
    } catch {
      setError('Unable to verify code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">First Access Lending</div>
          <h1 className="mt-3 text-3xl font-bold text-white">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
        </div>

        <div className="space-y-4">
          <label className="block text-sm">
            <div className="mb-1 font-medium text-slate-200">Email prefix</div>
            <div className="flex items-center rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-200 focus-within:border-sky-500">
              <input
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); if (error) setError(''); }}
                placeholder=""
                className="w-full bg-transparent outline-none"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={phase === 'verify'}
              />
              <span className="ml-2 shrink-0 text-xs text-slate-500">@firstaccesslending.com</span>
            </div>
            {resolvedEmail ? <div className="mt-1 text-xs text-slate-400">Resolved login: {resolvedEmail}</div> : null}
          </label>

          {phase === 'verify' ? (
            <label className="block text-sm">
              <div className="mb-1 font-medium text-slate-200">Verification code</div>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); if (error) setError(''); }}
                placeholder="4-digit code"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-200 outline-none focus:border-sky-500"
                inputMode="numeric"
              />
              {deliveryEmail ? <div className="mt-1 text-xs text-slate-400">Code sent to {deliveryEmail}</div> : null}
            </label>
          ) : null}

          {error ? <div className="rounded-xl border border-rose-900/70 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

          {phase === 'request' ? (
            <button
              type="button"
              onClick={requestCode}
              disabled={loading || !normalizedIdentifier}
              className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={verifyCode}
                disabled={loading || code.trim().length < 4}
                className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Verifying…' : 'Verify and continue'}
              </button>
              <button
                type="button"
                onClick={() => { setPhase('request'); setCode(''); setDeliveryEmail(''); setResolvedEmail(''); setError(''); }}
                className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200"
              >
                Use a different login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
