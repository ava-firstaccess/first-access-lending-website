// Stage 1: Quick Qualification (Anonymous)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import QuestionCard from '@/components/quote/QuestionCard';
import QuoteBuilder from '@/components/quote/QuoteBuilder';
import AddressAutocomplete from '@/components/quote/AddressAutocomplete';

type ProductType = 'HELOC' | 'CES' | 'CashOut' | 'NoCashRefi';

interface Stage1Data {
  product?: ProductType;
  propertyAddress?: string;
  propertyValue?: number;
  loanBalance?: number;
  creditScore?: number;
  propertyType?: 'Primary' | 'Investment' | '2nd Home';
  occupancy?: 'Owner-Occupied' | 'Rental';
  cashOut?: boolean;
  cashOutAmount?: number;
  drawTerm?: number; // HELOC draw period in years
}

// Question flow depends on product + property type selections
function getQuestionFlow(data: Stage1Data): string[] {
  const flow: string[] = ['product', 'address', 'propertyValue', 'loanBalance', 'creditScore', 'propertyType'];
  
  // Only ask occupancy for 2nd Home (Primary = owner-occupied, Investment = not owner-occupied)
  if (data.propertyType === '2nd Home') {
    flow.push('occupancy');
  }

  // HELOC gets draw term question
  if (data.product === 'HELOC') {
    flow.push('drawTerm');
  }

  // Cash-Out Refi: ask desired cash out amount (they keep existing balance + get cash)
  if (data.product === 'CashOut') {
    flow.push('cashOutAmount');
  }
  // HELOC/CES: no cash out question - max available IS the cash they get
  // NoCashRefi: no cash out at all

  return flow;
}

export default function Stage1() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Stage1Data>({});
  const [animating, setAnimating] = useState(false);
  const [bounceRef, setBounceRef] = useState<string | null>(null);
  const [quote, setQuote] = useState({
    maxAvailable: 0,
    rateRange: { min: 0, max: 0 },
    monthlyPayment: 0
  });

  const flow = getQuestionFlow(data);
  const currentQuestion = flow[step];
  const totalSteps = flow.length;
  const progress = ((step + 1) / (totalSteps + 1)) * 100; // +1 for results

  // Calculate quote whenever data changes
  useEffect(() => {
    calculateQuote();
  }, [data]);

  const calculateQuote = () => {
    const { propertyValue, loanBalance, creditScore, propertyType, cashOutAmount, product, drawTerm } = data;
    if (!propertyValue || !creditScore) return;

    // LTV limits by credit score + property type
    const propType = propertyType || 'Primary';
    const score = creditScore;
    
    let maxLtv = 0.80;
    if (score >= 720) {
      maxLtv = propType === 'Primary' ? 0.90 : propType === '2nd Home' ? 0.85 : 0.80;
    } else if (score >= 680) {
      maxLtv = propType === 'Primary' ? 0.85 : propType === '2nd Home' ? 0.80 : 0.75;
    } else if (score >= 640) {
      maxLtv = propType === 'Primary' ? 0.80 : propType === '2nd Home' ? 0.75 : 0.70;
    } else {
      maxLtv = propType === 'Primary' ? 0.70 : propType === '2nd Home' ? 0.65 : 0.60;
    }

    const maxLoan = propertyValue * maxLtv;
    const currentBalance = loanBalance || 0;
    
    let maxAvailable: number;
    if (product === 'CashOut') {
      maxAvailable = Math.max(0, maxLoan - currentBalance - (cashOutAmount || 0));
    } else if (product === 'NoCashRefi') {
      maxAvailable = Math.max(0, maxLoan - currentBalance);
    } else {
      // HELOC/CES: max available IS the cash they can get
      maxAvailable = Math.max(0, maxLoan - currentBalance);
    }

    // Rate adjustments
    let baseRate = 7.50;
    
    // Product adjustments
    if (product === 'HELOC') {
      baseRate = 7.25; // Variable rate, slightly lower start
      // Draw term adjustment
      if (drawTerm === 5) baseRate -= 0.25;
      else if (drawTerm === 15) baseRate += 0.25;
    } else if (product === 'CES') {
      baseRate = 8.00; // Fixed rate, slightly higher
    }
    
    // Credit adjustments
    let creditAdj = 0;
    if (score >= 720) creditAdj = 0;
    else if (score >= 680) creditAdj = 0.25;
    else if (score >= 640) creditAdj = 0.50;
    else creditAdj = 1.00;

    const propertyAdj: Record<string, number> = {
      'Primary': 0.00,
      'Investment': 0.50,
      '2nd Home': 0.25
    };

    const rate = baseRate + creditAdj + (propertyAdj[propType] || 0);
    const rateRange = { min: rate, max: rate + 0.5 };

    // Payment calc
    const monthlyRate = rate / 100 / 12;
    const monthlyPayment = maxAvailable > 0 ? maxAvailable * monthlyRate : 0;

    setQuote({
      maxAvailable: Math.round(maxAvailable),
      rateRange,
      monthlyPayment: Math.round(monthlyPayment)
    });
  };

  const updateData = useCallback((field: keyof Stage1Data, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Auto-advance with bounce animation for selection-type questions
  const selectAndAdvance = useCallback((field: keyof Stage1Data, value: any, optionKey: string) => {
    if (animating) return;
    updateData(field, value);
    setBounceRef(optionKey);
    setAnimating(true);

    // Double bounce then advance
    setTimeout(() => {
      setBounceRef(null);
      setAnimating(false);
      goForward();
    }, 600);
  }, [animating, step, flow]);

  const goForward = useCallback(() => {
    const nextFlow = getQuestionFlow(data);
    if (step + 1 >= nextFlow.length) {
      router.push('/quote/stage1/results?' + new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      }).toString());
    } else {
      setStep(prev => prev + 1);
    }
  }, [step, data, router]);

  const goBack = () => {
    if (step > 0) setStep(prev => prev - 1);
  };

  // Selection button with bounce animation
  const SelectButton = ({ field, value, label, desc, optionKey }: {
    field: keyof Stage1Data;
    value: any;
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
              onChange={(address) => updateData('propertyAddress', address)}
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
                <div className="text-4xl font-bold text-gray-900">
                  ${(data.propertyValue || 500000).toLocaleString()}
                </div>
                <p className="text-sm text-gray-600 mt-2">Drag slider to adjust</p>
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

      case 'creditScore':
        return (
          <QuestionCard
            title="Your credit score?"
            subtitle="Your best estimate - we'll verify later"
            progress={progress}
            isValid={!!data.creditScore}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
          >
            <div className="space-y-4">
              <input
                type="range"
                min="580"
                max="850"
                step="5"
                value={data.creditScore || 720}
                onChange={(e) => updateData('creditScore', parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900">
                  {data.creditScore || 720}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {(data.creditScore || 720) >= 740 ? 'Excellent' :
                   (data.creditScore || 720) >= 700 ? 'Good' :
                   (data.creditScore || 720) >= 660 ? 'Fair' : 'Below Average'}
                </p>
              </div>
            </div>
          </QuestionCard>
        );

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

      case 'drawTerm':
        return (
          <QuestionCard
            title="HELOC draw period?"
            subtitle="How long do you want to access funds? Shorter terms = lower rates"
            progress={progress}
            isValid={!!data.drawTerm}
            onContinue={goForward}
            onBack={step > 0 ? goBack : undefined}
            showContinue={false}
          >
            <div className="space-y-3">
              <SelectButton field="drawTerm" value={5} optionKey="draw5"
                label="5 Years" desc="Lower rate, shorter access" />
              <SelectButton field="drawTerm" value={10} optionKey="draw10"
                label="10 Years" desc="Standard draw period" />
              <SelectButton field="drawTerm" value={15} optionKey="draw15"
                label="15 Years" desc="Longer access, slightly higher rate" />
            </div>
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
                <div className="text-4xl font-bold text-gray-900">
                  ${cashDesired.toLocaleString()}
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
