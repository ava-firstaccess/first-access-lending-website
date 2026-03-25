// Stage 1 Results Page
'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useMemo } from 'react';

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
  totalTerm: number,
  cashOutAmount: number,
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
      // Interest-only during draw period
      monthlyPayment = Math.round(maxAvailable * monthlyRate);
    } else {
      monthlyPayment = Math.round(maxAvailable * monthlyRate);
    }
  }

  return { maxAvailable, rate, monthlyPayment, maxLtv, rateType: product === 'HELOC' ? 'Variable' : 'Fixed' };
}

function calcRepaymentPayment(balance: number, rate: number, repaymentYears: number): number {
  const monthlyRate = rate / 100 / 12;
  const n = repaymentYears * 12;
  if (balance <= 0 || n <= 0) return 0;
  return Math.round(balance * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1));
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

export default function ResultsPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [stage1, setStage1] = useState<Record<string, any>>({});
  const [cesTerm, setCesTerm] = useState<number>(20);
  const [helocTotalTerm, setHelocTotalTerm] = useState<number>(20);
  const [helocDrawTerm, setHelocDrawTerm] = useState<number>(5);

  useEffect(() => {
    const raw = localStorage.getItem('stage1-data');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setStage1(parsed);
        if (parsed.drawTerm) setHelocDrawTerm(Number(parsed.drawTerm));
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
  const cashOutAmount = Number(stage1.cashOutAmount) || 0;
  const propertyAddress = String(stage1.propertyAddress || '');

  const helocQuote = useMemo(() =>
    calcQuote('HELOC', propertyValue, loanBalance, creditScore, propertyType, helocDrawTerm, helocTotalTerm, cashOutAmount),
    [propertyValue, loanBalance, creditScore, propertyType, helocDrawTerm, helocTotalTerm, cashOutAmount]
  );

  const cesQuote = useMemo(() =>
    calcQuote('CES', propertyValue, loanBalance, creditScore, propertyType, 0, cesTerm, cashOutAmount, cesTerm),
    [propertyValue, loanBalance, creditScore, propertyType, cashOutAmount, cesTerm]
  );

  const helocRepaymentYears = helocTotalTerm - helocDrawTerm;
  const helocRepaymentPayment = useMemo(() =>
    calcRepaymentPayment(helocQuote.maxAvailable, helocQuote.rate, helocRepaymentYears),
    [helocQuote.maxAvailable, helocQuote.rate, helocRepaymentYears]
  );

  const isRefi = product === 'CashOut' || product === 'NoCashRefi';
  const refiQuote = useMemo(() =>
    isRefi ? calcQuote(product, propertyValue, loanBalance, creditScore, propertyType, 0, 30, cashOutAmount) : null,
    [isRefi, product, propertyValue, loanBalance, creditScore, propertyType, cashOutAmount]
  );

  const productFullLabels: Record<string, string> = {
    'HELOC': 'Home Equity Line of Credit',
    'CES': 'Closed-End Second Mortgage',
    'CashOut': 'Cash-Out Refinance',
    'NoCashRefi': 'Rate & Term Refinance'
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

          {/* CTA */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 mb-8 text-center">
            <p className="text-blue-100 text-sm mb-3">
              This is a preliminary estimate. To get your exact, customized rate, continue with a full application.
              <br />
              <span className="font-medium text-white">100% automated - no phone calls unless you want them.</span>
            </p>
            <button
              onClick={() => router.push('/quote/verify')}
              className="bg-white text-blue-700 font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all text-lg"
            >
              Get Your Custom Rate Quote &rarr;
            </button>
          </div>

          {/* ═══════════════════════════════════════════════ */}
          {/* HELOC + CES Side by Side (for HELOC or CES selections) */}
          {/* ═══════════════════════════════════════════════ */}
          {!isRefi && (
            <>
              {/* Two columns */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">

                {/* HELOC Column */}
                <div className={`rounded-xl border-2 p-6 ${product === 'HELOC' ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">HELOC</h3>

                  {/* Max Available */}
                  <div className="bg-blue-50 rounded-lg p-4 text-center mb-5">
                    <div className="text-xs text-blue-600 font-medium mb-1">Max Available</div>
                    <div className="text-2xl font-bold text-blue-900">${helocQuote.maxAvailable.toLocaleString()}</div>
                  </div>

                  {/* Term Toggles */}
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

                  {/* Rate + Payment */}
                  <div className="bg-green-50 rounded-lg p-4 text-center mb-3">
                    <div className="text-xs text-green-600 font-medium mb-1">Estimated Rate</div>
                    <div className="text-2xl font-bold text-green-900">{helocQuote.rate.toFixed(2)}%</div>
                    <div className="text-xs text-green-600 mt-0.5">Variable</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-xs text-orange-600 font-medium mb-1">Est. Monthly (Draw Period)</div>
                    <div className="text-2xl font-bold text-orange-900">${helocQuote.monthlyPayment.toLocaleString()}</div>
                    <div className="text-xs text-orange-600 mt-0.5">Interest only</div>
                  </div>

                  <button
                    onClick={() => {
                      const s1 = JSON.parse(localStorage.getItem('stage1-data') || '{}');
                      s1.product = 'HELOC';
                      s1.helocTotalTerm = String(helocTotalTerm);
                      s1.helocDrawTerm = String(helocDrawTerm);
                      localStorage.setItem('stage1-data', JSON.stringify(s1));
                      router.push('/quote/verify');
                    }}
                    className="w-full mt-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
                  >
                    Select HELOC &amp; Get Access! →
                  </button>
                  <p className="text-xs text-gray-400 mt-2 text-center">Fully digital until you choose otherwise</p>
                </div>

                {/* CES Column */}
                <div className={`rounded-xl border-2 p-6 ${product === 'CES' ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Closed-End Second</h3>

                  {/* Max Available */}
                  <div className="bg-blue-50 rounded-lg p-4 text-center mb-5">
                    <div className="text-xs text-blue-600 font-medium mb-1">Max Available</div>
                    <div className="text-2xl font-bold text-blue-900">${cesQuote.maxAvailable.toLocaleString()}</div>
                  </div>

                  {/* Term Toggle */}
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 font-medium">Term</span>
                      <PillToggle
                        options={[{ label: '20yr', value: 20 }, { label: '30yr', value: 30 }]}
                        value={cesTerm}
                        onChange={setCesTerm}
                      />
                    </div>
                    {/* Empty row to align with HELOC draw period toggle */}
                    <div className="h-[34px]"></div>
                  </div>

                  {/* Rate + Payment */}
                  <div className="bg-green-50 rounded-lg p-4 text-center mb-3">
                    <div className="text-xs text-green-600 font-medium mb-1">Estimated Rate</div>
                    <div className="text-2xl font-bold text-green-900">{cesQuote.rate.toFixed(2)}%</div>
                    <div className="text-xs text-green-600 mt-0.5">Fixed</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-xs text-orange-600 font-medium mb-1">Est. Monthly Payment</div>
                    <div className="text-2xl font-bold text-orange-900">${cesQuote.monthlyPayment.toLocaleString()}</div>
                    <div className="text-xs text-orange-600 mt-0.5">Principal &amp; Interest</div>
                  </div>

                  <button
                    onClick={() => {
                      const s1 = JSON.parse(localStorage.getItem('stage1-data') || '{}');
                      s1.product = 'CES';
                      s1.cesTerm = String(cesTerm);
                      localStorage.setItem('stage1-data', JSON.stringify(s1));
                      router.push('/quote/verify');
                    }}
                    className="w-full mt-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
                  >
                    Select CES &amp; Get Access! →
                  </button>
                  <p className="text-xs text-gray-400 mt-2 text-center">Fully digital until you choose otherwise</p>
                </div>
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
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-xl p-6 text-center">
                <div className="text-sm text-blue-600 font-medium mb-1">Max Available</div>
                <div className="text-3xl md:text-4xl font-bold text-blue-900">${refiQuote.maxAvailable.toLocaleString()}</div>
              </div>
              <div className="bg-green-50 rounded-xl p-6 text-center">
                <div className="text-sm text-green-600 font-medium mb-1">Estimated Rate</div>
                <div className="text-3xl md:text-4xl font-bold text-green-900">{refiQuote.rate.toFixed(2)}%</div>
                <div className="text-xs text-green-600 mt-1">{refiQuote.rateType}</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-6 text-center">
                <div className="text-sm text-orange-600 font-medium mb-1">Est. Monthly Payment</div>
                <div className="text-3xl md:text-4xl font-bold text-orange-900">${refiQuote.monthlyPayment.toLocaleString()}</div>
              </div>
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
