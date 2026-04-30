// Stage 1 Results Page
'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useMemo } from 'react';
import { TextField, PhoneField } from '@/components/quote/FormField';
import { useStepTracker } from '@/hooks/useStepTracker';
import { calculateButtonStage1Quote } from '@/lib/rates/button';
import type { Stage1PricingResponse } from '@/lib/stage1-pricing/types';

const MIN_LOAN_AMOUNT = 50000;

interface QuoteCalc {
  maxAvailable: number;
  rate: number;
  monthlyPayment: number;
  maxLtv: number;
  rateType: string;
}

interface LiveQuoteCalc extends QuoteCalc {
  investor?: string;
  program?: string;
}

function mapStage1Occupancy(propertyType: string, occupancy: string): 'Owner-Occupied' | 'Second Home' | 'Investment' {
  if (propertyType === 'Investment') return 'Investment';
  if (propertyType === '2nd Home') return occupancy === 'Rental' ? 'Investment' : 'Second Home';
  return 'Owner-Occupied';
}

function mapStructureType(structureType: string): 'SFR' | 'Condo' | 'Townhome' | 'PUD' | '2-4 Unit' {
  if (structureType === 'Townhouse') return 'Townhome';
  if (structureType === 'Multi-Family') return '2-4 Unit';
  return (structureType as 'SFR' | 'Condo' | 'Townhome' | 'PUD' | '2-4 Unit') || 'SFR';
}

function floorDisplayedMaxAvailable(amount: number) {
  return amount > 0 ? Math.max(MIN_LOAN_AMOUNT, Math.round(amount)) : 0;
}

function clampLoanAmount(value: number, maxAvailable: number) {
  if (maxAvailable <= 0) return 0;
  const displayedMax = floorDisplayedMaxAvailable(maxAvailable);
  return Math.max(MIN_LOAN_AMOUNT, Math.min(value, displayedMax));
}

function calcQuote(
  product: string,
  propertyValue: number,
  loanBalance: number,
  creditScore: number,
  propertyType: string,
  drawTerm: number,
  cesTerm: number = 20
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
    if (cesTerm === 30) baseRate += 0.25;
  }

  let creditAdj = 0;
  if (creditScore >= 720) creditAdj = 0;
  else if (creditScore >= 680) creditAdj = 0.25;
  else if (creditScore >= 640) creditAdj = 0.50;
  else creditAdj = 1.00;

  const propertyAdj: Record<string, number> = { 'Primary': 0, 'Investment': 0.50, '2nd Home': 0.25 };
  const rate = baseRate + creditAdj + (propertyAdj[propertyType] || 0);

  const monthlyRate = rate / 100 / 12;
  let monthlyPayment = 0;

  if (maxAvailable > 0) {
    if (product === 'CES') {
      const n = cesTerm * 12;
      monthlyPayment = Math.round(maxAvailable * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
    } else if (product === 'HELOC') {
      monthlyPayment = Math.round(maxAvailable * monthlyRate);
    } else {
      monthlyPayment = Math.round(maxAvailable * monthlyRate);
    }
  }

  return { maxAvailable, rate, monthlyPayment, maxLtv, rateType: product === 'HELOC' ? 'Variable' : 'Fixed' };
}

// Loan amount slider component
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

// Pill toggle component
function PillToggle({ options, value, onChange }: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === opt.value ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface Stage1Data {
  product?: string;
  propertyState?: string;
  propertyAddress?: string;
  propertyValue?: number;
  loanBalance?: number;
  creditScore?: number;
  propertyType?: string;
  occupancy?: string;
  structureType?: string;
  numberOfUnits?: number;
  cashOutAmount?: number;
  drawTerm?: number;
}

export default function ResultsPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [stage1, setStage1] = useState<Stage1Data>({});
  const { trackStep } = useStepTracker('stage1');
  const [leadForm, setLeadForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [cesTerm, setCesTerm] = useState<number>(20);
  const [helocTotalTerm, setHelocTotalTerm] = useState<number>(20);
  const [helocDrawTerm, setHelocDrawTerm] = useState<number>(3);
  const [helocLoanAmount, setHelocLoanAmount] = useState<number | null>(null);
  const [submittedHelocLoanAmount, setSubmittedHelocLoanAmount] = useState<number | null>(null);
  const [cesLoanAmount, setCesLoanAmount] = useState<number | null>(null);
  const [submittedCesLoanAmount, setSubmittedCesLoanAmount] = useState<number | null>(null);
  const [debouncedHelocLoanAmount, setDebouncedHelocLoanAmount] = useState<number | null>(null);
  const [debouncedCesLoanAmount, setDebouncedCesLoanAmount] = useState<number | null>(null);
  const [helocLiveQuote, setHelocLiveQuote] = useState<LiveQuoteCalc | null>(null);
  const [cesLiveQuote, setCesLiveQuote] = useState<LiveQuoteCalc | null>(null);
  const [helocPricingLoading, setHelocPricingLoading] = useState(true);
  const [cesPricingLoading, setCesPricingLoading] = useState(true);
  const skipOtp = process.env.NEXT_PUBLIC_SKIP_OTP === 'true';

  useEffect(() => {
    const raw = localStorage.getItem('stage1-data');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setStage1(parsed);
        if (parsed.helocDrawTerm) setHelocDrawTerm(Number(parsed.helocDrawTerm));
        else if (parsed.drawTerm) setHelocDrawTerm(Number(parsed.drawTerm));
        else setHelocDrawTerm(3);
      } catch {
        router.push('/quote/start');
        return;
      }
    } else {
      router.push('/quote/start');
      return;
    }
    setLoaded(true);
  }, [router]);

  const product = String(stage1.product || 'HELOC');
  const propertyValue = Number(stage1.propertyValue) || 500000;
  const loanBalance = Number(stage1.loanBalance) || 0;
  const creditScore = Number(stage1.creditScore) || 720;
  const propertyType = String(stage1.propertyType || 'Primary');
  const propertyAddress = String(stage1.propertyAddress || '');
  const propertyOccupancy = String(stage1.occupancy || 'Owner-Occupied');
  const structureType = String(stage1.structureType || 'SFR');
  const numberOfUnits = Number(stage1.numberOfUnits || 1);
  const cashOutAmount = Number(stage1.cashOutAmount) || 0;
  const helocQuote = useMemo(() =>
    calculateButtonStage1Quote(
      {
        product: 'HELOC',
        propertyState: String(stage1.propertyState || ''),
        propertyValue,
        loanBalance,
        desiredLoanAmount: cashOutAmount,
        creditScore,
        occupancy: propertyOccupancy,
        structureType,
        numberOfUnits,
        cashOut: Boolean(cashOutAmount > 0),
      },
      {
        selectedLoanAmount: submittedHelocLoanAmount ?? undefined,
        helocDrawTermYears: helocDrawTerm,
        helocTotalTermYears: helocTotalTerm,
      }
    ),
    [propertyValue, loanBalance, creditScore, propertyOccupancy, structureType, numberOfUnits, cashOutAmount, helocDrawTerm, helocTotalTerm, submittedHelocLoanAmount, stage1.propertyState]
  );

  const cesQuote = useMemo(() =>
    calculateButtonStage1Quote(
      {
        product: 'CES',
        propertyState: String(stage1.propertyState || ''),
        propertyValue,
        loanBalance,
        desiredLoanAmount: cashOutAmount,
        creditScore,
        occupancy: propertyOccupancy,
        structureType,
        numberOfUnits,
        cashOut: Boolean(cashOutAmount > 0),
      },
      {
        selectedLoanAmount: submittedCesLoanAmount ?? undefined,
        cesTermYears: cesTerm,
      }
    ),
    [propertyValue, loanBalance, creditScore, propertyOccupancy, structureType, numberOfUnits, cashOutAmount, cesTerm, submittedCesLoanAmount, stage1.propertyState]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedHelocLoanAmount(submittedHelocLoanAmount);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [submittedHelocLoanAmount]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedCesLoanAmount(submittedCesLoanAmount);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [submittedCesLoanAmount]);

  useEffect(() => {
    let cancelled = false;

    async function loadHelocQuote() {
      setHelocPricingLoading(true);
      try {
        const response = await fetch('/api/stage1-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine: 'BestX',
            input: {
              bestExProduct: 'HELOC',
              bestExDrawPeriodYears: helocDrawTerm,
              bestExTermYears: helocTotalTerm,
              bestExLockPeriodDays: 30,
              bestExDocType: 'Full Doc',
              propertyState: String(stage1.propertyState || ''),
              propertyValue,
              loanBalance,
              desiredLoanAmount: clampLoanAmount(debouncedHelocLoanAmount ?? helocQuote.maxAvailable, helocQuote.maxAvailable),
              creditScore,
              dti: 35,
              occupancy: mapStage1Occupancy(propertyType, propertyOccupancy),
              structureType: mapStructureType(structureType),
              numberOfUnits,
              cashOut: Boolean(cashOutAmount > 0),
            },
          }),
        });
        if (!response.ok) throw new Error('HELOC pricing failed');
        const pricing = await response.json() as Stage1PricingResponse;
        const eligibleResults = pricing.results.filter(result => result.eligibility.eligible);
        const bestEligible = eligibleResults[0];
        const maxAvailableAcrossEligible = eligibleResults.length
          ? Math.max(...eligibleResults.map(result => result.eligibility.maxAvailable))
          : 0;
        if (!cancelled) {
          setHelocLiveQuote(bestEligible && maxAvailableAcrossEligible >= MIN_LOAN_AMOUNT ? {
            maxAvailable: Math.round(maxAvailableAcrossEligible),
            rate: bestEligible.quote.rate,
            monthlyPayment: Math.round(bestEligible.quote.monthlyPayment),
            maxLtv: bestEligible.quote.maxLtv,
            rateType: 'Variable',
            investor: bestEligible.investor,
            program: bestEligible.quote.program,
          } : null);
        }
      } catch (error) {
        console.error('Failed to load HELOC quote', error);
        if (!cancelled) setHelocLiveQuote(null);
      } finally {
        if (!cancelled) setHelocPricingLoading(false);
      }
    }

    loadHelocQuote();
    return () => { cancelled = true; };
  }, [cashOutAmount, creditScore, debouncedHelocLoanAmount, helocDrawTerm, helocQuote.maxAvailable, helocTotalTerm, loanBalance, numberOfUnits, propertyOccupancy, propertyType, propertyValue, stage1.propertyState, structureType]);

  useEffect(() => {
    let cancelled = false;

    async function loadCesQuote() {
      setCesPricingLoading(true);
      try {
        const response = await fetch('/api/stage1-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine: 'BestX',
            input: {
              bestExProduct: 'CES',
              bestExTermYears: cesTerm,
              bestExLockPeriodDays: 30,
              bestExDocType: 'Full Doc',
              propertyState: String(stage1.propertyState || ''),
              propertyValue,
              loanBalance,
              desiredLoanAmount: clampLoanAmount(debouncedCesLoanAmount ?? cesQuote.maxAvailable, cesQuote.maxAvailable),
              creditScore,
              dti: 35,
              occupancy: mapStage1Occupancy(propertyType, propertyOccupancy),
              structureType: mapStructureType(structureType),
              numberOfUnits,
              cashOut: Boolean(cashOutAmount > 0),
            },
          }),
        });
        if (!response.ok) throw new Error('CES pricing failed');
        const pricing = await response.json() as Stage1PricingResponse;
        const eligibleResults = pricing.results.filter(result => result.eligibility.eligible);
        const bestEligible = eligibleResults[0];
        const maxAvailableAcrossEligible = eligibleResults.length
          ? Math.max(...eligibleResults.map(result => result.eligibility.maxAvailable))
          : 0;
        if (!cancelled) {
          setCesLiveQuote(bestEligible && maxAvailableAcrossEligible >= MIN_LOAN_AMOUNT ? {
            maxAvailable: Math.round(maxAvailableAcrossEligible),
            rate: bestEligible.quote.rate,
            monthlyPayment: Math.round(bestEligible.quote.monthlyPayment),
            maxLtv: bestEligible.quote.maxLtv,
            rateType: 'Fixed',
            investor: bestEligible.investor,
            program: bestEligible.quote.program,
          } : null);
        }
      } catch (error) {
        console.error('Failed to load CES quote', error);
        if (!cancelled) setCesLiveQuote(null);
      } finally {
        if (!cancelled) setCesPricingLoading(false);
      }
    }

    loadCesQuote();
    return () => { cancelled = true; };
  }, [cashOutAmount, debouncedCesLoanAmount, cesQuote.maxAvailable, cesTerm, creditScore, loanBalance, numberOfUnits, propertyOccupancy, propertyType, propertyValue, stage1.propertyState, structureType]);

  const displayedHelocQuote = helocLiveQuote
    ? { ...helocLiveQuote, maxAvailable: floorDisplayedMaxAvailable(helocLiveQuote.maxAvailable) }
    : { ...helocQuote, maxAvailable: floorDisplayedMaxAvailable(helocQuote.maxAvailable), rate: 0, monthlyPayment: 0 };
  const displayedCesQuote = cesLiveQuote
    ? { ...cesLiveQuote, maxAvailable: floorDisplayedMaxAvailable(cesLiveQuote.maxAvailable) }
    : { ...cesQuote, maxAvailable: floorDisplayedMaxAvailable(cesQuote.maxAvailable), rate: 0, monthlyPayment: 0 };

  // Initialize loan amounts to max when quotes change
  useEffect(() => {
    const defaultAmount = clampLoanAmount(displayedHelocQuote.maxAvailable, displayedHelocQuote.maxAvailable);
    if (displayedHelocQuote.maxAvailable > 0 && helocLoanAmount === null) {
      setHelocLoanAmount(defaultAmount);
    }
    if (displayedHelocQuote.maxAvailable > 0 && submittedHelocLoanAmount === null) {
      setSubmittedHelocLoanAmount(defaultAmount);
    }
  }, [displayedHelocQuote.maxAvailable, helocLoanAmount, submittedHelocLoanAmount]);

  useEffect(() => {
    const defaultAmount = clampLoanAmount(displayedCesQuote.maxAvailable, displayedCesQuote.maxAvailable);
    if (displayedCesQuote.maxAvailable > 0 && cesLoanAmount === null) {
      setCesLoanAmount(defaultAmount);
    }
    if (displayedCesQuote.maxAvailable > 0 && submittedCesLoanAmount === null) {
      setSubmittedCesLoanAmount(defaultAmount);
    }
  }, [displayedCesQuote.maxAvailable, cesLoanAmount, submittedCesLoanAmount]);

  // Clamp loan amounts to max when terms change
  useEffect(() => {
    if (helocLoanAmount !== null) {
      const clamped = clampLoanAmount(helocLoanAmount, displayedHelocQuote.maxAvailable);
      if (clamped !== helocLoanAmount) setHelocLoanAmount(clamped);
    }
    if (submittedHelocLoanAmount !== null) {
      const clamped = clampLoanAmount(submittedHelocLoanAmount, displayedHelocQuote.maxAvailable);
      if (clamped !== submittedHelocLoanAmount) setSubmittedHelocLoanAmount(clamped);
    }
  }, [displayedHelocQuote.maxAvailable, helocLoanAmount, submittedHelocLoanAmount]);

  useEffect(() => {
    if (cesLoanAmount !== null) {
      const clamped = clampLoanAmount(cesLoanAmount, displayedCesQuote.maxAvailable);
      if (clamped !== cesLoanAmount) setCesLoanAmount(clamped);
    }
    if (submittedCesLoanAmount !== null) {
      const clamped = clampLoanAmount(submittedCesLoanAmount, displayedCesQuote.maxAvailable);
      if (clamped !== submittedCesLoanAmount) setSubmittedCesLoanAmount(clamped);
    }
  }, [displayedCesQuote.maxAvailable, cesLoanAmount, submittedCesLoanAmount]);

  const effectiveHelocAmount = helocLoanAmount ?? clampLoanAmount(displayedHelocQuote.maxAvailable, displayedHelocQuote.maxAvailable);
  const appliedHelocAmount = submittedHelocLoanAmount ?? effectiveHelocAmount;
  const helocSliderDirty = effectiveHelocAmount !== appliedHelocAmount;
  const effectiveCesAmount = cesLoanAmount ?? clampLoanAmount(displayedCesQuote.maxAvailable, displayedCesQuote.maxAvailable);
  const appliedCesAmount = submittedCesLoanAmount ?? effectiveCesAmount;
  const cesSliderDirty = effectiveCesAmount !== appliedCesAmount;

  // Recalculate payments based on chosen loan amount
  const helocRepaymentYears = helocTotalTerm - helocDrawTerm;

  const isRefi = product === 'CashOut' || product === 'NoCashRefi';
  const refiQuote = useMemo(() =>
    isRefi ? calcQuote(product, propertyValue, loanBalance, creditScore, propertyType, 0) : null,
    [isRefi, product, propertyValue, loanBalance, creditScore, propertyType]
  );

  const productFullLabels: Record<string, string> = {
    'HELOC': 'Home Equity Line of Credit',
    'CES': 'Closed-End Second Mortgage',
    'CashOut': 'Cash-Out Refinance',
    'NoCashRefi': 'Rate & Term Refinance'
  };

  const productColumns = product === 'CES'
    ? ['CES', 'HELOC'] as const
    : ['HELOC', 'CES'] as const;

  const consentText = "By submitting the inquiry, I expressly consent to receive communications via automatic telephone dialing system or by artificial/pre-recorded message, email, or by text message from First Access Lending or their agents at the telephone number above (even if my number is currently listed on any state, federal, local, or corporate Do Not Call list) including my wireless number if provided, for the purpose of receiving information on mortgage products and services. Message frequency varies. Carrier message and data rates may apply. Reply HELP to a text message for help. Reply STOP to a text message to opt out. I understand that my consent is not required as a condition of purchasing any goods or services and that I may revoke my consent at any time by email to info@firstaccesslending.com or calling 1-855-605-8811. I also acknowledge that I have read and agree to the Privacy Policy and Terms and Condition. For help or additional info contact info@firstaccesslending.com.";

  async function handleRefiLeadSubmit() {
    setLeadError(null);
    if (!leadForm.firstName || !leadForm.lastName || !leadForm.email || !leadForm.phone) {
      setLeadError('Please complete all contact fields.');
      return;
    }

    setLeadSubmitting(true);
    try {
      const payload = {
        formData: {
          ...stage1,
          product: product,
          firstName: leadForm.firstName,
          lastName: leadForm.lastName,
          email: leadForm.email,
          phone: leadForm.phone,
          source: 'Refi Coming Soon Lead Capture',
          consentLanguage: consentText,
        }
      };

      const res = await fetch('/api/coming-soon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Unable to submit your request');
      }

      setLeadSubmitted(true);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : 'Unable to submit your request');
    } finally {
      setLeadSubmitting(false);
    }
  }

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

          {/* Subheading note */}
          <p className="text-center text-sm text-gray-500 mb-8">
            Select your preferred product below to continue. 100% automated — no phone calls unless you want them.
          </p>

          {/* ═══════════════════════════════════════════════ */}
          {/* HELOC + CES Side by Side (for HELOC or CES selections) */}
          {/* ═══════════════════════════════════════════════ */}
          {!isRefi && (
            <>
              {/* Two columns */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">

                {productColumns.map((columnProduct) => {
                  if (columnProduct === 'HELOC') {
                    return (
                      <div key="HELOC" className={`rounded-xl border-2 p-6 flex flex-col ${product === 'HELOC' ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">HELOC</h3>

                        <div className="bg-blue-50 rounded-lg p-4 text-center mb-5">
                          {helocPricingLoading ? (
                            <>
                              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
                              <div className="text-sm font-medium text-blue-900">Loading HELOC quote</div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs text-blue-600 font-medium mb-1">Max Available</div>
                              <div className="text-2xl font-bold text-blue-900">${displayedHelocQuote.maxAvailable.toLocaleString()}</div>
                            </>
                          )}
                        </div>

                        <div className="mb-5 bg-gray-50 rounded-lg p-4">
                          {helocPricingLoading ? (
                            <div className="text-center py-4 text-sm text-gray-500">Waiting for live pricing...</div>
                          ) : (
                            <>
                              <LoanAmountSlider
                                value={effectiveHelocAmount}
                                max={displayedHelocQuote.maxAvailable}
                                min={Math.min(MIN_LOAN_AMOUNT, displayedHelocQuote.maxAvailable)}
                                onChange={setHelocLoanAmount}
                                onCommit={setSubmittedHelocLoanAmount}
                              />
                            </>
                          )}
                        </div>

                        <div className="space-y-3 mb-5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">Total Term</span>
                            <PillToggle
                              options={[{ label: '20yr', value: 20 }, { label: '30yr', value: 30 }]}
                              value={helocTotalTerm}
                              onChange={setHelocTotalTerm}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">Draw Period</span>
                            <PillToggle
                              options={[{ label: '3yr', value: 3 }, { label: '5yr', value: 5 }, { label: '10yr', value: 10 }]}
                              value={helocDrawTerm}
                              onChange={(v) => setHelocDrawTerm(Math.min(v, helocTotalTerm - 5))}
                            />
                          </div>
                        </div>

                        <div className="mt-auto">
                          <div className="bg-green-50 rounded-lg p-4 text-center mb-3">
                            {helocPricingLoading ? (
                              <div className="text-sm font-medium text-green-900">Loading rate...</div>
                            ) : (
                              <>
                                <div className="text-xs text-green-600 font-medium mb-1">Estimated Rate</div>
                                <div className="text-2xl font-bold text-green-900">{displayedHelocQuote.rate.toFixed(3)}%</div>
                                <div className="text-xs text-green-600 mt-0.5">{displayedHelocQuote.rateType}</div>
                              </>
                            )}
                          </div>
                          <div className="bg-orange-50 rounded-lg p-4 text-center">
                            {helocPricingLoading ? (
                              <div className="text-sm font-medium text-orange-900">Loading payment...</div>
                            ) : (
                              <>
                                <div className="text-xs text-orange-600 font-medium mb-1">Est. Monthly (Draw Period)</div>
                                <div className="text-2xl font-bold text-orange-900">${displayedHelocQuote.monthlyPayment.toLocaleString()}</div>
                                <div className="text-xs text-orange-600 mt-0.5">Interest only</div>
                              </>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              const s1 = JSON.parse(localStorage.getItem('stage1-data') || '{}');
                              s1.product = 'HELOC';
                              s1.helocTotalTerm = String(helocTotalTerm);
                              s1.helocDrawTerm = String(helocDrawTerm);
                              s1.desiredLoanAmount = String(appliedHelocAmount);
                              s1.maxAvailable = String(displayedHelocQuote.maxAvailable);
                              s1.quotedInvestor = helocLiveQuote?.investor || null;
                              s1.quotedProgram = helocLiveQuote?.program || 'HELOC';
                              s1.quotedRate = displayedHelocQuote.rate;
                              s1.quotedRateType = displayedHelocQuote.rateType;
                              localStorage.setItem('stage1-data', JSON.stringify(s1));
                              void trackStep('quote-selection', 999, 999, s1);
                              router.push(skipOtp ? '/quote/next-steps' : '/quote/verify-contact');
                            }}
                            disabled={helocPricingLoading || helocSliderDirty}
                            className="w-full mt-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
                          >
                            Select HELOC &amp; Get Access! →
                          </button>
                          <p className="text-xs text-gray-400 mt-2 text-center">Fully digital until you choose otherwise</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key="CES" className={`rounded-xl border-2 p-6 flex flex-col ${product === 'CES' ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Closed-End Second</h3>

                      <div className="bg-blue-50 rounded-lg p-4 text-center mb-5">
                        {cesPricingLoading ? (
                          <>
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-200 border-t-blue-600 mb-3"></div>
                            <div className="text-sm font-medium text-blue-900">Loading CES quote</div>
                          </>
                        ) : (
                          <>
                            <div className="text-xs text-blue-600 font-medium mb-1">Max Available</div>
                            <div className="text-2xl font-bold text-blue-900">${displayedCesQuote.maxAvailable.toLocaleString()}</div>
                          </>
                        )}
                      </div>

                      <div className="mb-5 bg-gray-50 rounded-lg p-4">
                        {cesPricingLoading ? (
                          <div className="text-center py-4 text-sm text-gray-500">Waiting for live pricing...</div>
                        ) : (
                          <>
                            <LoanAmountSlider
                              value={effectiveCesAmount}
                              max={displayedCesQuote.maxAvailable}
                              min={Math.min(MIN_LOAN_AMOUNT, displayedCesQuote.maxAvailable)}
                              onChange={setCesLoanAmount}
                              onCommit={setSubmittedCesLoanAmount}
                            />
                          </>
                        )}
                      </div>

                      <div className="space-y-3 mb-5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 font-medium">Term</span>
                          <PillToggle
                            options={[{ label: '20yr', value: 20 }, { label: '30yr', value: 30 }]}
                            value={cesTerm}
                            onChange={setCesTerm}
                          />
                        </div>
                      </div>

                      <div className="mt-auto">
                        <div className="bg-green-50 rounded-lg p-4 text-center mb-3">
                          {cesPricingLoading ? (
                            <div className="text-sm font-medium text-green-900">Loading rate...</div>
                          ) : (
                            <>
                              <div className="text-xs text-green-600 font-medium mb-1">Estimated Rate</div>
                              <div className="text-2xl font-bold text-green-900">{displayedCesQuote.rate.toFixed(3)}%</div>
                              <div className="text-xs text-green-600 mt-0.5">{displayedCesQuote.rateType}</div>
                            </>
                          )}
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4 text-center">
                          {cesPricingLoading ? (
                            <div className="text-sm font-medium text-orange-900">Loading payment...</div>
                          ) : (
                            <>
                              <div className="text-xs text-orange-600 font-medium mb-1">Est. Monthly Payment</div>
                              <div className="text-2xl font-bold text-orange-900">${displayedCesQuote.monthlyPayment.toLocaleString()}</div>
                              <div className="text-xs text-orange-600 mt-0.5">Principal &amp; Interest</div>
                            </>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            const s1 = JSON.parse(localStorage.getItem('stage1-data') || '{}');
                            s1.product = 'CES';
                            s1.cesTerm = String(cesTerm);
                            s1.desiredLoanAmount = String(appliedCesAmount);
                            s1.maxAvailable = String(displayedCesQuote.maxAvailable);
                            s1.quotedInvestor = cesLiveQuote?.investor || null;
                            s1.quotedProgram = cesLiveQuote?.program || 'CES';
                            s1.quotedRate = displayedCesQuote.rate;
                            s1.quotedRateType = displayedCesQuote.rateType;
                            localStorage.setItem('stage1-data', JSON.stringify(s1));
                            void trackStep('quote-selection', 999, 999, s1);
                            router.push(skipOtp ? '/quote/next-steps' : '/quote/verify-contact');
                          }}
                          disabled={cesPricingLoading || cesSliderDirty}
                          className="w-full mt-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
                        >
                          Select CES &amp; Get Access! →
                        </button>
                        <p className="text-xs text-gray-400 mt-2 text-center">Fully digital until you choose otherwise</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* HELOC Explainer */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
                <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <span>📋</span> How a HELOC Works
                </h4>
                <ul className="text-sm text-amber-800 space-y-2">
                  <li><strong>Draw Period ({helocDrawTerm} years):</strong> Interest-only payments. Access your funds as needed, up to your credit limit. You only pay interest on what you use.</li>
                  <li><strong>No Prepayment Penalty:</strong> Pay down or pay off your balance at any time with no fees.</li>
                  <li><strong>Repayment Period ({helocRepaymentYears} years):</strong> After the draw period ends, whatever balance remains converts to a fully amortizing principal &amp; interest payment over the remaining {helocRepaymentYears} years.</li>
                  <li><strong>Example:</strong> {helocDrawTerm}-year draw + {helocRepaymentYears}-year repayment = {helocTotalTerm}-year total term.</li>
                </ul>
              </div>

              {/* CES vs HELOC comparison note */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-8">
                <p className="text-sm text-gray-700 text-center">
                  💡 A <strong>HELOC</strong> gives you a revolving credit line (draw as needed, variable rate). A <strong>Closed-End Second</strong> is a lump sum with a fixed rate and fixed monthly payment from day one.
                </p>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════ */}
          {/* Refinance (single product) */}
          {/* ═══════════════════════════════════════════════ */}
          {isRefi && refiQuote && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 text-center">
                <div className="text-sm font-semibold text-amber-800 mb-2">Instant rate quote for this product type coming soon</div>
                <p className="text-sm text-amber-700 leading-relaxed">
                  We&apos;re still finalizing the automated instant-quote flow for {productFullLabels[product]}. You can still submit your scenario now and our team will follow up with next steps and options.
                </p>
              </div>

              <div className="max-w-md mx-auto mb-8 opacity-90">
                <div className="bg-blue-50 rounded-xl p-6 text-center">
                  <div className="text-sm text-blue-600 font-medium mb-1">Estimated Max Available</div>
                  <div className="text-3xl md:text-4xl font-bold text-blue-900">${refiQuote.maxAvailable.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-white border-2 border-blue-100 rounded-2xl p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Get Matched With a Loan Specialist</h3>
                <p className="text-sm text-gray-600 mb-5">Tell us where to reach you and we&apos;ll follow up about this refinance scenario.</p>

                {leadSubmitted ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                    <div className="text-lg font-semibold text-green-800 mb-1">Thanks, we got it.</div>
                    <p className="text-sm text-green-700">Your refinance inquiry was submitted and our team will follow up soon.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <TextField label="First Name" name="firstName" value={leadForm.firstName} onChange={(name, value) => setLeadForm(prev => ({ ...prev, [name]: value }))} required />
                      <TextField label="Last Name" name="lastName" value={leadForm.lastName} onChange={(name, value) => setLeadForm(prev => ({ ...prev, [name]: value }))} required />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <TextField label="Email" name="email" type="email" value={leadForm.email} onChange={(name, value) => setLeadForm(prev => ({ ...prev, [name]: value }))} required />
                      <PhoneField label="Phone" name="phone" value={leadForm.phone} onChange={(name, value) => setLeadForm(prev => ({ ...prev, [name]: value }))} required />
                    </div>

                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {consentText}
                    </p>

                    {leadError && (
                      <div className="text-sm text-red-600">{leadError}</div>
                    )}

                    <button
                      onClick={handleRefiLeadSubmit}
                      disabled={leadSubmitting}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                      {leadSubmitting ? 'Submitting...' : 'Submit Inquiry →'}
                    </button>
                  </div>
                )}
              </div>
            </>
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
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 mt-8 text-center leading-relaxed">
            This is a preliminary estimate for informational purposes only and does not constitute a Loan Estimate 
            under TRID. We offer many programs and your actual terms may differ. Rates, fees, and availability depend 
            on verified credit, income, property value, and investor guidelines. Your full disclosures, which we can 
            deliver fully automated, should be relied upon for complete and accurate loan information.
            Not a commitment to lend. NMLS #1988098. Equal Housing Lender.
          </p>
        </div>
      </div>
    </div>
  );
}
