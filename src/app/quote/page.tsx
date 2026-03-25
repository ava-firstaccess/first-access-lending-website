// Landing Page - Entry Point for Quote App
'use client';

import Link from 'next/link';

export default function QuoteLanding() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50">
      <div className="max-w-lg w-full mx-4 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            How much can you borrow?
          </h1>
          <p className="text-lg text-gray-600">
            See your rate and qualification in minutes
          </p>
        </div>

        {/* Two Entry Cards */}
        <div className="space-y-4">
          
          {/* New? Get Started - Primary CTA */}
          <Link href="/quote/stage1" className="block group">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 border-2 border-transparent hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-white">
                    Get a Quick Quote
                  </h2>
                  <p className="text-sm text-blue-100 mt-1">
                    See what you qualify for in 2 minutes — no login needed
                  </p>
                </div>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Already Working With Us */}
          <Link href="/quote/verify" className="block group">
            <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all p-6 border-2 border-blue-100 hover:border-blue-300">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    Already working with us?
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Continue your application — verify with your phone
                  </p>
                </div>
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </Link>

        </div>

        {/* Exit Ramp - Call Us */}
        <div className="text-center py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            Rather talk to someone?
          </p>
          <a 
            href="tel:1-888-885-7789"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call 1-888-885-7789
          </a>
        </div>

        {/* Footer Disclaimer */}
        <div className="text-center text-xs text-gray-500 pt-4">
          <p>First Access Lending • NMLS #12345</p>
          <p className="mt-1">Equal Housing Lender</p>
        </div>

      </div>
    </main>
  );
}
