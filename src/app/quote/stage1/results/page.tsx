// Stage 1 Results Page
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function ResultsContent() {
  const params = useSearchParams();

  const product = params.get('product') || 'HELOC';
  const propertyValue = parseInt(params.get('propertyValue') || '500000');
  const loanBalance = parseInt(params.get('loanBalance') || '0');
  const creditScore = parseInt(params.get('creditScore') || '720');
  const propertyType = params.get('propertyType') || 'Primary';
  const drawTerm = parseInt(params.get('drawTerm') || '10');
  const cashOutAmount = parseInt(params.get('cashOutAmount') || '0');

  // Calculate quote
  let maxLtv = 0.80;
  if (creditScore >= 720) {
    maxLtv = propertyType === 'Primary' ? 0.90 : propertyType === '2nd Home' ? 0.85 : 0.80;
  } else if (creditScore >= 680) {
    maxLtv = propertyType === 'Primary' ? 0.85 : propertyType === '2nd Home' ? 0.80 : 0.75;
  } else if (creditScore >= 640) {
    maxLtv = propertyType === 'Primary' ? 0.80 : propertyType === '2nd Home' ? 0.75 : 0.70;
  } else {
    maxLtv = propertyType === 'Primary' ? 0.70 : propertyType === '2nd Home' ? 0.65 : 0.60;
  }

  const maxLoan = propertyValue * maxLtv;
  const maxAvailable = Math.max(0, maxLoan - loanBalance);

  let baseRate = 7.50;
  if (product === 'HELOC') {
    baseRate = 7.25;
    if (drawTerm === 5) baseRate -= 0.25;
    else if (drawTerm === 15) baseRate += 0.25;
  } else if (product === 'CES') {
    baseRate = 8.00;
  }

  let creditAdj = 0;
  if (creditScore >= 720) creditAdj = 0;
  else if (creditScore >= 680) creditAdj = 0.25;
  else if (creditScore >= 640) creditAdj = 0.50;
  else creditAdj = 1.00;

  const propertyAdj: Record<string, number> = { 'Primary': 0, 'Investment': 0.50, '2nd Home': 0.25 };
  const rate = baseRate + creditAdj + (propertyAdj[propertyType] || 0);

  const monthlyRate = rate / 100 / 12;
  const monthlyPayment = maxAvailable > 0 ? Math.round(maxAvailable * monthlyRate) : 0;

  const productLabels: Record<string, string> = {
    'HELOC': 'Home Equity Line of Credit',
    'CES': 'Closed-End Second Mortgage',
    'CashOut': 'Cash-Out Refinance',
    'NoCashRefi': 'Rate & Term Refinance'
  };

  const altProduct = product === 'HELOC' ? 'CES' : product === 'CES' ? 'HELOC' : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">

        {/* Results Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Preliminary Quote Ready
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Your {productLabels[product]} Quote
            </h1>
            <p className="text-gray-600">Based on the information you provided</p>
          </div>

          {/* Quote Numbers */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 rounded-xl p-6 text-center">
              <div className="text-sm text-blue-600 font-medium mb-1">Max Available</div>
              <div className="text-3xl md:text-4xl font-bold text-blue-900">
                ${maxAvailable.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 rounded-xl p-6 text-center">
              <div className="text-sm text-green-600 font-medium mb-1">Estimated Rate</div>
              <div className="text-3xl md:text-4xl font-bold text-green-900">
                {rate.toFixed(2)}%
              </div>
              <div className="text-xs text-green-600 mt-1">
                {product === 'HELOC' ? 'Variable' : 'Fixed'}
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-6 text-center">
              <div className="text-sm text-orange-600 font-medium mb-1">Est. Monthly Payment</div>
              <div className="text-3xl md:text-4xl font-bold text-orange-900">
                ${monthlyPayment.toLocaleString()}
              </div>
              <div className="text-xs text-orange-600 mt-1">Interest only</div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Your Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Property Value:</span> <span className="font-medium">${propertyValue.toLocaleString()}</span></div>
              <div><span className="text-gray-500">Current Balance:</span> <span className="font-medium">${loanBalance.toLocaleString()}</span></div>
              <div><span className="text-gray-500">Credit Score:</span> <span className="font-medium">{creditScore}</span></div>
              <div><span className="text-gray-500">Property Type:</span> <span className="font-medium">{propertyType}</span></div>
              <div><span className="text-gray-500">CLTV:</span> <span className="font-medium">{((loanBalance + maxAvailable) / propertyValue * 100).toFixed(1)}%</span></div>
              {product === 'HELOC' && (
                <div><span className="text-gray-500">Draw Period:</span> <span className="font-medium">{drawTerm} years</span></div>
              )}
            </div>
          </div>

          {/* Cross-sell for HELOC/CES */}
          {altProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-blue-900">
                    Want to see a {altProduct === 'HELOC' ? 'HELOC' : 'Closed-End Second'} quote too?
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {altProduct === 'HELOC' 
                      ? 'A HELOC gives you a revolving line of credit with a variable rate - draw only what you need.'
                      : 'A Closed-End Second gives you a lump sum with a fixed rate - predictable payments.'
                    }
                  </p>
                  <Link
                    href={`/quote/stage1?product=${altProduct}`}
                    className="inline-flex items-center gap-1 text-blue-700 font-semibold text-sm mt-3 hover:text-blue-800"
                  >
                    See {altProduct} Quote →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="space-y-4">
            <button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg">
              Get Your Custom Rate Quote
            </button>
            <p className="text-xs text-center text-gray-500">
              Verify your info with a soft credit check - won&apos;t affect your score
            </p>

            <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
              <a 
                href="tel:1-888-885-7789"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Call 1-888-885-7789
              </a>
              <Link
                href="/quote/stage1"
                className="text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Start Over
              </Link>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 mt-8 text-center leading-relaxed">
            This is a preliminary estimate based on self-reported information. Actual rates, terms, and 
            availability depend on verified credit, income, property value, and investor guidelines. 
            Not a commitment to lend. NMLS# [Your NMLS]. Equal Housing Lender.
          </p>
        </div>

      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Calculating your quote...</div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
