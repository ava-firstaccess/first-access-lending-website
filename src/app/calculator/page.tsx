'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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

export default function MortgageCalculator() {
  // Mortgage inputs
  const [homePrice, setHomePrice] = useState<number>(400000);
  const [downPayment, setDownPayment] = useState<number>(80000);
  const [interestRate, setInterestRate] = useState<number>(6.5);
  const [loanTerm, setLoanTerm] = useState<number>(30);
  const [propertyTaxRate, setPropertyTaxRate] = useState<number>(1.2);
  const [homeInsurance, setHomeInsurance] = useState<number>(1500);
  const [hoaFees, setHoaFees] = useState<number>(0);

  // Tax savings inputs
  const [showTaxSavings, setShowTaxSavings] = useState<boolean>(false);
  const [filingStatus, setFilingStatus] = useState<'single' | 'married'>('married');
  const [agi, setAgi] = useState<number>(150000);
  const [email, setEmail] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);

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
  const totalMonthlyPayment = monthlyPI + monthlyPropertyTax + monthlyInsurance + monthlyHOA;

  // Year 1 interest and property taxes (for tax deduction)
  const year1Interest = calculateFirstYearInterest(loanAmount, monthlyRate, numPayments);
  const year1PropertyTax = monthlyPropertyTax * 12;
  const totalDeductions = year1Interest + year1PropertyTax;

  // Standard deduction (2025)
  const standardDeduction = filingStatus === 'married' ? 29200 : 14600;
  
  // Calculate tax bracket and savings
  const brackets = filingStatus === 'married' ? TAX_BRACKETS_MARRIED : TAX_BRACKETS_SINGLE;
  const marginalTaxRate = getMarginalTaxRate(agi, brackets);
  
  // Tax savings calculation
  const itemizedDeductions = totalDeductions + standardDeduction; // Simplified - adds mortgage deductions to standard
  const actualItemizedBenefit = Math.max(0, totalDeductions - 0); // Benefit above standard deduction
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
      const response = await fetch('/api/calculator-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
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
          totalMonthlyPayment,
          showTaxSavings,
          filingStatus,
          agi,
          year1Interest,
          year1PropertyTax,
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
      <Header />
      
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
                
                {/* Home Price */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Home Price
                  </label>
                  <input
                    type="number"
                    value={homePrice}
                    onChange={(e) => setHomePrice(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Down Payment */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Down Payment ({((downPayment / homePrice) * 100).toFixed(1)}%)
                  </label>
                  <input
                    type="number"
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Interest Rate */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={interestRate}
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

                {/* Property Tax Rate */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property Tax Rate (% per year)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={propertyTaxRate}
                    onChange={(e) => setPropertyTaxRate(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Home Insurance */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Annual Home Insurance
                  </label>
                  <input
                    type="number"
                    value={homeInsurance}
                    onChange={(e) => setHomeInsurance(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* HOA Fees */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly HOA Fees
                  </label>
                  <input
                    type="number"
                    value={hoaFees}
                    onChange={(e) => setHoaFees(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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

                    {/* AGI / Total W2 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adjusted Gross Income (AGI) or Total W-2 Income
                      </label>
                      <input
                        type="number"
                        value={agi}
                        onChange={(e) => setAgi(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter your household's total income for tax bracket calculation
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
                        ${monthlyPI.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Property Taxes</span>
                      <span className="font-semibold text-gray-900">
                        ${monthlyPropertyTax.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center pb-3 border-b">
                      <span className="text-gray-600">Home Insurance</span>
                      <span className="font-semibold text-gray-900">
                        ${monthlyInsurance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      </span>
                    </div>
                    
                    {hoaFees > 0 && (
                      <div className="flex justify-between items-center pb-3 border-b">
                        <span className="text-gray-600">HOA Fees</span>
                        <span className="font-semibold text-gray-900">
                          ${monthlyHOA.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-4 text-xl font-bold">
                      <span className="text-gray-900">Total Monthly Payment</span>
                      <span className="text-blue-600">
                        ${totalMonthlyPayment.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
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
                        ${downPayment.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ({((downPayment/homePrice)*100).toFixed(1)}%)
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
                        <span className="text-gray-700">Your Tax Bracket</span>
                        <span className="font-semibold text-gray-900">
                          {(marginalTaxRate * 100).toFixed(0)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pb-3 border-b border-green-200">
                        <span className="text-gray-700">Year 1 Mortgage Interest</span>
                        <span className="font-semibold text-gray-900">
                          ${year1Interest.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pb-3 border-b border-green-200">
                        <span className="text-gray-700">Annual Property Taxes</span>
                        <span className="font-semibold text-gray-900">
                          ${year1PropertyTax.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pb-3 border-b border-green-200">
                        <span className="text-gray-700">Total Deductions</span>
                        <span className="font-semibold text-gray-900">
                          ${totalDeductions.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        </span>
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
                            ${monthlySavings.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          </span>
                        </div>
                      </div>

                      <div className="bg-blue-100 rounded-lg p-4 mt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-blue-900">
                            Effective Monthly Payment
                          </span>
                          <span className="text-2xl font-bold text-blue-700">
                            ${effectiveMonthlyPayment.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          </span>
                        </div>
                        <p className="text-xs text-blue-800 mt-2">
                          After tax savings ({(monthlySavings/totalMonthlyPayment*100).toFixed(1)}% reduction)
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
                  
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleEmailPDF}
                      disabled={sending || !email}
                      className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
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
              <p className="text-sm text-gray-600">
                <strong>Disclaimer:</strong> This calculator provides estimates only and should not be considered financial or tax advice. 
                Actual payments and tax savings may vary. Tax benefits depend on individual circumstances and may change with tax law updates. 
                Please consult with a qualified tax professional and contact First Access Lending for an accurate quote.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
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
