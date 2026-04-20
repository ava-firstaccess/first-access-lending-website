// Quote Review Flow
// Quote → Property Value → Soft Credit Check → Update Quote → Finalize Details
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SSNField } from '@/components/quote/FormField';

type ValidationStep = 'credit' | 'mortgages' | 'updated-quote';

// Mock data types (will be replaced with API responses)
interface AVMResult {
  estimatedValue: number;
  confidenceScore: number;
  statedValue: number;
  difference: number;
  differencePercent: number;
}

interface Mortgage {
  id: string;
  lender: string;
  balance: number;
  monthlyPayment: number;
  accountType: string;
  openDate: string;
  matchedPropertyIndex: number | null; // null = unmatched
}

type QuoteFormData = Record<string, any>;

export default function ValidatePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ValidationStep>('credit');
  const [loading, setLoading] = useState(false);

  // Form data from submission
  const [formData, setFormData] = useState<QuoteFormData>({});

  // Credit pull form
  const [dob, setDob] = useState('');
  const [ssn, setSsn] = useState('');
  const [cobDob, setCobDob] = useState('');
  const [cobSsn, setCobSsn] = useState('');

  // AVM results
  const [avmResult, setAvmResult] = useState<AVMResult | null>(null);

  // Credit results
  const [mortgages, setMortgages] = useState<Mortgage[]>([]);
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [creditError, setCreditError] = useState<string | null>(null);

  // Updated numbers
  const [updatedCashAvailable] = useState<number | null>(null);
  const [updatedRate] = useState<number | null>(null);
  const [originalCashAvailable, setOriginalCashAvailable] = useState<number>(0);

  // Properties from form
  const [properties, setProperties] = useState<{ address: string; index: number }[]>([]);

  useEffect(() => {
    const hydrate = async () => {
      const params = new URLSearchParams(window.location.search);
      const applicationId = params.get('applicationId');
      const sessionToken = params.get('sessionToken');

      let hydratedData: QuoteFormData | null = null;
      let stage1Data: QuoteFormData | null = null;

      if (applicationId) {
        try {
          const qs = new URLSearchParams({ applicationId });
          if (sessionToken) qs.set('sessionToken', sessionToken);
          const res = await fetch(`/api/application?${qs.toString()}`);
          if (res.ok) {
            const payload = await res.json();
            hydratedData = payload?.application?.form_data || payload?.form_data || null;
          }
        } catch (err) {
          console.error('Failed to hydrate validation page from application API', err);
        }
      }

      if (!hydratedData) {
        const stage2Raw = localStorage.getItem('stage2-progress');
        const stage1Raw = localStorage.getItem('stage1-data');
        stage1Data = stage1Raw ? JSON.parse(stage1Raw) : null;
        if (stage2Raw) {
          hydratedData = { ...(stage1Data || {}), ...JSON.parse(stage2Raw) };
        }
      }

      if (hydratedData) {
        setFormData(hydratedData);

        const props = [];
        if (hydratedData.propertyAddress) {
          props.push({ address: hydratedData.propertyAddress, index: 0 });
        }
        const numOther = Number(hydratedData['Number of Other Properties']) || 0;
        for (let i = 1; i <= numOther; i++) {
          const addr = hydratedData[`Other Properties - Address ${i}`];
          if (addr) props.push({ address: addr, index: i });
        }
        setProperties(props);
        setOriginalCashAvailable(Number(hydratedData.desiredLoanAmount) || Number(hydratedData.maxAvailable) || 0);
      }

      const statedValue = Number((hydratedData || stage1Data || {}).propertyValue || 0);
      const verifiedValue = Number((hydratedData || stage1Data || {}).verifiedPropertyValue || 0);
      const verificationFsd = Number((hydratedData || stage1Data || {}).verificationFsd || 0);
      if (verifiedValue || statedValue) {
        setAvmResult({
          estimatedValue: verifiedValue || statedValue,
          confidenceScore: verificationFsd ? Math.max(0, Math.round((1 - verificationFsd) * 100)) : 92,
          statedValue,
          difference: verifiedValue && statedValue ? verifiedValue - statedValue : 0,
          differencePercent: verifiedValue && statedValue ? Number((((verifiedValue - statedValue) / statedValue) * 100).toFixed(1)) : 0,
        });
      }
    };

    hydrate();
  }, []);

  const steps = [
    { label: 'Quote', icon: '💬', state: 'done' as const },
    { label: 'Property Value', icon: '🏠', state: 'done' as const },
    {
      label: 'Soft Credit Check',
      icon: '📊',
      state: (currentStep === 'credit' || currentStep === 'mortgages') ? 'current' as const : 'done' as const,
    },
    {
      label: 'Update Quote',
      icon: '💰',
      state: currentStep === 'updated-quote' ? 'current' as const : 'upcoming' as const,
    },
    { label: 'Finalize Details', icon: '📝', state: 'upcoming' as const },
  ];
  const hasCoBorrower = formData['Borrower - Has Co-Borrower'] === 'Yes';

  const goToStep = (step: ValidationStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreditPull = async () => {
    setLoading(true);
    setCreditError(null);

    try {
      const res = await fetch('/api/credit/softpull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'sandbox',
          borrower: {
            firstName: formData['Borrower - First Name'],
            lastName: formData['Borrower - Last Name'],
            dob,
            ssn,
          },
          coborrower: hasCoBorrower
            ? {
                firstName: formData['Co-Borrower - First Name'],
                lastName: formData['Co-Borrower - Last Name'],
                dob: cobDob,
                ssn: cobSsn,
              }
            : undefined,
        }),
      });

      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Soft credit check failed.');
      }

      setCreditScore(Number(payload?.scores?.representative) || null);
      setMortgages(
        Array.isArray(payload?.mortgages)
          ? payload.mortgages.map((mortgage: any) => ({
              id: String(mortgage.id),
              lender: String(mortgage.lender || mortgage.creditor || 'Unknown Lender'),
              balance: Number(mortgage.balance) || 0,
              monthlyPayment: Number(mortgage.monthlyPayment) || 0,
              accountType: String(mortgage.accountType || 'Mortgage'),
              openDate: String(mortgage.openDate || ''),
              matchedPropertyIndex: null,
            }))
          : []
      );
      goToStep('mortgages');
    } catch (error) {
      setCreditError(error instanceof Error ? error.message : 'Soft credit check failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleMortgageMatch = (mortgageId: string, propertyIndex: number | null) => {
    setMortgages(prev => prev.map(m =>
      m.id === mortgageId ? { ...m, matchedPropertyIndex: propertyIndex } : m
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Soft Credit Check</h1>
          <p className="text-gray-600">A quick review to tighten up your quote before you finalize details.</p>
        </div>

        {/* Step Progress */}
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

        {/* ═══════════════════════════════════════════════
            STEP 2: CREDIT PULL (DOB + SSN)
        ═══════════════════════════════════════════════ */}
        {currentStep === 'credit' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                <span className="text-3xl">📊</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 mb-4">
                Step 2 of 3 in this section
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Soft Credit Check</h2>
              <p className="text-gray-600">We need a few more details to run the soft pull and tighten up your quote.</p>
            </div>

            <div className="space-y-6">
              {/* Borrower */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Borrower - {formData['Borrower - First Name']} {formData['Borrower - Last Name']}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none text-lg"
                      required
                    />
                  </div>
                  <SSNField
                    label="Social Security Number"
                    name="borrower-ssn"
                    value={ssn}
                    onChange={(_, v) => setSsn(v)}
                    required
                  />
                </div>
              </div>

              {/* Co-Borrower */}
              {hasCoBorrower && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Co-Borrower - {formData['Co-Borrower - First Name']} {formData['Co-Borrower - Last Name']}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Birth <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={cobDob}
                        onChange={(e) => setCobDob(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none text-lg"
                        required
                      />
                    </div>
                    <SSNField
                      label="Social Security Number"
                      name="coborrower-ssn"
                      value={cobSsn}
                      onChange={(_, v) => setCobSsn(v)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Security notice */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">Your information is secure</p>
                  <p className="text-xs text-gray-500">256-bit encrypted. This is a soft pull that will not affect your credit score.</p>
                </div>
              </div>

              {creditError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {creditError}
                </div>
              )}

              <button
                onClick={handleCreditPull}
                disabled={loading || !dob || ssn.length < 9 || (hasCoBorrower && (!cobDob || cobSsn.length < 9))}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                  !loading && dob && ssn.length >= 9 && (!hasCoBorrower || (cobDob && cobSsn.length >= 9))
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Pulling Credit Report...
                  </span>
                ) : (
                  'Run Credit Check →'
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STEP 3: MORTGAGE ASSIGNMENT
        ═══════════════════════════════════════════════ */}
        {currentStep === 'mortgages' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <span className="text-3xl">🏦</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 mb-4">
                Review reported mortgages
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Match Your Mortgages</h2>
              <p className="text-gray-600">
                We found {mortgages.length} mortgage{mortgages.length !== 1 ? 's' : ''} on your credit report.
                Match each one to the right property so the updated quote is accurate.
              </p>
              {creditScore && (
                <div className="inline-flex items-center gap-2 mt-3 bg-green-50 px-4 py-2 rounded-full">
                  <span className="text-sm text-green-700 font-medium">Credit Score: {creditScore}</span>
                </div>
              )}
            </div>

            <div className="space-y-4 mb-8">
              {mortgages.map((mortgage) => (
                <div key={mortgage.id} className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900">{mortgage.lender}</h4>
                      <p className="text-sm text-gray-500">{mortgage.accountType} - Opened {new Date(mortgage.openDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">${mortgage.balance.toLocaleString()}</p>
                      <p className="text-sm text-gray-500">${mortgage.monthlyPayment}/mo</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Which property is this mortgage on?</label>
                    <select
                      value={mortgage.matchedPropertyIndex ?? ''}
                      onChange={(e) => handleMortgageMatch(mortgage.id, e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">-- Select a property --</option>
                      {properties.map((prop) => (
                        <option key={prop.index} value={prop.index}>
                          {prop.address.split(',')[0]}
                        </option>
                      ))}
                      <option value={-1}>❓ I don&apos;t recognize this</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Unmatched mortgage warning */}
            {mortgages.some(m => m.matchedPropertyIndex === null) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <p className="text-amber-700 text-sm font-medium">Please match all mortgages to a property before continuing.</p>
              </div>
            )}

            {/* Extra property prompt */}
            {mortgages.some(m => m.matchedPropertyIndex === -1) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <p className="text-blue-700 text-sm font-medium mb-2">
                  It looks like you may have a property we don&apos;t have listed.
                </p>
                <button
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
                  onClick={() => {
                    // TODO: Open modal to add missing property
                    alert('Add missing property - TODO');
                  }}
                >
                  + Add a property I missed
                </button>
              </div>
            )}

            <button
              onClick={() => goToStep('updated-quote')}
              disabled={mortgages.some(m => m.matchedPropertyIndex === null)}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                !mortgages.some(m => m.matchedPropertyIndex === null)
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continue to Updated Quote →
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STEP 4: UPDATED QUOTE
        ═══════════════════════════════════════════════ */}
        {currentStep === 'updated-quote' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 mb-4">
                Updated quote + estimated costs
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Updated Quote</h2>
              <p className="text-gray-600">Based on your verified home value and soft credit check.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-sm text-gray-500 mb-1 text-center">Original Estimate</p>
                <p className="text-3xl font-bold text-gray-400 text-center line-through">${originalCashAvailable.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-5 border-2 border-emerald-200">
                <p className="text-sm text-emerald-600 mb-1 text-center">Verified Amount</p>
                <p className="text-3xl font-bold text-emerald-700 text-center">${(updatedCashAvailable || originalCashAvailable).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 mb-8 text-center">
              <p className="text-sm text-blue-600 mb-1">Estimated Rate</p>
              <p className="text-4xl font-bold text-blue-700">{(updatedRate || 7.99).toFixed(2)}%</p>
              <p className="text-xs text-blue-500 mt-1">Based on {creditScore || 'your'} credit score</p>
            </div>

            <div className="border border-gray-200 rounded-xl divide-y divide-gray-200 mb-8">
              <div className="flex justify-between px-5 py-3">
                <span className="text-gray-600">Product</span>
                <span className="font-medium text-gray-900">{formData.product || 'HELOC'}</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-gray-600">Property Value</span>
                <span className="font-medium text-gray-900">${(avmResult?.estimatedValue || Number(formData.propertyValue) || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-gray-600">Credit Score</span>
                <span className="font-medium text-gray-900">{creditScore || 'Pending'}</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-gray-600">1st Lien Balance</span>
                <span className="font-medium text-gray-900">${Number(formData.loanBalance || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="bg-gray-50 px-5 py-3 flex justify-between text-sm font-semibold text-gray-700">
                <span>Estimated Costs</span>
                <span>Amount</span>
              </div>
              <div className="px-5 py-2 bg-blue-50 text-sm font-semibold text-blue-700">Loan Costs</div>
              {[
                { desc: 'Origination Fee (1%)', amount: Math.round((updatedCashAvailable || originalCashAvailable) * 0.01) },
                { desc: 'Appraisal Fee', amount: 500 },
                { desc: 'Credit Report', amount: 75 },
                { desc: 'Flood Certification', amount: 15 },
                { desc: 'Title Search', amount: 250 },
                { desc: 'Title Insurance (Lender)', amount: 350 },
                { desc: 'Settlement/Closing Fee', amount: 495 },
                { desc: 'Recording Fees', amount: 150 },
                { desc: 'Prepaid Interest (15 days)', amount: Math.round(((updatedCashAvailable || originalCashAvailable) * 0.0799 / 365) * 15) },
                { desc: 'Homeowners Insurance (2 mo)', amount: 300 },
              ].map((item, i) => (
                <div key={i} className="flex justify-between px-5 py-2.5 text-sm border-t border-gray-100">
                  <span className="text-gray-700">{item.desc}</span>
                  <span className="font-medium text-gray-900">${item.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between px-5 py-4 bg-gray-900 text-white font-bold text-lg">
                <span>Estimated Total</span>
                <span>${(
                  Math.round((updatedCashAvailable || originalCashAvailable) * 0.01) +
                  500 + 75 + 15 + 250 + 350 + 495 + 150 +
                  Math.round(((updatedCashAvailable || originalCashAvailable) * 0.0799 / 365) * 15) +
                  300
                ).toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mb-6">
              These are estimates only. Actual closing costs may vary. Your loan officer will provide a detailed Loan Estimate.
            </p>

            <button
              onClick={() => router.push('/quote/finalize-details')}
              className="w-full py-4 px-6 rounded-xl font-semibold text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all"
            >
              Continue to Finalize Details →
            </button>
          </div>
        )}

        {/* Trust footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1">🔒 256-bit Encrypted</span>
            <span>NMLS #2503498</span>
            <span>Equal Housing Lender</span>
          </div>
        </div>

      </div>
    </div>
  );
}
