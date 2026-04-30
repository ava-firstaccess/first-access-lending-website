// Stage 1: Quick Qualification (Anonymous)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import QuestionCard from '@/components/quote/QuestionCard';
import QuoteBuilder from '@/components/quote/QuoteBuilder';
import AddressAutocomplete from '@/components/quote/AddressAutocomplete';
import { useStepTracker } from '@/hooks/useStepTracker';
import type { Stage1PricingResponse } from '@/lib/stage1-pricing/types';

type ProductType = 'HELOC' | 'CES' | 'CashOut' | 'NoCashRefi';

const LICENSED_STATES = new Set([
  'AL','AZ','CA','CO','CT','FL','GA','IL','MA','MD','MI','NJ','NY','OH','OR','PA','VA'
]);
const MIN_LOAN_AMOUNT = 50000;

function floorDisplayedMaxAvailable(amount: number): number {
  return amount > 0 ? Math.max(MIN_LOAN_AMOUNT, Math.round(amount)) : 0;
}

interface Stage1Data {
  product?: ProductType;
  propertyAddress?: string;
  propertyState?: string;
  propertyValue?: number;
  loanBalance?: number;
  creditScore?: number;
  propertyType?: 'Primary' | 'Investment' | '2nd Home';
  occupancy?: 'Owner-Occupied' | 'Rental';
  cashOut?: boolean;
  cashOutAmount?: number;
  structureType?: 'SFR' | 'Condo' | 'Townhouse' | 'Multi-Family' | 'PUD';
  numberOfUnits?: number;
  unitNumber?: string;
  _creditScoreInput?: string; // transient: raw text input for credit score editing
}

function mapStage1Occupancy(data: Stage1Data): 'Owner-Occupied' | 'Second Home' | 'Investment' {
  if (data.propertyType === 'Investment') return 'Investment';
  if (data.propertyType === '2nd Home') return data.occupancy === 'Rental' ? 'Investment' : 'Second Home';
  return 'Owner-Occupied';
}

function mapStage1StructureType(structureType?: Stage1Data['structureType']): 'SFR' | 'Condo' | 'Townhome' | 'PUD' | '2-4 Unit' {
  if (structureType === 'Townhouse') return 'Townhome';
  if (structureType === 'Multi-Family') return '2-4 Unit';
  return (structureType as 'SFR' | 'Condo' | 'Townhome' | 'PUD' | '2-4 Unit') || 'SFR';
}

function getDisplayRateRange(rateA: number, rateB?: number) {
  if (!rateA && !rateB) return { min: 0, max: 0 };
  if (!rateB) return { min: rateA, max: rateA };
  return {
    min: Math.min(rateA, rateB),
    max: Math.max(rateA, rateB),
  };
}

// Question flow depends on product + property type selections
function getQuestionFlow(data: Stage1Data): string[] {
  const flow: string[] = ['product', 'address', 'propertyValue', 'loanBalance', 'structureType'];

  // Condo gets unit #, multi-family gets unit count
  if (data.structureType === 'Condo' || data.structureType === 'Multi-Family') {
    flow.push('unitInfo');
  }

  flow.push('propertyType');

  // Only ask occupancy for 2nd Home
  if (data.propertyType === '2nd Home') {
    flow.push('occupancy');
  }

  // Cash-Out Refi: ask desired cash out amount
  if (data.product === 'CashOut') {
    flow.push('cashOutAmount');
  }

  flow.push('creditScore');

  return flow;
}

export default function Stage1() {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Stage1Data>({});
  const [animating, setAnimating] = useState(false);
  const [bounceRef, setBounceRef] = useState<string | null>(null);
  const [quote, setQuote] = useState({
    maxAvailable: 0,
    rateRange: { min: 0, max: 0 },
    monthlyPayment: 0,
    monthlyPaymentRange: { min: 0, max: 0 }
  });
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Visiting /quote/start should begin a fresh quote, not reuse prior local quote state.
  useEffect(() => {
    if (pathname === '/quote/start') {
      localStorage.removeItem('stage1-data');
      localStorage.removeItem('stage2-progress');
      setData({});
      setStep(0);
      setQuote({
        maxAvailable: 0,
        rateRange: { min: 0, max: 0 },
        monthlyPayment: 0,
        monthlyPaymentRange: { min: 0, max: 0 }
      });
      setQuoteLoading(false);
    }
  }, [pathname]);

  // Load prefill data from localStorage (set by verify page after OTP)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('stage1Prefill');
      if (stored) {
        const prefillData = JSON.parse(stored) as Partial<Stage1Data>;
        setData(prev => ({ ...prev, ...prefillData }));
        localStorage.removeItem('stage1Prefill'); // consume once
      }
    } catch (e) {
      console.error('Failed to load stage1 prefill:', e);
    }
  }, []);

  const { trackStep } = useStepTracker('stage1');

  const flow = getQuestionFlow(data);
  const currentQuestion = flow[step];
  const totalSteps = flow.length;
  const progress = ((step + 1) / (totalSteps + 1)) * 100; // +1 for results
  const showPendingQuoteSpinner = quoteLoading;

  // Calculate quote whenever data changes
  useEffect(() => {
    const { product, propertyValue, loanBalance, creditScore, propertyState } = data;
    const hasCreditScore = creditScore !== undefined;

    if (!propertyValue) {
      setQuoteLoading(false);
      setQuote({ maxAvailable: 0, rateRange: { min: 0, max: 0 }, monthlyPayment: 0, monthlyPaymentRange: { min: 0, max: 0 } });
      return;
    }

    if ((product === 'HELOC' || product === 'CES') && !hasCreditScore) {
      setQuoteLoading(false);
      setQuote({
        maxAvailable: 0,
        rateRange: { min: 0, max: 0 },
        monthlyPayment: 0,
        monthlyPaymentRange: { min: 0, max: 0 }
      });
      return;
    }

    if (product === 'HELOC' || product === 'CES') {
      if (!propertyState || !hasCreditScore) return;
      const timeout = window.setTimeout(async () => {
        setQuoteLoading(true);
        try {
          const buildPricingBody = (desiredLoanAmount: number) => ({
            engine: 'BestX',
            input: {
              bestExProduct: product,
              bestExDrawPeriodYears: 3,
              bestExTermYears: 20,
              bestExLockPeriodDays: 30,
              bestExDocType: 'Full Doc',
              propertyState,
              propertyValue,
              loanBalance: Number(loanBalance || 0),
              desiredLoanAmount,
              creditScore: Number(creditScore || 0),
              dti: 35,
              occupancy: mapStage1Occupancy(data),
              structureType: mapStage1StructureType(data.structureType),
              numberOfUnits: Number(data.numberOfUnits || 1),
              cashOut: false,
            }
          });

          const minResponse = await fetch('/api/stage1-pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPricingBody(MIN_LOAN_AMOUNT))
          });
          if (!minResponse.ok) throw new Error('stage1 pricing failed');

          const minPricing = await minResponse.json() as Stage1PricingResponse;
          const minEligible = minPricing.results.find(result => result.eligibility.eligible);
          if (!minEligible) {
            setQuote({ maxAvailable: 0, rateRange: { min: 0, max: 0 }, monthlyPayment: 0, monthlyPaymentRange: { min: 0, max: 0 } });
            return;
          }

          const displayedMaxAvailable = floorDisplayedMaxAvailable(minEligible.quote.maxAvailable);
          const maxResponse = await fetch('/api/stage1-pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPricingBody(displayedMaxAvailable))
          });
          if (!maxResponse.ok) throw new Error('stage1 pricing failed');

          const maxPricing = await maxResponse.json() as Stage1PricingResponse;
          const maxEligible = maxPricing.results.find(result => result.eligibility.eligible);
          const maxResult = maxEligible ?? minEligible;
          const minPayment = Math.round(minEligible.quote.monthlyPayment);
          const maxPayment = Math.round(maxResult.quote.monthlyPayment);

          setQuote({
            maxAvailable: displayedMaxAvailable,
            rateRange: getDisplayRateRange(minEligible.quote.rate, maxResult.quote.rate),
            monthlyPayment: Math.round(maxResult.quote.monthlyPayment),
            monthlyPaymentRange: {
              min: Math.min(minPayment, maxPayment),
              max: Math.max(minPayment, maxPayment),
            },
          });
        } catch (error) {
          console.error('Failed to load live Stage 1 pricing', error);
          setQuote({ maxAvailable: 0, rateRange: { min: 0, max: 0 }, monthlyPayment: 0, monthlyPaymentRange: { min: 0, max: 0 } });
        } finally {
          setQuoteLoading(false);
        }
      }, 250);
      return () => window.clearTimeout(timeout);
    }

    if (!hasCreditScore) {
      setQuoteLoading(false);
      setQuote({
        maxAvailable: 0,
        rateRange: { min: 0, max: 0 },
        monthlyPayment: 0,
        monthlyPaymentRange: { min: 0, max: 0 }
      });
      return;
    }

    console.warn('Stage 1 quote requested without API-backed pricing for product', product);
    setQuoteLoading(false);
    setQuote({
      maxAvailable: 0,
      rateRange: { min: 0, max: 0 },
      monthlyPayment: 0,
      monthlyPaymentRange: { min: 0, max: 0 }
    });
  }, [
    data.product,
    data.propertyValue,
    data.loanBalance,
    data.creditScore,
    data.propertyState,
    data.cashOutAmount,
    data.occupancy,
    data.propertyType,
    data.structureType,
    data.numberOfUnits,
  ]);

  const updateData = useCallback(<K extends keyof Stage1Data>(field: K, value: Stage1Data[K]) => {
    if (field === 'creditScore') {
      setQuote(prev => ({
        ...prev,
        rateRange: { min: 0, max: 0 },
        monthlyPayment: 0,
        monthlyPaymentRange: { min: 0, max: 0 },
      }));
    }
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const goForward = useCallback(() => {
    const nextFlow = getQuestionFlow(data);

    // Track this step completion to Supabase (async, non-blocking)
    const completedStep = nextFlow[step] || 'unknown';
    trackStep(completedStep, step, nextFlow.length, data);

    if (step + 1 >= nextFlow.length) {
      // Store Stage 1 data in localStorage (clean URLs, no size limits)
      const stage1Clean = Object.fromEntries(
        Object.entries(data).filter(([k]) => !k.startsWith('_'))
      );
      localStorage.setItem('stage1-data', JSON.stringify(stage1Clean));
      localStorage.removeItem('stage2-progress');
      router.push('/quote/results');
    } else {
      setStep(prev => prev + 1);
    }
  }, [step, data, router, trackStep]);

  // Auto-advance with bounce animation for selection-type questions
  const selectAndAdvance = useCallback(<K extends keyof Stage1Data>(field: K, value: Stage1Data[K], optionKey: string) => {
    if (animating) return;
    updateData(field, value);
    setBounceRef(optionKey);
    setAnimating(true);

    setTimeout(() => {
      setBounceRef(null);
      setAnimating(false);
      goForward();
    }, 600);
  }, [animating, goForward, updateData]);

  const goBack = () => {
    if (step > 0) setStep(prev => prev - 1);
  };

  // Selection button with bounce animation
  const SelectButton = ({ field, value, label, desc, optionKey }: {
    field: keyof Stage1Data;
    value: string | number | boolean;
    label: string;
    desc?: string;
    optionKey: string;
  }) => {
    const isSelected = data[field] === value;
    const isBouncing = bounceRef === optionKey;

    return (
      <button
        onClick={() => selectAndAdvance(field, value, optionKey)}
        className={`w-full text-left py-4 px-6 rounded-xl border-2 transition-all ${
          isSelected
            ? 'border-blue-600 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isBouncing ? 'animate-selection-bounce' : ''}`}
      >
        <div className="font-semibold text-gray-900">{label}</div>
        {desc && <div className="text-sm text-gray-600 mt-1">{desc}</div>}
      </button>
    );
  };

  const renderStep = () => {
    switch(currentQuestion) {
      case 'product':
        return (
          <QuestionCard
            title="What are you looking for?"
            subtitle="Choose the product that fits your needs"
            progress={progress}
            isValid={!!data.product}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
            showContinue={false}
          >
            <div className="space-y-3">
              <SelectButton field="product" value="HELOC" optionKey="heloc"
                label="HELOC" desc="Home Equity Line of Credit - draw as needed, variable rate" />
              <SelectButton field="product" value="CES" optionKey="ces"
                label="Closed-End Second" desc="Lump sum, fixed rate second mortgage" />
              <SelectButton field="product" value="CashOut" optionKey="cashout"
                label="Cash-Out Refinance" desc="Replace your first mortgage and take cash out" />
              <SelectButton field="product" value="NoCashRefi" optionKey="nocash"
                label="Rate & Term Refinance" desc="Lower your rate or change your term, no cash out" />
            </div>
          </QuestionCard>
        );

      case 'address':
        return (
          <QuestionCard
            title="Where's the property?"
            subtitle=""
            progress={progress}
            isValid={!!data.propertyAddress}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
          >
            <AddressAutocomplete
              value={data.propertyAddress || ''}
              onChange={(address, state, zipcode, city) => {
                setData(prev => ({ ...prev, propertyAddress: address, propertyState: state, propertyZipcode: zipcode, propertyCity: city }));
                if (state && !LICENSED_STATES.has(state)) {
                  router.push(`/quote/coming-soon?state=${encodeURIComponent(state)}&address=${encodeURIComponent(address)}`);
                  return;
                }
              }}
              placeholder="Enter address or city, state"
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
            />
          </QuestionCard>
        );

      case 'propertyValue':
        return (
          <QuestionCard
            title="What's your home worth?"
            subtitle="We'll verify with an AVM, but your estimate helps us show accurate numbers"
            progress={progress}
            isValid={!!data.propertyValue && data.propertyValue > 0}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
          >
            <div className="space-y-4">
              <input
                type="range"
                min="100000"
                max="5000000"
                step="50000"
                value={data.propertyValue || 500000}
                onChange={(e) => updateData('propertyValue', parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center">
                <div className="relative inline-block">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={(data.propertyValue || 500000).toLocaleString()}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, ''));
                      if (!isNaN(num)) updateData('propertyValue', Math.min(num, 5000000));
                    }}
                    className="text-4xl font-bold text-gray-900 text-center bg-transparent border-b-2 border-dashed border-gray-300 focus:border-blue-500 outline-none pl-9 pr-2 py-1 w-64"
                  />
                </div>
              </div>
            </div>
          </QuestionCard>
        );

      case 'loanBalance':
        return (
          <QuestionCard
            title="Current loan balance?"
            subtitle="How much do you owe on your first mortgage?"
            progress={progress}
            isValid={data.loanBalance !== undefined}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
          >
            <div className="space-y-4">
              <input
                type="range"
                min="0"
                max={data.propertyValue || 5000000}
                step="10000"
                value={data.loanBalance || 0}
                onChange={(e) => updateData('loanBalance', parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center">
                <div className="relative inline-block">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={(data.loanBalance || 0).toLocaleString()}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, ''));
                      if (!isNaN(num)) updateData('loanBalance', Math.min(num, data.propertyValue || 5000000));
                      else if (e.target.value === '') updateData('loanBalance', 0);
                    }}
                    className="text-4xl font-bold text-gray-900 text-center bg-transparent border-b-2 border-dashed border-gray-300 focus:border-blue-500 outline-none pl-9 pr-2 py-1 w-64"
                  />
                </div>
                <button
                  onClick={() => updateData('loanBalance', 0)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium block mx-auto"
                >
                  Property is free & clear
                </button>
              </div>
            </div>
          </QuestionCard>
        );

      case 'creditScore': {
        const scoreValue = data.creditScore ?? 720;
        const scoreDisplay = data._creditScoreInput !== undefined ? data._creditScoreInput : String(scoreValue);
        const sliderScore = (() => {
          const parsed = parseInt(scoreDisplay, 10);
          return !isNaN(parsed) && parsed >= 580 && parsed <= 850 ? parsed : scoreValue;
        })();
        const commitSliderScore = (rawValue: string) => {
          const v = parseInt(rawValue, 10);
          if (!isNaN(v) && v >= 580 && v <= 850) {
            updateData('creditScore', v);
            updateData('_creditScoreInput', String(v));
          }
        };
        return (
          <QuestionCard
            title="Your credit score?"
            subtitle="Your best estimate - we'll verify later"
            progress={progress}
            isValid={!!data.creditScore && !quoteLoading}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
            continueText={quoteLoading ? "Loading rate..." : "Next Step: Customize"}
          >
            <div className="space-y-4">
              <input
                type="range"
                min="580"
                max="850"
                step="5"
                value={sliderScore}
                onChange={(e) => {
                  updateData('_creditScoreInput', e.target.value);
                }}
                onMouseUp={(e) => commitSliderScore((e.target as HTMLInputElement).value)}
                onTouchEnd={(e) => commitSliderScore((e.target as HTMLInputElement).value)}
                onKeyUp={(e) => commitSliderScore((e.target as HTMLInputElement).value)}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center">
                <input
                  type="text"
                  inputMode="numeric"
                  value={scoreDisplay}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    updateData('_creditScoreInput', raw);
                    const num = parseInt(raw);
                    if (!isNaN(num) && num >= 300 && num <= 850) {
                      updateData('creditScore', num);
                    }
                  }}
                  onBlur={() => {
                    // Snap back to valid value on blur
                    updateData('_creditScoreInput', String(data.creditScore || 720));
                  }}
                  className="text-5xl font-bold text-gray-900 text-center bg-transparent border-b-2 border-dashed border-gray-300 focus:border-blue-500 outline-none w-32 mx-auto"
                  maxLength={3}
                />
                <p className="text-sm text-gray-600 mt-2">
                  {scoreValue >= 740 ? 'Excellent' :
                   scoreValue >= 700 ? 'Good' :
                   scoreValue >= 660 ? 'Fair' : 'Below Average'}
                </p>
              </div>
            </div>
          </QuestionCard>
        );
      }

      case 'propertyType':
        return (
          <QuestionCard
            title="Property type?"
            subtitle="This affects your max loan amount"
            progress={progress}
            isValid={!!data.propertyType}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
            showContinue={false}
          >
            <div className="space-y-3">
              <SelectButton field="propertyType" value="Primary" optionKey="primary"
                label="Primary Residence" desc="You live here" />
              <SelectButton field="propertyType" value="Investment" optionKey="investment"
                label="Investment Property" desc="Rental property" />
              <SelectButton field="propertyType" value="2nd Home" optionKey="2ndhome"
                label="Second Home" desc="Vacation home" />
            </div>
          </QuestionCard>
        );

      case 'occupancy':
        return (
          <QuestionCard
            title="Do you live there?"
            subtitle="Occupancy status"
            progress={progress}
            isValid={!!data.occupancy}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
            showContinue={false}
          >
            <div className="space-y-3">
              <SelectButton field="occupancy" value="Owner-Occupied" optionKey="owner"
                label="Yes, I live there" />
              <SelectButton field="occupancy" value="Rental" optionKey="rental"
                label="No, it's rented out" />
            </div>
          </QuestionCard>
        );

      case 'structureType':
        return (
          <QuestionCard
            title="What type of property is it?"
            subtitle="This affects pricing and available programs"
            progress={progress}
            isValid={!!data.structureType}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
            showContinue={false}
          >
            <div className="space-y-3">
              <SelectButton field="structureType" value="SFR" optionKey="sfr"
                label="Single Family" desc="Detached single family home" />
              <SelectButton field="structureType" value="Condo" optionKey="condo"
                label="Condo" desc="Condominium unit" />
              <SelectButton field="structureType" value="Townhouse" optionKey="townhouse"
                label="Townhouse" desc="Attached townhome" />
              <SelectButton field="structureType" value="Multi-Family" optionKey="multifamily"
                label="Multi-Family" desc="2-4 unit property" />
              <SelectButton field="structureType" value="PUD" optionKey="pud"
                label="PUD" desc="Planned Unit Development" />
            </div>
          </QuestionCard>
        );

      case 'unitInfo':
        return (
          <QuestionCard
            title={data.structureType === 'Multi-Family' ? 'How many units?' : 'Unit number?'}
            subtitle={data.structureType === 'Multi-Family' ? 'Total number of units in the property (2-4)' : 'Your condo unit number'}
            progress={progress}
            isValid={data.structureType === 'Multi-Family' ? !!data.numberOfUnits : true}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
            showContinue={data.structureType !== 'Multi-Family'}
          >
            {data.structureType === 'Multi-Family' ? (
              <div className="space-y-3">
                <SelectButton field="numberOfUnits" value={2} optionKey="units2" label="2 Units" />
                <SelectButton field="numberOfUnits" value={3} optionKey="units3" label="3 Units" />
                <SelectButton field="numberOfUnits" value={4} optionKey="units4" label="4 Units" />
              </div>
            ) : (
              <input
                type="text"
                placeholder="e.g. 4B, 201, etc."
                value={data.unitNumber || ''}
                onChange={(e) => updateData('unitNumber', e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            )}
          </QuestionCard>
        );

      case 'cashOutAmount':
        const currentBalance = data.loanBalance || 0;
        const cashDesired = data.cashOutAmount || 50000;
        const newLoanAmount = currentBalance + cashDesired;
        return (
          <QuestionCard
            title="How much cash do you need?"
            progress={progress}
            isValid={!!data.cashOutAmount && data.cashOutAmount > 0}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
          >
            <div className="space-y-4">
              <input
                type="range"
                min="10000"
                max={Math.max(500000, (data.propertyValue || 500000) - currentBalance)}
                step="5000"
                value={cashDesired}
                onChange={(e) => updateData('cashOutAmount', parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center">
                <div className="relative inline-block">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cashDesired.toLocaleString()}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, ''));
                      const maxVal = Math.max(500000, (data.propertyValue || 500000) - currentBalance);
                      if (!isNaN(num)) updateData('cashOutAmount', Math.min(Math.max(num, 0), maxVal));
                    }}
                    className="text-4xl font-bold text-gray-900 text-center bg-transparent border-b-2 border-dashed border-gray-300 focus:border-blue-500 outline-none pl-9 pr-2 py-1 w-64"
                  />
                </div>
              </div>

              {/* New loan breakdown */}
              <div className="bg-gray-50 rounded-xl p-4 mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Current balance</span>
                  <span>${currentBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Cash out</span>
                  <span>+ ${cashDesired.toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold text-gray-900">
                  <span>New loan amount</span>
                  <span>${newLoanAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">*Closing costs calculated after verification</p>
              </div>
            </div>
          </QuestionCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      {/* Bounce animation CSS */}
      <style jsx global>{`
        @keyframes selectionBounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.04); }
          50% { transform: scale(0.98); }
          70% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        .animate-selection-bounce {
          animation: selectionBounce 0.5s ease-in-out;
        }
      `}</style>

      <div className="container mx-auto px-4">
        
        {/* Desktop: Two Column Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            {renderStep()}
          </div>
          <div className="lg:col-span-1">
            <QuoteBuilder
              maxAvailable={quote.maxAvailable}
              rateRange={quote.rateRange}
              monthlyPayment={quote.monthlyPayment}
              monthlyPaymentRange={quote.monthlyPaymentRange}
              progress={progress}
              stage="stage1"
              loading={showPendingQuoteSpinner}
            />
          </div>
        </div>

        {/* Mobile: Stacked Layout */}
        <div className="lg:hidden space-y-6">
          {renderStep()}
          <QuoteBuilder
            maxAvailable={quote.maxAvailable}
            rateRange={quote.rateRange}
            monthlyPayment={quote.monthlyPayment}
            monthlyPaymentRange={quote.monthlyPaymentRange}
            progress={progress}
            stage="stage1"
            loading={showPendingQuoteSpinner}
          />
        </div>

      </div>
    </div>
  );
}
