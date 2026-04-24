'use client';

import { useState } from 'react';

export function PricerPasswordGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pricer-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Unable to unlock pricer.');
        return;
      }
      window.location.reload();
    } catch {
      setError('Unable to unlock pricer.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Pricer Access</h1>
        <p className="mt-2 text-sm text-slate-600">Internal page. Enter the shared password to continue.</p>
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          {error ? <div className="text-sm text-rose-700">{error}</div> : null}
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Unlocking…' : 'Unlock pricer'}
          </button>
        </div>
      </div>
    </div>
  );
}
