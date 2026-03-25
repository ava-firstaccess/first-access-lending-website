// Coming Soon - Unlicensed State
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

function ComingSoonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stateCode = searchParams.get('state') || '';
  const stateName = STATE_NAMES[stateCode] || stateCode;

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/coming-soon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          state: stateCode,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
          <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Coming Soon to {stateName}
        </h1>

        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          We&apos;re not yet licensed in {stateName}, but we&apos;re working on it.
          Leave your info and we&apos;ll let you know the moment we can help.
        </p>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-3 max-w-md mx-auto mb-8">
            <div className="flex gap-3">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="flex-1 px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="flex-1 px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email address"
              className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
            />

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!email || loading}
              className={`w-full py-3 px-6 rounded-xl font-semibold text-lg transition-all ${
                email && !loading
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {loading ? 'Saving...' : 'Notify Me When Available'}
            </button>
          </form>
        ) : (
          <div className="max-w-md mx-auto mb-8 bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">You&apos;re on the list!</h3>
            <p className="text-green-700 text-sm">
              We&apos;ll send you an email as soon as we&apos;re licensed in {stateName}. Check your inbox for a confirmation.
            </p>
          </div>
        )}

        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500 mb-4">
            Currently serving homeowners in AL, AZ, CA, CO, CT, FL, GA, IL, MA, MD, MI, NJ, NY, OH, OR, PA, and VA.
          </p>

          <button
            onClick={() => router.push('/quote/stage1')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium underline underline-offset-2"
          >
            ← Back to application
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComingSoonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    }>
      <ComingSoonContent />
    </Suspense>
  );
}
