// Stage 1 Results Page
'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';

interface QuoteCalc {
  maxAvailable: number;
  rate: number;
  monthlyPayment: number;
  maxLtv: number;
  rateType: string;
}

function calcQuote(
  product: string,
  propertyValue: number,
  loanBalance: number,
  creditScore: number,
  propertyType: string,
  drawTerm: number,
  cashOutAmount: number
): QuoteCalc {
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
    if (drawTerm === 3) baseRate -= 0.50;
    else if (drawTerm === 5) baseRate -= 0.25;
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

  return {
    maxAvailable,
    rate,
    monthlyPayment,
    maxLtv,
    rateType: product === 'HELOC' ? 'Variable' : 'Fixed'
  };
}

function QuoteColumn({ label, quote, highlight }: { label: string; quote: QuoteCalc; highlight: boolean }) {
  const ringClass = highlight ? 'ring-2 ring-blue-400' : '';
  return (
    <div className={`bg-white rounded-xl p-6 ${ringClass}`}>
      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">{label}</h3>
      <div className="space-y-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-xs text-blue-600 font-medium mb-1">Max Available</div>
          <div className="text-2xl font-bold text-blue-900">${quote.maxAvailable.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-xs text-green-600 font-medium mb-1">Estimated Rate</div>
          <div className="text-2xl font-bold text-green-900">{quote.rate.toFixed(2)}%</div>
          <div className="text-xs text-green-600 mt-0.5">{quote.rateType}</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-xs text-orange-600 font-medium mb-1">Est. Monthly</div>
          <div className="text-2xl font-bold text-orange-900">${quote.monthlyPayment.toLocaleString()}</div>
          <div className="text-xs text-orange-600 mt-0.5">Interest only</div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [stage1, setStage1] = useState<Record<string, any>>({});

  useEffect(() => {
    const raw = localStorage.getItem('stage1-data');
    if (raw) {
      try {
        setStage1(JSON.parse(raw));
      } catch {
        router.push('/quote/stage1');
        return;
      }
    } else {
      router.push('/quote/stage1');
      return;
    }
    setLoaded(true);
  }, [router]);

  const product = String(stage1.product || 'HELOC');
  const propertyValue = Number(stage1.propertyValue) || 500000;
  const loanBalance = Number(stage1.loanBalance) || 0;
  const creditScore = Number(stage1.creditScore) || 720;
  const propertyType = String(stage1.propertyType || 'Primary');
  const drawTerm = Number(stage1.drawTerm) || 5;
  const cashOutAmount = Number(stage1.cashOutAmount) || 0;
  const propertyAddress = String(stage1.propertyAddress || '');

  const primaryQuote = useMemo(() =>
    calcQuote(product, propertyValue, loanBalance, creditScore, propertyType, drawTerm, cashOutAmount),
    [product, propertyValue, loanBalance, creditScore, propertyType, drawTerm, cashOutAmount]
  );

  const altProduct = product === 'HELOC' ? 'CES' : product === 'CES' ? 'HELOC' : null;
  const altQuote = useMemo(() =>
    altProduct ? calcQuote(altProduct, propertyValue, loanBalance, creditScore, propertyType, 5, cashOutAmount) : null,
    [altProduct, propertyValue, loanBalance, creditScore, propertyType, cashOutAmount]
  );

  const productLabels: Record<string, string> = {
    'HELOC': 'HELOC',
    'CES': 'Closed-End Second',
    'CashOut': 'Cash-Out Refinance',
    'NoCashRefi': 'Rate & Term Refinance'
  };

  const productFullLabels: Record<string, string> = {
    'HELOC': 'Home Equity Line of Credit',
    'CES': 'Closed-End Second Mortgage',
    'CashOut': 'Cash-Out Refinance',
    'NoCashRefi': 'Rate & Term Refinance'
  };

  const handleGetCustomQuote = () => {
    // Stage 1 data already in localStorage - Stage 2 reads it from there
    router.push('/quote/stage2');
  };

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Calculating your quote...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">

          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Preliminary Quote Ready
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Your {productFullLabels[product]} Quote
            </h1>
            <p className="text-gray-600">Based on the information you provided</p>
          </div>

          {/* CTA at top */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-8 text-center">
            <p className="text-blue-100 text-sm mb-3">
              This is a preliminary estimate. To get your exact, customized rate, continue with a full application.
              <br />
              <span className="font-medium text-white">100% automated - no phone calls unless you want them.</span>
            </p>
            <button
              onClick={handleGetCustomQuote}
              className="bg-white text-blue-700 font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all text-lg"
            >
              Get Your Custom Rate Quote &rarr;
            </button>
          </div>

          {/* Quote Numbers - Side by side if cross-sell available */}
          {altProduct && altQuote ? (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <QuoteColumn label={productLabels[product]} quote={primaryQuote} highlight={true} />
              <QuoteColumn label={productLabels[altProduct]} quote={altQuote} highlight={false} />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <div className="text-sm text-blue-600 font-medium mb-1">Max Available</div>
                <div className="text-3xl md:text-4xl font-bold text-blue-900">${primaryQuote.maxAvailable.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <div className="text-sm text-green-600 font-medium mb-1">Estimated Rate</div>
                <div className="text-3xl md:text-4xl font-bold text-green-900">{primaryQuote.rate.toFixed(2)}%</div>
                <div className="text-xs text-green-600 mt-1">{primaryQuote.rateType}</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-6 text-center">
                <div className="text-sm text-orange-600 font-medium mb-1">Est. Monthly Payment</div>
                <div className="text-3xl md:text-4xl font-bold text-orange-900">${primaryQuote.monthlyPayment.toLocaleString()}</div>
                <div className="text-xs text-orange-600 mt-1">Interest only</div>
              </div>
            </div>
          )}

          {/* HELOC/CES comparison note */}
          {altProduct && altQuote && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
              <p className="text-sm text-gray-700 text-center">
                {product === 'HELOC'
                  ? '💡 A HELOC gives you a revolving credit line (draw as needed, variable rate). A Closed-End Second is a lump sum with a fixed rate.'
                  : '💡 A Closed-End Second gives you a lump sum with a fixed rate. A HELOC gives you a revolving credit line (draw as needed, variable rate).'
                }
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Your Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {propertyAddress && (
                <div className="col-span-2"><span className="text-gray-500">Property:</span> <span className="font-medium">{propertyAddress}</span></div>
              )}
              <div><span className="text-gray-500">Property Value:</span> <span className="font-medium">${propertyValue.toLocaleString()}</span></div>
              <div><span className="text-gray-500">Current Balance:</span> <span className="font-medium">${loanBalance.toLocaleString()}</span></div>
              <div><span className="text-gray-500">Credit Score:</span> <span className="font-medium">{creditScore}</span></div>
              <div><span className="text-gray-500">Property Type:</span> <span className="font-medium">{propertyType}</span></div>
              <div><span className="text-gray-500">CLTV:</span> <span className="font-medium">{((loanBalance + primaryQuote.maxAvailable) / propertyValue * 100).toFixed(1)}%</span></div>
              {product === 'HELOC' && (
                <div><span className="text-gray-500">Draw Period:</span> <span className="font-medium">{drawTerm} years</span></div>
              )}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
            <a href="tel:1-888-885-7789" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call 1-888-885-7789
            </a>
            <button onClick={() => router.push('/quote/stage1')} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
              Start Over
            </button>
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
