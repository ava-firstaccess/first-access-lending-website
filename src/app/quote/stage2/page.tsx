'use client';

import { useRouter } from 'next/navigation';

const steps = [
  {
    title: 'Property Value',
    path: '/quote/property-value',
    icon: '🏠',
    description: 'Confirm the home value we should use before we tighten the quote.',
    state: 'Start here',
  },
  {
    title: 'Soft Credit Check',
    path: '/quote/soft-credit',
    icon: '📊',
    description: 'Run the soft pull, review mortgages, and confirm the updated quote.',
    state: 'Step 2',
  },
  {
    title: 'Finalize Details',
    path: '/quote/finalize-details',
    icon: '📝',
    description: 'Complete the remaining details so the file is ready to package cleanly.',
    state: 'Final step',
  },
];

export default function Stage2EntryPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-10">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700 mb-4">
            Post-Quote Flow
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">After Your Quote</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            This is the clean post-quote flow. Start with property value, then move into the soft credit check and updated quote, then finish with final details.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <button
              key={step.path}
              onClick={() => router.push(step.path)}
              className="rounded-2xl bg-white p-6 text-left shadow-sm border border-gray-200 transition hover:-translate-y-0.5 hover:shadow-md hover:border-blue-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-3xl">{step.icon}</div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {step.state}
                </span>
              </div>
              <div className="text-sm font-semibold text-blue-600 mb-1">Step {index + 1}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h2>
              <p className="text-sm leading-6 text-gray-600">{step.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-white border border-gray-200 p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Primary route</h2>
            <p className="text-sm text-gray-600">When someone leaves the quote results, bring them here first, then into Property Value.</p>
          </div>
          <button
            onClick={() => router.push('/quote/property-value')}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Continue to Property Value →
          </button>
        </div>
      </div>
    </div>
  );
}
