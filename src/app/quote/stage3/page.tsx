// Stage 3 - Property Value Verification
'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useMemo } from 'react';
import QuoteBuilder from '@/components/quote/QuoteBuilder';
import type { Stage1PricingResponse } from '@/lib/stage1-pricing/types';

type VerifyResult = {
  tier: 'estimate' | 'verified' | 'low_confidence' | 'no_data' | 'error';
  hcValue?: number;
  statedValue?: number;
  fsd?: number;
  houseCanaryFsd?: number;
  price_lwr?: number;
  price_upr?: number;
  newMaxLoan?: number;
  maxLtv?: number;
  desiredLoanAmount?: number;
  loanDiffPct?: number;
  needsHuman?: boolean;
  needsClearCapital?: boolean;
  valuationProvider?: 'housecanary' | 'housecanary_estimate' | 'clearcapital';
  quotedInvestor?: string | null;
  quotedInvestorProviderEligible?: boolean | null;
  quotedInvestorProviderReason?: string | null;
  houseCanaryQuotedInvestorEligible?: boolean | null;
  houseCanaryQuotedInvestorReason?: string | null;
  error?: string;
};

function LoanAmountSlider({ value, max, min, onChange, onCommit }: {
  value: number;
  max: number;
  min: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
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
        onMouseUp={(e) => onCommit?.(Number((e.currentTarget as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit?.(Number((e.currentTarget as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.currentTarget as HTMLInputElement).value))}
        onBlur={(e) => onCommit?.(Number((e.currentTarget as HTMLInputElement).value))}
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
  const parts = fullAddress
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const street = parts[0] || fullAddress.trim();
  const zipMatch = fullAddress.match(/\b(\d{5})(-\d{4})?\b/);

  return {
    street,
    zipcode: zipMatch?.[1] || '',
  };
}

interface LiveQuoteCalc {
  rate: number;
  monthlyPayment: number;
  maxAvailable: number;
  maxLtv: number;
  rateType: string;
  investor?: string;
  program?: string;
}

function mapStageOccupancy(propertyType: string, occupancy: string): 'Owner-Occupied' | 'Second Home' | 'Investment' {
  if (propertyType === 'Investment') return 'Investment';
  if (propertyType === '2nd Home') return occupancy === 'Rental' ? 'Investment' : 'Second Home';
  return 'Owner-Occupied';
}

function mapStructureType(structureType: string): 'SFR' | 'Condo' | 'Townhome' | 'PUD' | '2-4 Unit' {
  if (structureType === 'Townhouse') return 'Townhome';
  if (structureType === 'Multi-Family') return '2-4 Unit';
  return (structureType as 'SFR' | 'Condo' | 'Townhome' | 'PUD' | '2-4 Unit') || 'SFR';
}

type Stage3Data = Record<string, unknown>;

export default function Stage3Page() {
  const router = useRouter();
  const steps = [
    { label: 'Quote', icon: '💬', state: 'done' as const },
    { label: 'Property Value', icon: '🏠', state: 'current' as const },
    { label: 'Soft Credit Check', icon: '📊', state: 'upcoming' as const },
    { label: 'Update Quote', icon: '💰', state: 'upcoming' as const },
    { label: 'Finalize Details', icon: '📝', state: 'upcoming' as const },
  ];
  const [loaded, setLoaded] = useState(false);
  const [stage1, setStage1] = useState<Stage3Data>({});
  const [status, setStatus] = useState<'pre' | 'loading' | 'done' | 'error'>('pre');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [submittedLoanAmount, setSubmittedLoanAmount] = useState<number>(0);
  const [liveQuote, setLiveQuote] = useState<LiveQuoteCalc | null>(null);
  const [liveQuoteLoading, setLiveQuoteLoading] = useState(false);
  const [showDisagree, setShowDisagree] = useState(false);
  const [optIn, setOptIn] = useState(false);
  const [testSession, setTestSession] = useState<{ applicationId: string; sessionToken: string } | null>(null);
  const skipOtp = process.env.NEXT_PUBLIC_SKIP_OTP === 'true';

  async function bootstrapTestSession(formData: Stage3Data) {
    const bootstrapRes = await fetch('/api/auth/test-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData, stage: 'stage2' }),
    });

    if (!bootstrapRes.ok) {
      throw new Error('Failed to create test session.');
    }

    const bootstrapPayload = await bootstrapRes.json();
    if (!bootstrapPayload?.applicationId || !bootstrapPayload?.sessionToken) {
      throw new Error('Test session bootstrap returned incomplete credentials.');
    }

    const next = {
      applicationId: String(bootstrapPayload.applicationId),
      sessionToken: String(bootstrapPayload.sessionToken),
    };
    setTestSession(next);
    return next;
  }

  useEffect(() => {
    const hydrate = async () => {
      const params = new URLSearchParams(window.location.search);
      const applicationId = params.get('applicationId');
      const sessionToken = params.get('sessionToken');
      const stage1Raw = localStorage.getItem('stage1-data');
      const stage2Raw = localStorage.getItem('stage2-progress');

      let merged: Stage3Data | null = null;

      if (applicationId && sessionToken) {
        const qs = new URLSearchParams({ applicationId, sessionToken });
        const res = await fetch(`/api/application?${qs.toString()}`);
        if (res.ok) {
          const payload = await res.json();
          merged = payload?.application?.form_data || null;
          if (merged) {
            localStorage.setItem('stage1-data', JSON.stringify(merged));
            localStorage.setItem('stage2-progress', JSON.stringify(merged));
          }
        }
      }

      if (!merged) {
        if (!stage1Raw && !stage2Raw) {
          router.push('/quote/start');
          return;
        }

        try {
          const stage1Parsed = stage1Raw ? JSON.parse(stage1Raw) : {};
          const stage2Parsed = stage2Raw ? JSON.parse(stage2Raw) : {};
          merged = {
            ...stage2Parsed,
            ...stage1Parsed,
          };

          if (skipOtp && merged) {
            await bootstrapTestSession(merged);
          }
        } catch {
          router.push('/quote/start');
          return;
        }
      }

      const hydrateTimer = window.setTimeout(() => {
        const initialLoanAmount = Number(merged?.desiredLoanAmount) || 0;
        setStage1(merged || {});
        setLoanAmount(initialLoanAmount);
        setSubmittedLoanAmount(initialLoanAmount);
        setLoaded(true);
      }, 0);

      return () => {
        window.clearTimeout(hydrateTimer);
      };
    };

    void hydrate();
  }, [router, skipOtp]);

  const propertyValue = Number(stage1.propertyValue) || 0;
  const loanBalance = Number(stage1.loanBalance) || 0;
  const creditScore = Number(stage1.creditScore) || 720;
  const propertyType = String(stage1.propertyType || 'Primary');
  const propertyAddress = String(stage1.propertyAddress || '');
  const product = String(stage1.product || 'HELOC');
  const desiredLoanAmount = Number(stage1.desiredLoanAmount) || 0;

  function getRateForScenario(maxAvailableForPricing: number) {
    const baseRate = product === 'HELOC' ? 7.25 : 8.0;
    const creditAdj = creditScore >= 720 ? 0 : creditScore >= 680 ? 0.25 : creditScore >= 640 ? 0.5 : 1.0;
    const propertyAdj: Record<string, number> = { Primary: 0, Investment: 0.5, '2nd Home': 0.25 };
    let ltvAdj = 0;

    if (maxAvailableForPricing > 0) {
      const combinedLtv = (loanBalance + maxAvailableForPricing) / Math.max(propertyValue, 1);
      if (combinedLtv > 0.85) ltvAdj = 0.5;
      else if (combinedLtv > 0.80) ltvAdj = 0.25;
    }

    return baseRate + creditAdj + (propertyAdj[propertyType] || 0) + ltvAdj;
  }

  const previousRate = getRateForScenario(desiredLoanAmount);
  const appliedLoanAmount = submittedLoanAmount || desiredLoanAmount;
  const sliderDirty = loanAmount !== appliedLoanAmount;

  useEffect(() => {
    if (status !== 'done') return;
    if (!result || appliedLoanAmount <= 0) return;
    if (product !== 'HELOC' && product !== 'CES') {
      setLiveQuote(null);
      setLiveQuoteLoading(false);
      return;
    }

    const validatedValue = result.hcValue || propertyValue;
    const propertyState = String(stage1.propertyState || '');
    if (!validatedValue || !propertyState || !creditScore) return;

    const timeout = window.setTimeout(async () => {
      setLiveQuoteLoading(true);
      try {
        const response = await fetch('/api/stage1-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine: 'BestX',
            input: {
              bestExProduct: product,
              bestExDrawPeriodYears: Number(stage1.helocDrawTerm || stage1.drawTerm || 3),
              bestExTermYears: Number(stage1.cesTerm || 20),
              bestExLockPeriodDays: 30,
              bestExDocType: 'Full Doc',
              propertyState,
              propertyValue: validatedValue,
              loanBalance,
              desiredLoanAmount: appliedLoanAmount,
              creditScore,
              dti: 35,
              occupancy: mapStageOccupancy(propertyType, String(stage1.occupancy || '')),
              structureType: mapStructureType(String(stage1.structureType || 'SFR')),
              numberOfUnits: Number(stage1.numberOfUnits || 1),
              cashOut: false,
            }
          })
        });

        if (!response.ok) throw new Error('stage1 pricing failed');
        const pricing = await response.json() as Stage1PricingResponse;
        const eligible = pricing.results.find((entry) => entry.eligibility.eligible);

        if (!eligible) {
          setLiveQuote(null);
          return;
        }

        setLiveQuote({
          rate: eligible.quote.rate,
          monthlyPayment: Math.round(eligible.quote.monthlyPayment),
          maxAvailable: eligible.quote.maxAvailable,
          maxLtv: eligible.quote.maxLtv,
          rateType: product === 'HELOC' ? 'Variable' : 'Fixed',
          investor: eligible.investor,
          program: eligible.quote.program,
        });
      } catch (error) {
        console.error('Failed to load live Stage 3 pricing', error);
        setLiveQuote(null);
      } finally {
        setLiveQuoteLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    status,
    result,
    appliedLoanAmount,
    product,
    propertyValue,
    loanBalance,
    creditScore,
    propertyType,
    stage1.propertyState,
    stage1.occupancy,
    stage1.structureType,
    stage1.numberOfUnits,
    stage1.helocDrawTerm,
    stage1.drawTerm,
    stage1.cesTerm,
  ]);

  const updatedRate = liveQuote?.rate ?? previousRate;

  const originalMonthlyPayment = useMemo(() => {
    if (desiredLoanAmount <= 0) return 0;
    const monthlyRate = previousRate / 100 / 12;

    if (product === 'HELOC') {
      return Math.round(desiredLoanAmount * monthlyRate);
    }

    const cesTerm = Number(stage1.cesTerm) || 20;
    const n = cesTerm * 12;
    return Math.round(desiredLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
  }, [desiredLoanAmount, previousRate, product, stage1.cesTerm]);

  // Calculate monthly payment for chosen amount
  const monthlyPayment = useMemo(() => {
    if (liveQuote) return liveQuote.monthlyPayment;
    if (appliedLoanAmount <= 0) return 0;
    const monthlyRate = updatedRate / 100 / 12;

    if (product === 'HELOC') {
      return Math.round(appliedLoanAmount * monthlyRate);
    } else {
      const cesTerm = Number(stage1.cesTerm) || 20;
      const n = cesTerm * 12;
      return Math.round(appliedLoanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
    }
  }, [liveQuote, appliedLoanAmount, product, updatedRate, stage1.cesTerm]);

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

      const queryParams = new URLSearchParams(window.location.search);
      let authContext = testSession;
      if (!authContext && skipOtp && !queryParams.get('sessionToken')) {
        authContext = await bootstrapTestSession(stage1);
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
          applicationId: authContext?.applicationId || queryParams.get('applicationId'),
          sessionToken: authContext?.sessionToken || queryParams.get('sessionToken'),
        }),
      });

      const data: VerifyResult & { error?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to verify property value.');
      }
      setResult(data);

      // Update loan amount to new max if it's lower
      if (data.newMaxLoan && data.newMaxLoan < loanAmount) {
        setLoanAmount(data.newMaxLoan);
      }
      if (data.newMaxLoan && data.newMaxLoan < submittedLoanAmount) {
        setSubmittedLoanAmount(data.newMaxLoan);
      }

      setStatus('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify property value.';
      setResult({ tier: 'error', error: message });
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

    s1.desiredLoanAmount = String(appliedLoanAmount);
    s2.desiredLoanAmount = String(appliedLoanAmount);
    s1.verifiedMaxAvailable = String(result?.newMaxLoan || s1.maxAvailable || s2.maxAvailable);
    s2.verifiedMaxAvailable = String(result?.newMaxLoan || s2.maxAvailable || s1.maxAvailable);
    s1.verificationTier = result?.tier;
    s2.verificationTier = result?.tier;
    s1.verificationFsd = result?.fsd ? String(result.fsd) : undefined;
    s2.verificationFsd = result?.fsd ? String(result.fsd) : undefined;

    localStorage.setItem('stage1-data', JSON.stringify(s1));
    localStorage.setItem('stage2-progress', JSON.stringify(s2));

    // Continue into the post-verification validation flow
    router.push('/quote/soft-credit');
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
  const isClearCapitalVerifiedValue = result?.tier === 'verified' && result?.valuationProvider === 'clearcapital';
  const houseCanaryInvestorMismatch = isClearCapitalVerifiedValue && result?.houseCanaryQuotedInvestorEligible === false;
  const displayFsd = typeof result?.fsd === 'number' ? result.fsd : result?.houseCanaryFsd;
  const confidenceLabel = houseCanaryInvestorMismatch ? 'Medium Value Confidence' : displayFsd !== undefined && displayFsd < 0.10 ? 'High Value Confidence' : 'Medium Value Confidence';
  const newMax = result?.newMaxLoan || 0;
  const oldMax = Number(stage1.verifiedMaxAvailable || stage1.maxAvailable || desiredLoanAmount || 0);
  const isAdjustmentFailState = status === 'done' && !!result && (result.tier === 'estimate' || !!result.needsHuman) && !valueIncreased;
  const showHumanHelpCard = isAdjustmentFailState || status === 'error';
  const sidebarProgress = status === 'done' || status === 'error' ? 55 : status === 'loading' ? 45 : 35;

  const renderHumanHelpCard = (suffix: string) => (
    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Don&apos;t give up!</h3>
      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
        <strong className="text-green-700">89% of our 2nd liens don&apos;t require an appraisal.</strong> AI can only do so much,
        but our team has additional tools to maximize your value and find the right solution.
      </p>
      <p className="text-sm text-gray-600 mb-5 leading-relaxed">
        Let our human team take a closer look.
      </p>

      <div className="flex items-start gap-3 text-left mb-5 bg-white rounded-lg p-4">
        <input
          type="checkbox"
          id={`marketing-opt-in-${suffix}`}
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
          className="mt-1 flex-shrink-0 h-4 w-4 text-blue-600 rounded"
        />
        <label htmlFor={`marketing-opt-in-${suffix}`} className="text-[11px] text-gray-500 leading-relaxed cursor-pointer">
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
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirm Your Property Value</h1>
          <p className="text-gray-600">This helps us tighten up your quote before the next step.</p>
        </div>

        <div className="mb-8 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <React.Fragment key={step.label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${
                    step.state === 'done'
                      ? 'bg-green-500 text-white'
                      : step.state === 'current'
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {step.state === 'done' ? '✓' : step.icon}
                  </div>
                  <span className={`text-xs font-medium hidden md:block ${
                    step.state !== 'upcoming' ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step.state === 'done' ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
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
                  Step 1: Property Value
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Confirm Your Property Value
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

                  {/* Confidence / investor-provider indicator for verified */}
                  {result.tier === 'verified' && (displayFsd !== undefined || isClearCapitalVerifiedValue) && (
                    <div className={`rounded-lg p-4 mb-6 text-center border ${houseCanaryInvestorMismatch ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="text-xs uppercase tracking-wide text-gray-500">Value Confidence</div>
                      <div className={`mt-1 text-sm font-semibold ${houseCanaryInvestorMismatch ? 'text-amber-700' : 'text-green-600'}`}>
                        {confidenceLabel}
                      </div>
                      {houseCanaryInvestorMismatch ? (
                        <p className="mt-2 text-xs text-amber-800">
                          Your quoted investor{result.quotedInvestor ? `, ${result.quotedInvestor},` : ''} did not accept the original HouseCanary confidence/FSD result, so we used Clear Capital to confirm this value.
                        </p>
                      ) : null}
                      {(displayFsd !== undefined || (result.price_lwr && result.price_upr)) && (
                        <div className="mt-2 text-xs text-gray-500">
                          {displayFsd !== undefined ? <span>HouseCanary FSD: {displayFsd.toFixed(3)}</span> : null}
                          {displayFsd !== undefined && result.price_lwr && result.price_upr ? <span className="mx-2">•</span> : null}
                          {result.price_lwr && result.price_upr ? <span>Range: ${result.price_lwr.toLocaleString()} - ${result.price_upr.toLocaleString()}</span> : null}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Max Available comparison */}
              {result.newMaxLoan !== undefined && (
                <div className="grid grid-cols-2 gap-3 mb-4">
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

              {!isAdjustmentFailState && (
                <>
                  {/* Rate comparison */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
                      <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Previous Rate</div>
                      <div className="text-xl font-bold text-gray-400 line-through">{previousRate.toFixed(2)}%</div>
                    </div>
                    <div className={`rounded-xl p-4 text-center border-2 ${
                      updatedRate <= previousRate
                        ? 'bg-green-50 border-green-300'
                        : 'bg-amber-50 border-amber-300'
                    }`}>
                      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Updated Rate</div>
                      <div className={`text-xl font-bold ${updatedRate <= previousRate ? 'text-green-700' : 'text-amber-700'}`}>
                        {updatedRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
                      <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Previous Payment</div>
                      <div className="text-xl font-bold text-gray-400 line-through">${originalMonthlyPayment.toLocaleString()}</div>
                    </div>
                    <div className={`rounded-xl p-4 text-center border-2 ${monthlyPayment <= originalMonthlyPayment ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Updated Payment</div>
                      <div className={`text-xl font-bold ${monthlyPayment <= originalMonthlyPayment ? 'text-green-700' : 'text-amber-700'}`}>
                        ${monthlyPayment.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Loan amount slider (for verified/estimate tiers) */}
              {newMax > 0 && (result.tier === 'verified' || result.tier === 'estimate' || result.tier === 'low_confidence') && (
                <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
                  <LoanAmountSlider
                    value={Math.min(loanAmount, newMax)}
                    max={newMax}
                    min={Math.min(10000, newMax)}
                    onChange={setLoanAmount}
                    onCommit={setSubmittedLoanAmount}
                  />
                  <div className="mt-4 flex flex-col items-center gap-3">
                    <div className="text-center">
                      <span className="text-sm text-gray-500">Est. Monthly Payment: </span>
                      <span className="text-lg font-bold text-gray-900">{liveQuoteLoading ? 'Loading rate...' : `$${monthlyPayment.toLocaleString()}`}</span>
                      <span className="text-xs text-gray-400 ml-1">
                        {product === 'HELOC' ? '(interest only)' : '(P&I)'}
                      </span>
                    </div>
                    {sliderDirty ? (
                      <div className="text-xs text-amber-600">Move the slider, release to refresh the quote.</div>
                    ) : liveQuoteLoading ? (
                      <div className="text-xs text-blue-600">Refreshing live pricing…</div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Continue button for any successful non-error outcome with an available amount */}
              {newMax > 0 && (result.tier === 'verified' || result.tier === 'estimate' || result.tier === 'low_confidence') && (
                <button
                  onClick={handleContinue}
                  disabled={sliderDirty || liveQuoteLoading}
                  className={`w-full py-4 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg mb-4 ${
                    result.tier === 'verified'
                      ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
                  } disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-400`}
                >
                  Continue to Soft Credit Check with ${appliedLoanAmount.toLocaleString()} →
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
              {/* HUMAN HELP / EXIT RAMP */}
              {/* ══════════════════════════════════════ */}
              {showHumanHelpCard ? (
                renderHumanHelpCard('value-help')
              ) : (
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <button
                    onClick={() => setShowDisagree(!showDisagree)}
                    className="w-full text-center text-sm text-gray-500 hover:text-gray-700 underline py-2"
                  >
                    {showDisagree ? 'Hide options' : "I don't agree with this value"}
                  </button>

                  {showDisagree && renderHumanHelpCard('disagree')}
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════ */}
          {/* ERROR STATE */}
          {/* ══════════════════════════════════════ */}
          {status === 'error' && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Verify Automatically</h2>
              <p className="text-gray-500 mb-6">{result?.error || "We couldn&apos;t retrieve automated valuation data for this property, but that&apos;s okay!"}</p>
              
              <button
                onClick={() => setStatus('pre')}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all mb-6"
              >
                Try Again
              </button>

              {renderHumanHelpCard('error')}
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
            <button
              onClick={() => {
                localStorage.removeItem('stage1-data');
                localStorage.removeItem('stage2-progress');
                router.push('/quote/start');
              }}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Start Over
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

          <div className="lg:col-span-1">
            {status === 'loading' ? (
              <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-6 text-center">
                <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Building your updated quote</h3>
                <p className="text-sm text-gray-500">We&apos;re validating the property value and recalculating your numbers now.</p>
              </div>
            ) : (
              <QuoteBuilder
                maxAvailable={newMax || oldMax || desiredLoanAmount}
                desiredLoanAmount={loanAmount || desiredLoanAmount}
                rateRange={{ min: updatedRate, max: updatedRate }}
                monthlyPayment={monthlyPayment}
                progress={sidebarProgress}
                stage="stage2"
                showMaxAvailable={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
