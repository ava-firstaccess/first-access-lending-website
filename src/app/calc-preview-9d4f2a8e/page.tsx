'use client';

import { useState, useEffect } from 'react';

interface TaxBracket {
  rate: number;
  min: number;
  max: number;
}

// 2025 Federal Tax Brackets (Single Filer)
const TAX_BRACKETS_SINGLE: TaxBracket[] = [
  { rate: 0.10, min: 0, max: 11600 },
  { rate: 0.12, min: 11601, max: 47150 },
  { rate: 0.22, min: 47151, max: 100525 },
  { rate: 0.24, min: 100526, max: 191950 },
  { rate: 0.32, min: 191951, max: 243725 },
  { rate: 0.35, min: 243726, max: 609350 },
  { rate: 0.37, min: 609351, max: Infinity },
];

// 2025 Federal Tax Brackets (Married Filing Jointly)
const TAX_BRACKETS_MARRIED: TaxBracket[] = [
  { rate: 0.10, min: 0, max: 23200 },
  { rate: 0.12, min: 23201, max: 94300 },
  { rate: 0.22, min: 94301, max: 201050 },
  { rate: 0.24, min: 201051, max: 383900 },
  { rate: 0.32, min: 383901, max: 487450 },
  { rate: 0.35, min: 487451, max: 731200 },
  { rate: 0.37, min: 731201, max: Infinity },
];

// State income tax rates (2025 estimates - simplified)
// Using marginal rates for typical income levels
const STATE_TAX_RATES: { [key: string]: number } = {
  'AL': 0.05, 'AK': 0, 'AZ': 0.045, 'AR': 0.055, 'CA': 0.093,
  'CO': 0.044, 'CT': 0.0699, 'DE': 0.066, 'FL': 0, 'GA': 0.0575,
  'HI': 0.11, 'ID': 0.058, 'IL': 0.0495, 'IN': 0.0315, 'IA': 0.06,
  'KS': 0.057, 'KY': 0.045, 'LA': 0.0425, 'ME': 0.0715, 'MD': 0.0575,
  'MA': 0.05, 'MI': 0.0425, 'MN': 0.0985, 'MS': 0.05, 'MO': 0.054,
  'MT': 0.0675, 'NE': 0.0684, 'NV': 0, 'NH': 0, 'NJ': 0.1075,
  'NM': 0.059, 'NY': 0.109, 'NC': 0.0475, 'ND': 0.029, 'OH': 0.039,
  'OK': 0.05, 'OR': 0.099, 'PA': 0.0307, 'RI': 0.0599, 'SC': 0.07,
  'SD': 0, 'TN': 0, 'TX': 0, 'UT': 0.0465, 'VT': 0.0875,
  'VA': 0.0575, 'WA': 0, 'WV': 0.065, 'WI': 0.0765, 'WY': 0,
  'DC': 0.1075,
};

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington DC' },
];

export default function MortgageCalculator() {
  // Mortgage inputs
  const [homePrice, setHomePrice] = useState<number>(400000);
  const [downPayment, setDownPayment] = useState<number>(20000); // 5% default
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(5); // 5% default
  const [interestRate, setInterestRate] = useState<number>(0); // Will be populated by API
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [propertyTaxRate, setPropertyTaxRate] = useState<number>(1.2);
  const [propertyTaxAnnual, setPropertyTaxAnnual] = useState<number>(4800); // 1.2% of $400k = $4800
  const [homeInsurance, setHomeInsurance] = useState<number>(1500);
  const [hoaFees, setHoaFees] = useState<number>(0);
  const [loanType, setLoanType] = useState<'conventional' | 'fha' | 'va'>('conventional');

  // Tax savings inputs
  const [showTaxSavings, setShowTaxSavings] = useState<boolean>(true);
  const [filingStatus, setFilingStatus] = useState<'single' | 'married'>('married');
  const [agi, setAgi] = useState<number>(150000);
  const [state, setState] = useState<string>('CA');
  const [charitableDonations, setCharitableDonations] = useState<number>(0);
  const [medicalExpenses, setMedicalExpenses] = useState<number>(0);
  const [email, setEmail] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [showDeductionBreakdown, setShowDeductionBreakdown] = useState<boolean>(false);

  // Store fetched rates
  const [fetchedRates, setFetchedRates] = useState<{ conventional: number | null; fha: number | null; va: number | null }>({
    conventional: null,
    fha: null,
    va: null,
  });

  // Fetch current market rates on mount
  useEffect(() => {
    async function fetchCurrentRates() {
      try {
        const response = await fetch('/api/current-rate');
        if (response.ok) {
          const data = await response.json();
          setFetchedRates({
            conventional: data.conventional || null,
            fha: data.fha || null,
            va: data.va || null,
          });
          
          // Set initial rate based on default loan type (conventional)
          if (data.conventional) {
            setInterestRate(data.conventional);
          }
        }
      } catch (error) {
        console.error('Failed to fetch current rates:', error);
        // Leave blank if fetch fails
      }
    }
    fetchCurrentRates();
  }, []);

  // Update interest rate when loan type changes
  useEffect(() => {
    const rate = loanType === 'conventional' 
      ? fetchedRates.conventional 
      : loanType === 'fha' 
        ? fetchedRates.fha 
        : fetchedRates.va;
    if (rate) {
      setInterestRate(rate);
    }
  }, [loanType, fetchedRates]);

  // Handlers to keep down payment dollar and percent in sync
  const handleDownPaymentDollarChange = (value: number) => {
    const rounded = Math.round(value);
    setDownPayment(rounded);
    setDownPaymentPercent(Math.round((rounded / homePrice) * 1000) / 10); // Round to 1 decimal
  };

  const handleDownPaymentPercentChange = (value: number) => {
    // Enforce minimum down payment based on loan type
    const minDown = loanType === 'va' ? 0 : loanType === 'fha' ? 3.5 : 5;
    const constrainedValue = Math.max(minDown, value);
    setDownPaymentPercent(Math.round(constrainedValue * 10) / 10); // Round to 1 decimal
    setDownPayment(Math.round((constrainedValue / 100) * homePrice));
  };

  const handleHomePriceChange = (value: number) => {
    const rounded = Math.round(value);
    setHomePrice(rounded);
    // Recalculate down payment dollar amount based on current percent
    setDownPayment(Math.round((downPaymentPercent / 100) * rounded));
    // Recalculate property tax dollar amount based on current rate
    setPropertyTaxAnnual(Math.round((propertyTaxRate / 100) * rounded));
  };

  const handlePropertyTaxRateChange = (value: number) => {
    const roundedRate = Math.round(value * 10) / 10; // Round to 1 decimal
    setPropertyTaxRate(roundedRate);
    setPropertyTaxAnnual(Math.round((roundedRate / 100) * homePrice));
  };

  const handlePropertyTaxDollarChange = (value: number) => {
    const rounded = Math.round(value);
    setPropertyTaxAnnual(rounded);
    setPropertyTaxRate(Math.round((rounded / homePrice) * 1000) / 10); // Round to 1 decimal
  };

  // Calculate mortgage details
  const loanAmount = homePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;
  
  // Monthly P&I using standard mortgage formula
  const monthlyPI = loanAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  const monthlyPropertyTax = (homePrice * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = homeInsurance / 12;
  const monthlyHOA = hoaFees;
  
  // PMI/MIP calculation
  const ltv = (loanAmount / homePrice) * 100;
  let pmiRate = 0;
  let needsPMI = false;
  
  if (loanType === 'conventional') {
    // Conventional PMI required if down payment < 20% (LTV > 80%)
    needsPMI = ltv > 80;
    if (needsPMI) {
      if (ltv > 90) pmiRate = 0.0024; // 90-95% LTV: 0.24%
      else pmiRate = 0.0017; // <90% LTV: 0.17%
    }
  } else if (loanType === 'fha') {
    // FHA MIP (Mortgage Insurance Premium) - always required
    needsPMI = true;
    // Annual MIP rates for base loan amounts, 30-year term
    if (ltv > 95) pmiRate = 0.0085; // >95% LTV: 0.85%
    else pmiRate = 0.0080; // ≤95% LTV: 0.80%
  }
  // VA loans: no PMI/MIP
  
  const monthlyPMI = needsPMI ? (loanAmount * pmiRate) / 12 : 0;
  
  const totalMonthlyPayment = monthlyPI + monthlyPropertyTax + monthlyInsurance + monthlyHOA + monthlyPMI;

  // Tax deduction calculations
  const year1Interest = calculateFirstYearInterest(loanAmount, monthlyRate, numPayments);
  const year1PropertyTax = monthlyPropertyTax * 12;
  const year1PMI = monthlyPMI * 12; // PMI deductible for some income levels
  
  // State income tax deduction
  const stateIncomeTaxRate = STATE_TAX_RATES[state] || 0;
  const stateIncomeTaxPaid = agi * stateIncomeTaxRate;
  
  // SALT cap: $10,000 limit on state/local tax deduction
  const saltDeduction = Math.min(10000, stateIncomeTaxPaid + year1PropertyTax);
  
  // Medical expenses: only deductible if > 7.5% of AGI
  const medicalThreshold = agi * 0.075;
  const deductibleMedical = Math.max(0, medicalExpenses - medicalThreshold);
  
  // Total itemized deductions
  const totalDeductions = year1Interest + saltDeduction + (agi < 100000 ? year1PMI : 0) + charitableDonations + deductibleMedical;

  // Standard deduction (2025)
  const standardDeduction = filingStatus === 'married' ? 29200 : 14600;
  
  // Calculate tax bracket and savings
  const brackets = filingStatus === 'married' ? TAX_BRACKETS_MARRIED : TAX_BRACKETS_SINGLE;
  const marginalTaxRate = getMarginalTaxRate(agi, brackets);
  
  // Tax savings calculation
  const taxSavings = totalDeductions > standardDeduction 
    ? (totalDeductions - standardDeduction) * marginalTaxRate 
    : 0;
  const monthlySavings = taxSavings / 12;
  const effectiveMonthlyPayment = totalMonthlyPayment - monthlySavings;

  async function handleEmailPDF() {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/send-calculator-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          loanType,
          homePrice,
          downPayment,
          loanAmount,
          interestRate,
          loanTerm,
          monthlyPI,
          propertyTaxRate,
          monthlyPropertyTax,
          homeInsurance,
          monthlyInsurance,
          hoaFees,
          monthlyPMI,
          pmiRate,
          totalMonthlyPayment,
          showTaxSavings,
          filingStatus,
          agi,
          state,
          year1Interest,
          year1PropertyTax,
          year1PMI,
          stateIncomeTaxPaid,
          saltDeduction,
          charitableDonations,
          medicalExpenses,
          deductibleMedical,
          totalDeductions,
          marginalTaxRate,
          taxSavings,
          effectiveMonthlyPayment,
        }),
      });

      if (response.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 5000);
      } else {
        alert('Failed to send email. Please try again.');
      }
    } catch (error) {
      console.error('Email error:', error);
      alert('Error sending email. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-grow bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Mortgage Payment Calculator
              </h1>
              <p className="text-xl text-gray-600">
                Calculate your monthly payment and see potential tax savings
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column: Inputs */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Loan Details</h2>
                
                {/* Loan Type Toggle */}
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Loan Type
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setLoanType('conventional');
                        // Enforce 3% minimum for conventional
                        if (downPaymentPercent < 3) {
                          handleDownPaymentPercentChange(3);
                        }
                      }}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${
                        loanType === 'conventional'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Conventional
                    </button>
                    <button
                      onClick={() => {
                        setLoanType('fha');
                        // Default FHA to 3.5% down payment (set directly to bypass constraint)
                        setDownPaymentPercent(3.5);
                        setDownPayment((3.5 / 100) * homePrice);
                      }}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${
                        loanType === 'fha'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      FHA
                    </button>
                    <button
                      onClick={() => {
                        setLoanType('va');
                        // VA allows 0% down payment
                        setDownPaymentPercent(0);
                        setDownPayment(0);
                      }}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${
                        loanType === 'va'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      VA
                    </button>
                  </div>
                  {loanType === 'fha' && (
                    <p className="mt-2 text-xs text-blue-600">
                      ℹ️ FHA loans allow as low as 3.5% down payment
                    </p>
                  )}
                  {loanType === 'va' && (
                    <p className="mt-2 text-xs text-blue-600">
                      ℹ️ VA loans allow 0% down payment • No mortgage insurance required
                    </p>
                  )}
                </div>
                
                {/* Home Price */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Home Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                    <input
                      type="text"
                      value={homePrice.toLocaleString('en-US')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/,/g, '');
                        if (!isNaN(Number(value)) || value === '') {
                          handleHomePriceChange(Number(value) || 0);
                        }
                      }}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Down Payment - Percent and Dollar Inputs */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Down Payment
                  </label>
                  <div className="flex gap-3">
                    <div className="w-32">
                      <label className="block text-xs text-gray-500 mb-1">Percentage</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={downPaymentPercent}
                          onChange={(e) => handleDownPaymentPercentChange(Number(e.target.value))}
                          className="w-full px-3 py-2 pr-7 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="absolute right-3 top-2 text-gray-500 pointer-events-none">%</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Dollar Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                        <input
                          type="text"
                          value={downPayment.toLocaleString('en-US')}
                          onChange={(e) => {
                            const value = e.target.value.replace(/,/g, '');
                            if (!isNaN(Number(value)) || value === '') {
                              handleDownPaymentDollarChange(Number(value) || 0);
                            }
                          }}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  {needsPMI && (
                    <p className="mt-1 text-xs text-orange-600">
                      {loanType === 'conventional' 
                        ? '⚠️ PMI required (down payment < 20%)'
                        : '⚠️ FHA MIP required (all FHA loans)'}
                    </p>
                  )}
                  {loanType === 'conventional' && downPaymentPercent < 3 && (
                    <p className="mt-1 text-xs text-red-600">
                      ⚠️ Conventional loans require minimum 3% down payment
                    </p>
                  )}
                  {loanType === 'fha' && downPaymentPercent < 3.5 && (
                    <p className="mt-1 text-xs text-red-600">
                      ⚠️ FHA loans require minimum 3.5% down payment
                    </p>
                  )}
                </div>

                {/* Interest Rate */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={interestRate || ''}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Loan Term */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loan Term (years)
                  </label>
                  <select
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={15}>15 years</option>
                    <option value={20}>20 years</option>
                    <option value={30}>30 years</option>
                  </select>
                </div>

                {/* Property Tax Rate - Percent and Dollar Inputs */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Annual Property Tax
                  </label>
                  <div className="flex gap-3">
                    <div className="w-32">
                      <label className="block text-xs text-gray-500 mb-1">Percentage</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={propertyTaxRate}
                          onChange={(e) => handlePropertyTaxRateChange(Number(e.target.value))}
                          className="w-full px-3 py-2 pr-7 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="absolute right-3 top-2 text-gray-500 pointer-events-none">%</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Annual Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                        <input
                          type="text"
                          value={propertyTaxAnnual.toLocaleString('en-US')}
                          onChange={(e) => {
                            const value = e.target.value.replace(/,/g, '');
                            if (!isNaN(Number(value)) || value === '') {
                              handlePropertyTaxDollarChange(Number(value) || 0);
                            }
                          }}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Home Insurance */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Annual Home Insurance
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                    <input
                      type="text"
                      value={homeInsurance.toLocaleString('en-US')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/,/g, '');
                        if (!isNaN(Number(value)) || value === '') {
                          setHomeInsurance(Math.round(Number(value)) || 0);
                        }
                      }}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* HOA Fees */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly HOA Fees
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                    <input
                      type="text"
                      value={hoaFees.toLocaleString('en-US')}
                      onChange={(e) => {
                        const value = e.target.value.replace(/,/g, '');
                        if (!isNaN(Number(value)) || value === '') {
                          setHoaFees(Math.round(Number(value)) || 0);
                        }
                      }}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Tax Savings Toggle */}
                <div className="border-t pt-6 mt-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTaxSavings}
                      onChange={(e) => setShowTaxSavings(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-lg font-medium text-gray-900">
                      Calculate Tax Savings
                    </span>
                  </label>
                </div>

                {/* Tax Savings Inputs */}
                {showTaxSavings && (
                  <div className="mt-6 p-6 bg-blue-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Tax Information
                    </h3>

                    {/* Filing Status */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filing Status
                      </label>
                      <select
                        value={filingStatus}
                        onChange={(e) => setFilingStatus(e.target.value as 'single' | 'married')}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="single">Single</option>
                        <option value="married">Married Filing Jointly</option>
                      </select>
                    </div>

                    {/* State */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State
                      </label>
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {US_STATES.map(s => (
                          <option key={s.code} value={s.code}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      {STATE_TAX_RATES[state] > 0 && (
                        <p className="mt-1 text-xs text-gray-500">
                          Estimated marginal state tax rate: {(STATE_TAX_RATES[state] * 100).toFixed(2)}%
                        </p>
                      )}
                    </div>

                    {/* AGI / Total W2 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adjusted Gross Income (AGI) or Total W-2 Income
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                        <input
                          type="text"
                          value={agi.toLocaleString('en-US')}
                          onChange={(e) => {
                            const value = e.target.value.replace(/,/g, '');
                            if (!isNaN(Number(value)) || value === '') {
                              setAgi(Math.round(Number(value)) || 0);
                            }
                          }}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Enter your household's total income for tax bracket calculation
                      </p>
                    </div>

                    {/* Charitable Donations */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Annual Charitable Donations
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                        <input
                          type="text"
                          value={charitableDonations ? charitableDonations.toLocaleString('en-US') : ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/,/g, '');
                            if (!isNaN(Number(value)) || value === '') {
                              setCharitableDonations(Math.round(Number(value)) || 0);
                            }
                          }}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Total charitable contributions for the year
                      </p>
                    </div>

                    {/* Medical/Dental Expenses */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Annual Medical/Dental Expenses
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500 pointer-events-none">$</span>
                        <input
                          type="text"
                          value={medicalExpenses ? medicalExpenses.toLocaleString('en-US') : ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/,/g, '');
                            if (!isNaN(Number(value)) || value === '') {
                              setMedicalExpenses(Math.round(Number(value)) || 0);
                            }
                          }}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Only amounts exceeding 7.5% of AGI are deductible
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Results */}
              <div>
                {/* Monthly Payment Breakdown */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    Monthly Payment Breakdown
                  </h2>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Principal & Interest</span>
                      <span className="font-semibold text-gray-900">
                        ${monthlyPI.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Property Taxes</span>
                      <span className="font-semibold text-gray-900">
                        ${monthlyPropertyTax.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Home Insurance</span>
                      <span className="font-semibold text-gray-900">
                        ${monthlyInsurance.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                    
                    {needsPMI && (
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-gray-600">{loanType === 'fha' ? 'FHA MIP' : 'PMI'}</span>
                        <span className="font-semibold text-gray-900">
                          ${monthlyPMI.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </span>
                      </div>
                    )}
                    
                    {hoaFees > 0 && (
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-gray-600">HOA Fees</span>
                        <span className="font-semibold text-gray-900">
                          ${monthlyHOA.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-4 text-xl font-bold">
                      <span className="text-gray-900">Total Monthly Payment</span>
                      <span className="text-blue-600">
                        ${totalMonthlyPayment.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Loan Summary */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Loan Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Loan Amount</span>
                      <span className="font-medium">
                        ${loanAmount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Down Payment</span>
                      <span className="font-medium">
                        ${downPayment.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ({downPaymentPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tax Savings */}
                {showTaxSavings && (
                  <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl shadow-lg p-8 mb-6 border-2 border-green-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                      Tax Savings Analysis
                    </h2>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-green-200">
                        <span className="text-gray-700">Your Federal Tax Bracket</span>
                        <span className="font-semibold text-gray-900">
                          {(marginalTaxRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      
                      {/* Expandable Deduction Breakdown */}
                      <div className="border-2 border-blue-300 rounded-lg p-4 bg-white">
                        <button
                          onClick={() => setShowDeductionBreakdown(!showDeductionBreakdown)}
                          className="w-full flex justify-between items-center text-left"
                        >
                          <span className="text-gray-700 font-medium">
                            Total Itemized Deductions
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">
                              ${totalDeductions.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            </span>
                            <span className="text-blue-600 text-xl">
                              {showDeductionBreakdown ? '▼' : '►'}
                            </span>
                          </div>
                        </button>
                        
                        {showDeductionBreakdown && (
                          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600 pl-4">• Mortgage Interest (Year 1)</span>
                              <span className="font-medium text-gray-900">
                                ${year1Interest.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="text-gray-600 pl-4">• State Income Tax Paid</span>
                              <span className="font-medium text-gray-900">
                                ${stateIncomeTaxPaid.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              </span>
                            </div>
                            
                            <div className="flex justify-between">
                              <span className="text-gray-600 pl-4">• Property Taxes (Annual)</span>
                              <span className="font-medium text-gray-900">
                                ${year1PropertyTax.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              </span>
                            </div>
                            
                            <div className="flex justify-between border-t pt-2">
                              <span className="text-gray-600 pl-4 italic">SALT Deduction (capped)</span>
                              <span className="font-medium text-gray-900">
                                ${saltDeduction.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              </span>
                            </div>
                            
                            {needsPMI && agi < 100000 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 pl-4">• PMI (Annual)</span>
                                <span className="font-medium text-gray-900">
                                  ${year1PMI.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                </span>
                              </div>
                            )}
                            
                            {needsPMI && agi >= 100000 && (
                              <p className="text-xs text-gray-500 pl-4 italic">
                                PMI not deductible (AGI &gt; $100,000)
                              </p>
                            )}
                            
                            {charitableDonations > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 pl-4">• Charitable Donations</span>
                                <span className="font-medium text-gray-900">
                                  ${charitableDonations.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                </span>
                              </div>
                            )}
                            
                            {medicalExpenses > medicalThreshold && (
                              <div className="flex justify-between">
                                <span className="text-gray-600 pl-4">• Medical Expenses (deductible portion)</span>
                                <span className="font-medium text-gray-900">
                                  ${deductibleMedical.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                </span>
                              </div>
                            )}
                            
                            {medicalExpenses > 0 && medicalExpenses <= medicalThreshold && (
                              <p className="text-xs text-gray-500 pl-4 italic">
                                Medical expenses below 7.5% AGI threshold (not deductible)
                              </p>
                            )}
                            
                            <p className="text-xs text-gray-500 pl-4 pt-2 italic">
                              Note: State & local tax (SALT) deduction capped at $10,000
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pb-3 border-b border-green-200">
                        <span className="text-gray-700">Standard Deduction</span>
                        <span className="font-semibold text-gray-900">
                          ${standardDeduction.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </span>
                      </div>
                      
                      <div className="bg-green-100 rounded-lg p-4 mt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-lg font-bold text-green-900">
                            Annual Tax Savings
                          </span>
                          <span className="text-2xl font-bold text-green-700">
                            ${taxSavings.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-green-800">Monthly Savings</span>
                          <span className="font-semibold text-green-700">
                            ${monthlySavings.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          </span>
                        </div>
                      </div>

                      <div className="bg-blue-100 rounded-lg p-4 mt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-blue-900">
                            Effective Monthly Payment
                          </span>
                          <span className="text-2xl font-bold text-blue-700">
                            ${effectiveMonthlyPayment.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          </span>
                        </div>
                        <p className="text-xs text-blue-800 mt-2">
                          After tax savings ({taxSavings > 0 ? (monthlySavings/totalMonthlyPayment*100).toFixed(1) : '0'}% reduction)
                        </p>
                      </div>

                      {taxSavings === 0 && (
                        <p className="text-sm text-gray-600 italic mt-4">
                          Note: Your mortgage deductions do not exceed the standard deduction, so itemizing may not provide additional tax benefit.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Email PDF */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Get Your Report
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Receive a detailed PDF summary of this calculation
                  </p>
                  
                  <div className="flex flex-col gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleEmailPDF}
                      disabled={sending || !email}
                      className="w-full px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      {sending ? 'Sending...' : sent ? '✓ Sent' : 'Email PDF'}
                    </button>
                  </div>
                  
                  {sent && (
                    <p className="mt-2 text-sm text-green-600">
                      ✓ PDF sent successfully! Check your inbox.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-12 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                <strong>Disclaimer:</strong> This calculator provides estimates only and is NOT a Loan Estimate (LE) as defined by federal mortgage regulations. 
                For an official Loan Estimate, please contact First Access Lending directly.
              </p>
              
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                This calculator does NOT provide tax advice. Tax savings are estimates only and may not reflect your actual tax liability. 
                Your individual tax situation may differ significantly based on factors not captured here. 
                Please consult a qualified tax professional before making decisions based on these estimates.
              </p>
              
              <p className="text-xs text-gray-600 mb-2 leading-relaxed">
                <strong>Assumptions:</strong> Conventional PMI: 0.17% for &lt;90% LTV, 0.24% for 90-95% LTV. 
                FHA MIP: 0.80% for ≤95% LTV, 0.85% for &gt;95% LTV (does not include upfront MIP). 
                Minimum down payment: 5% for conventional, 3.5% for FHA. 
                Actual PMI/MIP rates vary by credit score, loan amount, and lender. 
                State tax rates are simplified marginal estimates and may not reflect actual liability. 
                SALT deduction capped at $10,000 (federal tax law). 
                PMI deductibility phases out for AGI above $100,000. 
                Standard deduction amounts based on 2025 tax year. 
                No consideration of AMT, Pease limitations, or state-specific deduction rules.
              </p>
              
              <p className="text-xs text-gray-600 leading-relaxed">
                Actual loan payments, PMI rates, interest rates, tax savings, and closing costs may differ based on your credit profile, loan type, lender, property location, and individual tax circumstances. 
                Tax laws change frequently and may affect deduction availability. This calculator does not include all possible fees, costs, or tax considerations. 
                Contact First Access Lending for an accurate, personalized quote and official Loan Estimate. 
                Consult a licensed tax professional for tax planning advice specific to your situation.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper: Calculate first year's interest
function calculateFirstYearInterest(principal: number, monthlyRate: number, numPayments: number): number {
  let balance = principal;
  let totalInterest = 0;
  
  const monthlyPayment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  for (let i = 0; i < 12; i++) {
    const interestPayment = balance * monthlyRate;
    totalInterest += interestPayment;
    const principalPayment = monthlyPayment - interestPayment;
    balance -= principalPayment;
  }

  return totalInterest;
}

// Helper: Get marginal tax rate
function getMarginalTaxRate(income: number, brackets: TaxBracket[]): number {
  for (const bracket of brackets) {
    if (income >= bracket.min && income <= bracket.max) {
      return bracket.rate;
    }
  }
  return brackets[brackets.length - 1].rate; // Highest bracket
}
