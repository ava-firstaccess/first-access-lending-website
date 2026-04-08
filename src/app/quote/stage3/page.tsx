// Stage 3 - Property Value Verification
'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useMemo } from 'react';

type ValidationStep = 'credit' | 'mortgages' | 'updated-quote' | 'closing-costs';

type VerifyResult = {
  tier: 'estimate' | 'verified' | 'low_confidence' | 'no_data' | 'error';
  hcValue?: number;
  statedValue?: number;
  fsd?: number;
  price_lwr?: number;
  price_upr?: number;
  newMaxLoan?: number;
  maxLtv?: number;
  desiredLoanAmount?: number;
  loanDiffPct?: number;
  needsHuman?: boolean;
  needsClearCapital?: boolean;
  error?: string;
};

function LoanAmountSlider({ value, max, min, onChange }: {
  value: number;
  max: number;
  min: number;
  onChange: (v: number) => void;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 font-medium">Your Loan Amount</span>
        <span className="text-lg font-bold text-gray-900">${value.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1000}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #3b82f6 ${pct}%, #e5e7eb ${pct}%)`
        }}
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>${min.toLocaleString()}</span>
        <span>${max.toLocaleString()} max</span>
      </div>
    </div>
  );
}

function parseAddress(fullAddress: string): { street: string; zipcode: string } {
  // Try to extract zipcode from anywhere in the address
  const zipMatch = fullAddress.match(/\b(\d{5})(-\d{4})?\b/);
  if (zipMatch) {
    // Remove the zip and everything after it for the street
    const idx = fullAddress.indexOf(zipMatch[0]);
    const street = fullAddress.substring(0, idx).replace(/,?\s*$/, '').trim();
    return {
      street: street || fullAddress.split(',')[0].trim(),
      zipcode: zipMatch[1],
    };
  }
  
  // Try splitting by comma - "123 Main St, Baltimore, MD" format
  const parts = fullAddress.split(',').map(p => p.trim());
  if (parts.length >= 1) {
    // Return just the street portion, no zip
    return { street: parts[0], zipcode: '' };
  }
  
  return { street: fullAddress, zipcode: '' };
}

export default function Stage3Page() {
  const router = useRouter();
  const steps: { key: ValidationStep; label: string; icon: string }[] = [
    { key: 'credit', label: 'Credit Check', icon: '📊' },
    { key: 'mortgages', label: 'Mortgages', icon: '🏦' },
    { key: 'updated-quote', label: 'Updated Quote', icon: '💰' },
    { key: 'closing-costs', label: 'Closing Costs', icon: '📋' },
  ];
  const [loaded, setLoaded] = useState(false);
  const [stage1, setStage1] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<'pre' | 'loading' | 'done' | 'error'>('pre');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [showDisagree, setShowDisagree] = useState(false);
  const [optIn, setOptIn] = useState(false);

  useEffect(() => {
    const stage1Raw = localStorage.getItem('stage1-data');
    const stage2Raw = localStorage.getItem('stage2-progress');

    if (!stage1Raw && !stage2Raw) {
      router.push('/quote/stage1');
      return;
    }

    try {
      const stage1Parsed = stage1Raw ? JSON.parse(stage1Raw) : {};
      const stage2Parsed = stage2Raw ? JSON.parse(stage2Raw) : {};
      const merged = { ...stage1Parsed, ...stage2Parsed };
      setStage1(merged);
      setLoanAmount(Number(merged.desiredLoanAmount) || 0);
    } catch {
      router.push('/quote/stage1');
      return;
    }

    setLoaded(true);
  }, [router]);

  const propertyValue = Number(stage1.propertyValue) || 0;
  const loanBalance = Number(stage1.loanBalance) || 0;
  const creditScore = Number(stage1.creditScore) || 720;
  const propertyType = String(stage1.propertyType || 'Primary');
  const propertyAddress = String(stage1.propertyAddress || '');
  const product = String(stage1.product || 'HELOC');
  const desiredLoanAmount = Number(stage1.desiredLoanAmount) || 0;

  // Calculate monthly payment for chosen amount
  const monthlyPayment = useMemo(() => {
    if (loanAmount <= 0) return 0;
    const baseRate = product === 'HELOC' ? 7.25 : 8.00;
    let creditAdj = 0;
    if (creditScore >= 720) creditAdj = 0;
    else if (creditScore >= 680) creditAdj = 0.25;
    else if (creditScore >= 640) creditAdj = 0.50;
    else creditAdj = 1.00;
    const propertyAdj: Record<string, number> = { 'Primary': 0, 'Investment': 0.50, '2nd Home': 0.25 };
    const rate = baseRate + creditAdj + (propertyAdj[propertyType] || 0);
    const monthlyRate = rate / 100 / 12;

    if (product === 'HELOC') {
      return Math.round(loanAmount * monthlyRate);
    } else {
      const cesTerm = Number(stage1.cesTerm) || 20;
      const n = cesTerm * 12;
      return Math.round(loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
    }
  }, [loanAmount, product, creditScore, propertyType, stage1.cesTerm]);

  async function handleValidate() {
    setStatus('loading');
    setShowDisagree(false);

    try {
      // Use stored zipcode/city from Google Places, fall back to parsing
      const { street, zipcode: parsedZip } = parseAddress(propertyAddress);
      const zipcode = stage1.propertyZipcode || parsedZip || '';
      const city = stage1.propertyCity || '';
      const state = stage1.propertyState || '';

      console.log('Stage 3 verify request:', { street, zipcode, city, state });

      if (!zipcode) {
        console.warn('No zipcode available - HC API requires it');
      }

      const res = await fetch('/api/verify-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: street,
          zipcode,
          city,
          state,
          statedValue: propertyValue,
          loanBalance,
          creditScore,
          propertyType,
          desiredLoanAmount,
        }),
      });

      const data: VerifyResult = await res.json();
      setResult(data);

      // Update loan amount to new max if it's lower
      if (data.newMaxLoan && data.newMaxLoan < loanAmount) {
        setLoanAmount(data.newMaxLoan);
      }

      setStatus('done');
    } catch (err: any) {
      setResult({ tier: 'error', error: err.message });
      setStatus('error');
    }
  }

  function handleContinue() {
    // Save updated values to localStorage
    const s1 = JSON.parse(localStorage.getItem('stage1-data') || '{}');
    const s2 = JSON.parse(localStorage.getItem('stage2-progress') || '{}');

    if (result?.hcValue) {
      s1.verifiedPropertyValue = String(result.hcValue);
      s2.verifiedPropertyValue = String(result.hcValue);
    }

    s1.desiredLoanAmount = String(loanAmount);
    s2.desiredLoanAmount = String(loanAmount);
    s1.verifiedMaxAvailable = String(result?.newMaxLoan || s1.maxAvailable || s2.maxAvailable);
    s2.verifiedMaxAvailable = String(result?.newMaxLoan || s2.maxAvailable || s1.maxAvailable);
    s1.verificationTier = result?.tier;
    s2.verificationTier = result?.tier;
    s1.verificationFsd = result?.fsd ? String(result.fsd) : undefined;
    s2.verificationFsd = result?.fsd ? String(result.fsd) : undefined;

    localStorage.setItem('stage1-data', JSON.stringify(s1));
    localStorage.setItem('stage2-progress', JSON.stringify(s2));

    // Continue into the post-verification validation flow
    router.push('/quote/validate');
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const valueDiff = result?.hcValue ? result.hcValue - propertyValue : 0;
  const valueDiffPct = propertyValue > 0 ? (valueDiff / propertyValue) * 100 : 0;
  const valueIncreased = valueDiff > 0;
  const newMax = result?.newMaxLoan || 0;
  const oldMax = Number(stage1.maxAvailable) || desiredLoanAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verifying Your Application</h1>
          <p className="text-gray-600">A few quick checks to finalize your quote.</p>
        </div>

        <div className="mb-8 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                    i === 0 ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {step.icon}
                  </div>
                  <span className={`text-xs font-medium hidden md:block ${
                    i === 0 ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 bg-gray-200" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">

          {/* ══════════════════════════════════════ */}
          {/* PRE-VALIDATION STATE */}
          {/* ══════════════════════════════════════ */}
          {status === 'pre' && (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Stage 3: Verification
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Verify Your Property Value
                </h1>
                <p className="text-gray-600 mb-4">
                  We&apos;ll validate your property&apos;s current market value using AI-powered analytics
                </p>
                <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-5 py-2.5 rounded-full text-sm font-semibold border border-green-200">
                  <span className="text-lg">🏡</span>
                  89% of our 2nd liens don&apos;t require an appraisal!
                </div>
              </div>

              {/* Stated value card */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 text-center mb-6">
                <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Your Stated Value</div>
                <div className="text-4xl font-bold text-gray-900">${propertyValue.toLocaleString()}</div>
                {propertyAddress && (
                  <div className="text-sm text-gray-500 mt-2">{propertyAddress}</div>
                )}
              </div>

              {/* Your desired loan */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mb-8">
                <div className="text-xs uppercase tracking-wider text-blue-500 font-semibold mb-1">Your Desired Loan Amount</div>
                <div className="text-2xl font-bold text-blue-900">${desiredLoanAmount.toLocaleString()}</div>
                <div className="text-xs text-blue-500 mt-1">{product} &middot; Est. ${monthlyPayment.toLocaleString()}/mo</div>
              </div>

              <button
                onClick={handleValidate}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
              >
                🔍 Validate My Property Value
              </button>
            </>
          )}

          {/* ══════════════════════════════════════ */}
          {/* LOADING STATE */}
          {/* ══════════════════════════════════════ */}
          {status === 'loading' && (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-6"></div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Validating Property Value</h2>
              <p className="text-gray-500">Analyzing market data with AI-powered analytics...</p>
            </div>
          )}

          {/* ══════════════════════════════════════ */}
          {/* POST-VALIDATION: VERIFIED or ESTIMATE */}
          {/* ══════════════════════════════════════ */}
          {status === 'done' && result && (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                {result.tier === 'verified' ? (
                  <>
                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Value Verified
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {valueIncreased ? 'Great news!' : 'Value Verified'} ✓
                    </h1>
                    <p className="text-gray-600">
                      {valueIncreased
                        ? 'Your property value came in higher than expected'
                        : valueDiff < 0
                        ? 'Your validated value is slightly lower than your estimate'
                        : 'Your property value matches your estimate'}
                    </p>
                  </>
                ) : result.tier === 'low_confidence' ? (
                  <>
                    <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                      ⚠️ Additional Verification Needed
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      We Need More Data
                    </h1>
                    <p className="text-gray-600">
                      Our AI valuation has lower confidence for this property. We&apos;re working on additional verification tools.
                    </p>
                  </>
                ) : result.tier === 'estimate' || result.needsHuman ? (
                  <>
                    {valueIncreased ? (
                      <>
                        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                          🎉 Higher Verified Value
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                          Good News: More Cash May Be Available
                        </h1>
                        <p className="text-gray-600">
                          Based on the validated property value, your home may qualify for additional cash out. Review the updated amount below.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-semibold mb-4">
                          ⚠️ Value Mismatch
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                          Your Loan Amount Needs Adjustment
                        </h1>
                        <p className="text-gray-600">
                          Based on the validated property value, your requested loan amount is outside the available range.
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      Unable to Verify Automatically
                    </h1>
                    <p className="text-gray-600">
                      We couldn&apos;t retrieve automated valuation data, but our team can help!
                    </p>
                  </>
                )}
              </div>

              {/* Value comparison */}
              {result.hcValue && (
                <>
                  <div className="grid grid-cols-[1fr_40px_1fr] items-center gap-0 mb-2">
                    <div className={`bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-center ${result.tier !== 'no_data' ? 'opacity-60' : ''}`}>
                      <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Stated Value</div>
                      <div className={`text-2xl font-bold ${result.hcValue !== propertyValue ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        ${propertyValue.toLocaleString()}
                      </div>
                    </div>
                    <div className={`text-center text-2xl ${valueIncreased ? 'text-green-500' : 'text-amber-500'}`}>→</div>
                    <div className={`rounded-xl p-5 text-center border-2 ${
                      valueIncreased
                        ? 'bg-green-50 border-green-300'
                        : 'bg-amber-50 border-amber-300'
                    }`}>
                      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Validated Value</div>
                      <div className={`text-2xl font-bold ${valueIncreased ? 'text-green-700' : 'text-amber-700'}`}>
                        ${result.hcValue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Change badge */}
                  {valueDiff !== 0 && (
                    <div className="text-center mb-6">
                      <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${
                        valueIncreased
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {valueIncreased ? '↑' : '↓'} ${Math.abs(valueDiff).toLocaleString()} ({valueDiffPct > 0 ? '+' : ''}{valueDiffPct.toFixed(1)}%)
                      </span>
                    </div>
                  )}

                  {/* FSD indicator for verified */}
                  {result.fsd !== undefined && result.tier === 'verified' && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-6 text-center">
                      <span className="text-xs text-gray-500">
                        Confidence: <strong className="text-green-600">
                          {result.fsd < 0.10 ? 'High' : 'Moderate'}
                        </strong>
                        {result.price_lwr && result.price_upr && (
                          <span className="ml-2">
                            (Range: ${result.price_lwr.toLocaleString()} - ${result.price_upr.toLocaleString()})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Max Available comparison */}
              {result.newMaxLoan !== undefined && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
                    <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Previous Max</div>
                    <div className="text-xl font-bold text-gray-400 line-through">${oldMax.toLocaleString()}</div>
                  </div>
                  <div className={`rounded-xl p-4 text-center border-2 ${
                    newMax >= oldMax
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-amber-50 border-amber-300'
                  }`}>
                    <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">New Max Available</div>
                    <div className={`text-xl font-bold ${newMax >= oldMax ? 'text-blue-700' : 'text-amber-700'}`}>
                      ${newMax.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Loan amount slider (for verified/estimate tiers) */}
              {newMax > 0 && (result.tier === 'verified' || result.tier === 'estimate' || result.tier === 'low_confidence') && (
                <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
                  <LoanAmountSlider
                    value={Math.min(loanAmount, newMax)}
                    max={newMax}
                    min={Math.min(10000, newMax)}
                    onChange={setLoanAmount}
                  />
                  <div className="mt-3 text-center">
                    <span className="text-sm text-gray-500">Est. Monthly Payment: </span>
                    <span className="text-lg font-bold text-gray-900">${monthlyPayment.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 ml-1">
                      {product === 'HELOC' ? '(interest only)' : '(P&I)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Continue button for any successful non-error outcome with an available amount */}
              {newMax > 0 && (result.tier === 'verified' || result.tier === 'estimate' || result.tier === 'low_confidence') && (
                <button
                  onClick={handleContinue}
                  className={`w-full py-4 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg mb-4 ${
                    result.tier === 'verified'
                      ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                  }`}
                >
                  Submit and Continue with ${loanAmount.toLocaleString()} →
                </button>
              )}

              {/* Low confidence - placeholder */}
              {result.tier === 'low_confidence' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4 text-center">
                  <p className="text-sm text-amber-800 mb-3">
                    Additional verification via Clear Capital is coming soon. You can still continue to the next validation step now, or have our loan officers help.
                  </p>
                </div>
              )}

              {/* ══════════════════════════════════════ */}
              {/* "I DON'T AGREE" / EXIT RAMP */}
              {/* ══════════════════════════════════════ */}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <button
                  onClick={() => setShowDisagree(!showDisagree)}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 underline py-2"
                >
                  {showDisagree ? 'Hide options' : "I don't agree with this value"}
                </button>

                {showDisagree && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">AI can only do so much!</h3>
                    <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                      Remember, <strong className="text-green-700">89% of our 2nd liens close without an appraisal</strong>.
                      Our expert loan officers have additional tools and access to maximize your home&apos;s value and find the right solution.
                    </p>
                    <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                      Our human team can problem solve — let us take a closer look.
                    </p>

                    <div className="flex items-start gap-3 text-left mb-5 bg-white rounded-lg p-4">
                      <input
                        type="checkbox"
                        id="marketing-opt-in"
                        checked={optIn}
                        onChange={(e) => setOptIn(e.target.checked)}
                        className="mt-1 flex-shrink-0 h-4 w-4 text-blue-600 rounded"
                      />
                      <label htmlFor="marketing-opt-in" className="text-[11px] text-gray-500 leading-relaxed cursor-pointer">
                        By submitting the inquiry, I expressly consent to receive communications via automatic telephone dialing system or by artificial/pre-recorded message, email, or by text message from First Access Lending or their agents at the telephone number above (even if my number is currently listed on any state, federal, local, or corporate Do Not Call list) including my wireless number if provided, for the purpose of receiving information on mortgage products and services. Message frequency varies. Carrier message and data rates may apply. Reply HELP to a text message for help. Reply STOP to a text message to opt out. I understand that my consent is not required as a condition of purchasing any goods or services and that I may revoke my consent at any time by email to info@firstaccesslending.com or calling 1-855-605-8811. I also acknowledge that I have read and agree to the Privacy Policy and Terms and Condition. For help or additional info contact info@firstaccesslending.com.
                      </label>
                    </div>

                    <a
                      href={optIn ? 'https://calendly.com/firstaccesslending/getaccess' : '#'}
                      onClick={(e) => {
                        if (!optIn) {
                          e.preventDefault();
                          alert('Please check the opt-in box to continue');
                        }
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all ${
                        optIn
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl cursor-pointer'
                          : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      📞 Schedule a Call with the Team
                    </a>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════ */}
          {/* ERROR STATE */}
          {/* ══════════════════════════════════════ */}
          {status === 'error' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Verify Automatically</h2>
              <p className="text-gray-500 mb-6">We couldn&apos;t retrieve automated valuation data for this property, but that&apos;s okay!</p>
              
              <button
                onClick={() => setStatus('pre')}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all mb-6"
              >
                Try Again
              </button>

              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">AI can only do so much!</h3>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  Remember, <strong className="text-green-700">89% of our 2nd liens close without an appraisal</strong>.
                  Our expert loan officers have additional tools and access to maximize your home&apos;s value and find the right solution.
                </p>
                <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                  Our human team can problem solve — let us take a closer look.
                </p>

                <div className="flex items-start gap-3 text-left mb-5 bg-white rounded-lg p-4">
                  <input
                    type="checkbox"
                    id="marketing-opt-in-error"
                    checked={optIn}
                    onChange={(e) => setOptIn(e.target.checked)}
                    className="mt-1 flex-shrink-0 h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor="marketing-opt-in-error" className="text-[11px] text-gray-500 leading-relaxed cursor-pointer">
                    By submitting the inquiry, I expressly consent to receive communications via automatic telephone dialing system or by artificial/pre-recorded message, email, or by text message from First Access Lending or their agents at the telephone number above (even if my number is currently listed on any state, federal, local, or corporate Do Not Call list) including my wireless number if provided, for the purpose of receiving information on mortgage products and services. Message frequency varies. Carrier message and data rates may apply. Reply HELP to a text message for help. Reply STOP to a text message to opt out. I understand that my consent is not required as a condition of purchasing any goods or services and that I may revoke my consent at any time by email to info@firstaccesslending.com or calling 1-855-605-8811. I also acknowledge that I have read and agree to the Privacy Policy and Terms and Condition. For help or additional info contact info@firstaccesslending.com.
                  </label>
                </div>

                <a
                  href={optIn ? 'https://calendly.com/firstaccesslending/getaccess' : '#'}
                  onClick={(e) => {
                    if (!optIn) {
                      e.preventDefault();
                      alert('Please check the opt-in box to continue');
                    }
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all ${
                    optIn
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl cursor-pointer'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  📞 Schedule a Call with the Team
                </a>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-center gap-6 pt-6 mt-6 border-t border-gray-100">
            <button
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              ← Back
            </button>
            <a
              href="tel:1-888-885-7789"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call 1-888-885-7789
            </a>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 mt-8 text-center leading-relaxed">
            Property values are estimates based on automated valuation models and public data.
            They are not appraisals and should not be relied upon as such. Actual property value
            may differ. Final loan terms depend on verified credit, income, and property value.
            Not a commitment to lend. NMLS #1988098. Equal Housing Lender.
          </p>
        </div>
      </div>
    </div>
  );
}
