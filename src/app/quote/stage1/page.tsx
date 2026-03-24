// Stage 1: Quick Qualification (Anonymous, 7 Questions)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QuestionCard from '@/components/quote/QuestionCard';
import QuoteBuilder from '@/components/quote/QuoteBuilder';
import AddressAutocomplete from '@/components/quote/AddressAutocomplete';

interface Stage1Data {
  propertyAddress?: string;
  propertyValue?: number;
  loanBalance?: number;
  creditScore?: string;
  propertyType?: 'Primary' | 'Investment' | '2nd Home';
  occupancy?: 'Owner-Occupied' | 'Rental';
  cashOut?: boolean;
  cashOutAmount?: number;
}

export default function Stage1() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Stage1Data>({});
  const [quote, setQuote] = useState({
    maxAvailable: 0,
    rateRange: { min: 0, max: 0 },
    monthlyPayment: 0
  });

  // Calculate quote whenever data changes
  useEffect(() => {
    calculateQuote();
  }, [data]);

  const calculateQuote = () => {
    const {
      propertyValue,
      loanBalance,
      creditScore,
      propertyType,
      cashOutAmount
    } = data;

    if (!propertyValue || !creditScore) return;

    // LTV limits by credit score + property type
    const ltvLimits: Record<string, Record<string, number>> = {
      'Primary': { '720+': 0.90, '680-719': 0.85, '640-679': 0.80, '<640': 0.70 },
      'Investment': { '720+': 0.80, '680-719': 0.75, '640-679': 0.70, '<640': 0.60 },
      '2nd Home': { '720+': 0.85, '680-719': 0.80, '640-679': 0.75, '<640': 0.65 }
    };

    const propType = propertyType || 'Primary';
    const maxLtv = ltvLimits[propType]?.[creditScore] || 0.80;
    const maxLoan = propertyValue * maxLtv;
    const currentBalance = loanBalance || 0;
    const maxAvailable = Math.max(0, maxLoan - currentBalance - (cashOutAmount || 0));

    // Rate adjustments
    const baseRate = 7.50;
    const creditAdj: Record<string, number> = {
      '720+': 0.00,
      '680-719': 0.25,
      '640-679': 0.50,
      '<640': 1.00
    };
    const propertyAdj: Record<string, number> = {
      'Primary': 0.00,
      'Investment': 0.50,
      '2nd Home': 0.25
    };

    const rate = baseRate + (creditAdj[creditScore] || 0) + (propertyAdj[propType] || 0);
    const rateRange = { min: rate, max: rate + 0.5 };

    // Simple payment calc (10-year HELOC, interest-only estimate)
    const monthlyRate = rate / 100 / 12;
    const monthlyPayment = maxAvailable > 0 ? maxAvailable * monthlyRate : 0;

    setQuote({
      maxAvailable: Math.round(maxAvailable),
      rateRange,
      monthlyPayment: Math.round(monthlyPayment)
    });
  };

  const updateData = (field: keyof Stage1Data, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const progress = (step / 7) * 100;

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <QuestionCard
            title="Where's the property?"
            subtitle="We'll verify this later, just need a rough location"
            progress={progress}
            isValid={!!data.propertyAddress}
            onContinue={() => setStep(2)}
          >
            <AddressAutocomplete
              value={data.propertyAddress || ''}
              onChange={(address) => updateData('propertyAddress', address)}
              placeholder="Enter address or city, state"
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
            />
          </QuestionCard>
        );

      case 2:
        return (
          <QuestionCard
            title="What's your home worth?"
            subtitle="We'll verify with an AVM, but your estimate helps us show accurate numbers"
            progress={progress}
            isValid={!!data.propertyValue && data.propertyValue > 0}
            onContinue={() => setStep(3)}
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
                <div className="text-4xl font-bold text-gray-900">
                  ${(data.propertyValue || 500000).toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 mt-2">Drag slider to adjust</p>
              </div>
            </div>
          </QuestionCard>
        );

      case 3:
        return (
          <QuestionCard
            title="Current loan balance?"
            subtitle="How much do you owe on your first mortgage?"
            progress={progress}
            isValid={data.loanBalance !== undefined}
            onContinue={() => setStep(4)}
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
                <div className="text-4xl font-bold text-gray-900">
                  ${(data.loanBalance || 0).toLocaleString()}
                </div>
                <button
                  onClick={() => updateData('loanBalance', 0)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Property is free & clear
                </button>
              </div>
            </div>
          </QuestionCard>
        );

      case 4:
        return (
          <QuestionCard
            title="Your credit score?"
            subtitle="Self-reported is fine for now"
            progress={progress}
            isValid={!!data.creditScore}
            onContinue={() => setStep(5)}
          >
            <div className="grid grid-cols-2 gap-4">
              {['720+', '680-719', '640-679', '<640'].map(score => (
                <button
                  key={score}
                  onClick={() => updateData('creditScore', score)}
                  className={`py-4 px-6 rounded-xl border-2 font-semibold transition-all ${
                    data.creditScore === score
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </QuestionCard>
        );

      case 5:
        return (
          <QuestionCard
            title="Property type?"
            subtitle="This affects your max loan amount"
            progress={progress}
            isValid={!!data.propertyType}
            onContinue={() => setStep(6)}
          >
            <div className="space-y-3">
              {[
                { value: 'Primary', label: 'Primary Residence', desc: 'You live here' },
                { value: 'Investment', label: 'Investment Property', desc: 'Rental or flip' },
                { value: '2nd Home', label: 'Second Home', desc: 'Vacation home' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => updateData('propertyType', option.value as any)}
                  className={`w-full text-left py-4 px-6 rounded-xl border-2 transition-all ${
                    data.propertyType === option.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-600 mt-1">{option.desc}</div>
                </button>
              ))}
            </div>
          </QuestionCard>
        );

      case 6:
        return (
          <QuestionCard
            title="Do you live there?"
            subtitle="Occupancy status"
            progress={progress}
            isValid={!!data.occupancy}
            onContinue={() => setStep(7)}
          >
            <div className="space-y-3">
              {[
                { value: 'Owner-Occupied', label: 'Yes, I live there' },
                { value: 'Rental', label: "No, it's rented out" }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => updateData('occupancy', option.value as any)}
                  className={`w-full py-4 px-6 rounded-xl border-2 font-semibold transition-all ${
                    data.occupancy === option.value
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </QuestionCard>
        );

      case 7:
        return (
          <QuestionCard
            title="Need cash out?"
            subtitle="Are you refinancing to pull cash out?"
            progress={progress}
            isValid={data.cashOut !== undefined}
            onContinue={() => router.push('/quote/stage1/results')}
          >
            <div className="space-y-3">
              <button
                onClick={() => updateData('cashOut', false)}
                className={`w-full py-4 px-6 rounded-xl border-2 font-semibold transition-all ${
                  data.cashOut === false
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
              >
                No, just refinancing
              </button>
              <button
                onClick={() => updateData('cashOut', true)}
                className={`w-full py-4 px-6 rounded-xl border-2 font-semibold transition-all ${
                  data.cashOut === true
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-700'
                }`}
              >
                Yes, I want cash out
              </button>
            </div>

            {data.cashOut === true && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How much cash do you need?
                </label>
                <input
                  type="range"
                  min="10000"
                  max="500000"
                  step="5000"
                  value={data.cashOutAmount || 50000}
                  onChange={(e) => updateData('cashOutAmount', parseInt(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-center text-2xl font-bold text-gray-900 mt-4">
                  ${(data.cashOutAmount || 50000).toLocaleString()}
                </div>
              </div>
            )}
          </QuestionCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
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
              progress={progress}
              stage="stage1"
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
            progress={progress}
            stage="stage1"
          />
        </div>

      </div>
    </div>
  );
}
