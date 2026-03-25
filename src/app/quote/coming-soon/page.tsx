// Coming Soon - Unlicensed State
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

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
          We&apos;d love to let you know when we&apos;re available in your area.
        </p>

        {/* Email notify form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const email = (form.elements.namedItem('email') as HTMLInputElement).value;
            // Store interest - could wire to GHL or Supabase later
            localStorage.setItem('comingSoonInterest', JSON.stringify({
              email,
              state: stateCode,
              timestamp: new Date().toISOString()
            }));
            form.reset();
            const btn = form.querySelector('button') as HTMLButtonElement;
            btn.textContent = '✓ We\'ll be in touch!';
            btn.disabled = true;
            btn.className = 'px-6 py-3 bg-green-600 text-white font-semibold rounded-xl';
          }}
          className="flex gap-3 max-w-md mx-auto mb-8"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
          >
            Notify Me
          </button>
        </form>

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
