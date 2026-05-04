// Quote Review Flow
// Quote → Property Value → Soft Credit Check → Update Quote → Finalize Details
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SSNField } from '@/components/quote/FormField';
import QuoteBuilder from '@/components/quote/QuoteBuilder';
import { getOriginationFeeDetails } from '@/lib/closing-costs';
import {
  getRepresentativeMeridianLinkScore,
  isMortgageLiability,
  parseMeridianLinkResponseXml,
  type MeridianLinkLiabilitySummary,
  type MeridianLinkParsedReport,
} from '@/lib/meridianlink-report';
import type { Stage1PricingResponse } from '@/lib/stage1-pricing/types';

type ValidationStep = 'credit' | 'score-adjustment' | 'mortgages' | 'updated-quote';

const MIN_LOAN_AMOUNT = 50000;

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

interface CreditApiMetadata {
  provider?: string;
  supportedModes?: string[];
  approvedProdTestBorrower?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    suffixName?: string;
    dob?: string;
    ssnLast4?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    preferredResponseFormat?: string;
    routeMode?: string;
    provider?: string;
  };
}

interface CreditCardAverageRatePayload {
  rate: number | null;
  averageLabel?: string | null;
  cached?: boolean;
  cacheDate?: string | null;
  observedDate?: string | null;
  error?: string | null;
}

interface LiabilityActionState {
  resolution: 'payoff' | 'exclude' | null;
  excludeReason: '' | 'Already paid off' | 'Someone else pays this' | "I don't recognize this account" | 'Other';
  excludeExplanation: string;
  manualRate: string;
}

interface QuoteCalc {
  maxAvailable: number;
  rate: number;
  monthlyPayment: number;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

function mapLiabilityToMortgage(liability: MeridianLinkLiabilitySummary): Mortgage {
  return {
    id: liability.id,
    lender: liability.creditorName || 'Unknown Creditor',
    balance: liability.unpaidBalance || 0,
    monthlyPayment: liability.monthlyPayment || 0,
    accountType: liability.loanType || liability.accountType || 'Mortgage',
    openDate: liability.openedDate || '',
    matchedPropertyIndex: null,
  };
}

function isOpenLiability(liability: MeridianLinkLiabilitySummary) {
  const status = liability.status.toLowerCase();
  const rating = liability.currentRating.toLowerCase();

  if (/closed|paid(?:\s+and\s+closed)?|pif|settled|transferred|terminated|refinanced/.test(status)) {
    return false;
  }

  if (/charge.?off|collection|repossession|foreclosure/.test(status) || /charge.?off|collection/.test(rating)) {
    return false;
  }

  return true;
}

function isCreditCardLiability(liability: MeridianLinkLiabilitySummary) {
  const haystack = `${liability.accountType} ${liability.loanType} ${liability.termsDescription} ${liability.creditorName}`.toLowerCase();
  return /credit\s*card|creditcard|revolving|visa|master\s*card|mastercard|amex|american\s*express|discover/.test(haystack);
}

function isInstallmentOrAutoLiability(liability: MeridianLinkLiabilitySummary) {
  if (isMortgageLiability(liability) || isCreditCardLiability(liability)) return false;
  const haystack = `${liability.accountType} ${liability.loanType} ${liability.termsDescription} ${liability.creditorName}`.toLowerCase();
  return /auto|automobile|installment|student|personal loan|secured loan|unsecured loan|line of credit/.test(haystack);
}

function calculateInstallmentInterestRate(liability: MeridianLinkLiabilitySummary) {
  const principal = liability.unpaidBalance || liability.highBalance || 0;
  const payment = liability.monthlyPayment || 0;
  const termMonths = liability.termMonths || 0;

  if (!principal || !payment || !termMonths || payment * termMonths <= principal) {
    return null;
  }

  let low = 0;
  let high = 1;

  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    const denominator = 1 - Math.pow(1 + mid, -termMonths);
    if (!denominator) break;
    const estimatedPayment = principal * (mid / denominator);
    if (estimatedPayment > payment) {
      high = mid;
    } else {
      low = mid;
    }
  }

  const monthlyRate = (low + high) / 2;
  const annualRate = monthlyRate * 12 * 100;
  return Number.isFinite(annualRate) ? annualRate : null;
}

function formatInterestRate(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function parseAverageRateValue(payload: CreditCardAverageRatePayload | null) {
  if (!payload) return null;
  if (typeof payload.rate === 'number' && Number.isFinite(payload.rate)) return payload.rate;
  const raw = String(payload.averageLabel || '').replace(/[^0-9.]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getDisplayedInterestRate(
  liability: MeridianLinkLiabilitySummary,
  creditCardRate: number | null,
  manualRate: string | null | undefined,
) {
  const parsedManualRate = Number((manualRate || '').trim());
  if ((manualRate || '').trim() && Number.isFinite(parsedManualRate)) return parsedManualRate;
  if (isCreditCardLiability(liability)) return creditCardRate;
  if (isInstallmentOrAutoLiability(liability)) return calculateInstallmentInterestRate(liability);
  return null;
}

function floorDisplayedMaxAvailable(amount: number) {
  return amount > 0 ? Math.max(MIN_LOAN_AMOUNT, Math.round(amount)) : 0;
}

function clampLoanAmount(value: number, maxAvailable: number) {
  if (maxAvailable <= 0) return 0;
  const displayedMax = floorDisplayedMaxAvailable(maxAvailable);
  return Math.max(Math.min(MIN_LOAN_AMOUNT, displayedMax), Math.min(value, displayedMax));
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

interface ProdTestBorrowerForm {
  firstName: string;
  lastName: string;
  middleName: string;
  suffixName: string;
  dob: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  preferredResponseFormat: string;
}

type QuoteFormData = Record<string, any>;

export default function ValidatePage() {
  const router = useRouter();
  const pathname = usePathname();
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
  const [apiMetadata, setApiMetadata] = useState<CreditApiMetadata | null>(null);
  const [prodTestBorrower, setProdTestBorrower] = useState<ProdTestBorrowerForm>({
    firstName: '',
    lastName: '',
    middleName: '',
    suffixName: '',
    dob: '',
    ssn: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    preferredResponseFormat: 'Xml',
  });
  const [prodTestResult, setProdTestResult] = useState<Record<string, any> | null>(null);
  const [prodTestXmlPreview, setProdTestXmlPreview] = useState<string | null>(null);
  const [parsedProdTestReport, setParsedProdTestReport] = useState<MeridianLinkParsedReport | null>(null);
  const [prodTestStatusMessage, setProdTestStatusMessage] = useState<string | null>(null);
  const [creditCardAverageRate, setCreditCardAverageRate] = useState<CreditCardAverageRatePayload | null>(null);
  const [creditCardRateEstimate, setCreditCardRateEstimate] = useState('');
  const [showCreditCardRatePrompt, setShowCreditCardRatePrompt] = useState(false);
  const [creditPullCompleted, setCreditPullCompleted] = useState(false);
  const [pendingCreditError, setPendingCreditError] = useState<string | null>(null);
  const [pendingProdTestResult, setPendingProdTestResult] = useState<Record<string, any> | null>(null);
  const [pendingProdTestXmlPreview, setPendingProdTestXmlPreview] = useState<string | null>(null);
  const [pendingParsedProdTestReport, setPendingParsedProdTestReport] = useState<MeridianLinkParsedReport | null>(null);
  const [pendingProdTestStatusMessage, setPendingProdTestStatusMessage] = useState<string | null>(null);
  const [pendingCreditScore, setPendingCreditScore] = useState<number | null>(null);
  const [pendingMortgages, setPendingMortgages] = useState<Mortgage[]>([]);
  const [liabilityActions, setLiabilityActions] = useState<Record<string, LiabilityActionState>>({});
  const [selectedLoanAmount, setSelectedLoanAmount] = useState<number>(0);
  const [submittedSelectedLoanAmount, setSubmittedSelectedLoanAmount] = useState<number>(0);
  const [previousQuote, setPreviousQuote] = useState<QuoteCalc | null>(null);
  const [scoreAdjustedQuote, setScoreAdjustedQuote] = useState<QuoteCalc | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Updated numbers
  const [originalCashAvailable, setOriginalCashAvailable] = useState<number>(0);

  // Properties from form
  const [properties, setProperties] = useState<{ address: string; index: number }[]>([]);

  useEffect(() => {
    const loadCreditMetadata = async () => {
      try {
        const [creditRes, averageRateRes] = await Promise.all([
          fetch('/api/credit/softpull'),
          fetch('/api/credit-card-average-rate'),
        ]);

        if (creditRes.ok) {
          const payload = await creditRes.json();
          setApiMetadata(payload);
          if (payload?.approvedProdTestBorrower) {
            setProdTestBorrower((prev) => ({
              firstName: payload.approvedProdTestBorrower.firstName || prev.firstName,
              lastName: payload.approvedProdTestBorrower.lastName || prev.lastName,
              middleName: payload.approvedProdTestBorrower.middleName || prev.middleName,
              suffixName: payload.approvedProdTestBorrower.suffixName || prev.suffixName,
              dob: payload.approvedProdTestBorrower.dob || prev.dob,
              ssn: prev.ssn,
              address: payload.approvedProdTestBorrower.address || prev.address,
              city: payload.approvedProdTestBorrower.city || prev.city,
              state: payload.approvedProdTestBorrower.state || prev.state,
              zip: payload.approvedProdTestBorrower.zip || prev.zip,
              preferredResponseFormat:
                payload.approvedProdTestBorrower.preferredResponseFormat || prev.preferredResponseFormat,
            }));
          }
        }

        if (averageRateRes.ok) {
          const averagePayload: CreditCardAverageRatePayload = await averageRateRes.json();
          setCreditCardAverageRate(averagePayload);
        }
      } catch (err) {
        console.error('Failed to load credit metadata', err);
      }
    };

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
        if (hydratedData.estimatedCreditCardAverageRate !== undefined && hydratedData.estimatedCreditCardAverageRate !== null) {
          setCreditCardRateEstimate(String(hydratedData.estimatedCreditCardAverageRate));
        }

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
        const initialLoanAmount = Number(hydratedData.desiredLoanAmount) || Number(hydratedData.maxAvailable) || 0;
        setSelectedLoanAmount(initialLoanAmount);
        setSubmittedSelectedLoanAmount(initialLoanAmount);
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

    loadCreditMetadata();
    hydrate();
  }, []);

  useEffect(() => {
    const parsedRate = Number(creditCardRateEstimate);
    const hasRate = creditCardRateEstimate.trim().length > 0 && Number.isFinite(parsedRate);
    if (!hasRate) return;
    if (Number(formData.estimatedCreditCardAverageRate) === parsedRate) return;

    const timeoutId = window.setTimeout(() => {
      void persistEstimatedCreditCardRate(parsedRate);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [creditCardRateEstimate, formData]);

  const steps = [
    { label: 'Quote', icon: '💬', state: 'done' as const },
    { label: 'Property Value', icon: '🏠', state: 'done' as const },
    {
      label: 'Soft Credit Check',
      icon: '📊',
      state: (currentStep === 'credit' || currentStep === 'score-adjustment' || currentStep === 'mortgages') ? 'current' as const : 'done' as const,
    },
    {
      label: 'Update Quote',
      icon: '💰',
      state: currentStep === 'updated-quote' ? 'current' as const : 'upcoming' as const,
    },
    { label: 'Finalize Details', icon: '📝', state: 'upcoming' as const },
  ];
  const hasCoBorrower = formData['Borrower - Has Co-Borrower'] === 'Yes';
  const isDedicatedSoftCreditPage = pathname === '/quote/soft-credit';
  const isMeridianLinkProdTest = isDedicatedSoftCreditPage || (apiMetadata?.provider || '').toLowerCase() === 'meridianlink';
  const prodTestRequiredReady = Boolean(
    prodTestBorrower.firstName &&
      prodTestBorrower.lastName &&
      prodTestBorrower.ssn &&
      prodTestBorrower.address &&
      prodTestBorrower.city &&
      prodTestBorrower.state &&
      prodTestBorrower.zip
  );
  const parsedEstimatedCreditCardRate = Number(creditCardRateEstimate);
  const hasEstimatedCreditCardRate = creditCardRateEstimate.trim().length > 0 && Number.isFinite(parsedEstimatedCreditCardRate);
  const defaultAverageRate = parseAverageRateValue(creditCardAverageRate);
  const resolvedAverageRate = defaultAverageRate ?? 21.52;
  const openLiabilities = parsedProdTestReport?.liabilities.filter(isOpenLiability) || [];
  const openMortgageLiabilities = openLiabilities.filter(isMortgageLiability);
  const openConsumerLiabilities = openLiabilities
    .filter((liability) => !isMortgageLiability(liability))
    .sort((a, b) => (b.unpaidBalance || 0) - (a.unpaidBalance || 0));
  const product = String(formData.product || 'HELOC');
  const propertyType = String(formData.propertyType || 'Primary');
  const propertyState = String(formData.propertyState || '');
  const occupancy = String(formData.occupancy || '');
  const structureType = String(formData.structureType || 'SFR');
  const numberOfUnits = Number(formData.numberOfUnits || 1);
  const drawTerm = Number(formData.drawTerm || formData.helocDrawTerm) || 3;
  const cesTerm = Number(formData.cesTerm) || 20;
  const loanBalance = Number(formData.loanBalance || 0);
  const statedCreditScore = Number(formData.creditScore) || 680;
  const verifiedPropertyValue = Number(avmResult?.estimatedValue || formData.verifiedPropertyValue || formData.propertyValue || 0);
  const displayedMaxAvailable = floorDisplayedMaxAvailable(scoreAdjustedQuote?.maxAvailable || previousQuote?.maxAvailable || 0);

  useEffect(() => {
    if (product !== 'HELOC' && product !== 'CES') {
      setPreviousQuote(null);
      setScoreAdjustedQuote(null);
      setPricingLoading(false);
      setPricingError('Pricing API is not wired for this product yet.');
      return;
    }

    if (!verifiedPropertyValue || !propertyState || !statedCreditScore) {
      setPreviousQuote(null);
      setScoreAdjustedQuote(null);
      setPricingLoading(false);
      return;
    }

    const originalLoanAmount = Number(formData.desiredLoanAmount || originalCashAvailable || MIN_LOAN_AMOUNT);
    const selectedCommittedAmount = submittedSelectedLoanAmount > 0
      ? submittedSelectedLoanAmount
      : Number(formData.desiredLoanAmount || originalCashAvailable || MIN_LOAN_AMOUNT);

    const buildPricingBody = (desiredLoanAmount: number, scenarioCreditScore: number) => ({
      engine: 'BestX',
      input: {
        bestExProduct: product,
        bestExDrawPeriodYears: drawTerm,
        bestExTermYears: cesTerm,
        bestExLockPeriodDays: 30,
        bestExDocType: 'Full Doc',
        propertyState,
        propertyValue: verifiedPropertyValue,
        loanBalance,
        desiredLoanAmount,
        creditScore: scenarioCreditScore,
        dti: 35,
        occupancy: mapStageOccupancy(propertyType, occupancy),
        structureType: mapStructureType(structureType),
        numberOfUnits,
        cashOut: false,
      },
    });

    const timeout = window.setTimeout(async () => {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const [previousResponse, updatedResponse] = await Promise.all([
          fetch('/api/stage1-pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPricingBody(originalLoanAmount, statedCreditScore)),
          }),
          fetch('/api/stage1-pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPricingBody(selectedCommittedAmount, creditScore || statedCreditScore)),
          }),
        ]);

        if (!previousResponse.ok || !updatedResponse.ok) {
          throw new Error('stage1 pricing failed');
        }

        const previousPricing = await previousResponse.json() as Stage1PricingResponse;
        const updatedPricing = await updatedResponse.json() as Stage1PricingResponse;
        const previousEligible = previousPricing.results.find((entry) => entry.eligibility.eligible);
        const updatedEligible = updatedPricing.results.find((entry) => entry.eligibility.eligible);

        if (!previousEligible || !updatedEligible) {
          throw new Error('No eligible pricing result returned');
        }

        setPreviousQuote({
          maxAvailable: previousEligible.quote.maxAvailable,
          rate: previousEligible.quote.rate,
          monthlyPayment: Math.round(previousEligible.quote.monthlyPayment),
        });
        setScoreAdjustedQuote({
          maxAvailable: updatedEligible.quote.maxAvailable,
          rate: updatedEligible.quote.rate,
          monthlyPayment: Math.round(updatedEligible.quote.monthlyPayment),
        });
      } catch (error) {
        console.error('Failed to load live pricing in validate flow', error);
        setPreviousQuote(null);
        setScoreAdjustedQuote(null);
        setPricingError('Live pricing is unavailable. This step still needs API wiring.');
      } finally {
        setPricingLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    product,
    verifiedPropertyValue,
    propertyState,
    statedCreditScore,
    formData.desiredLoanAmount,
    originalCashAvailable,
    submittedSelectedLoanAmount,
    creditScore,
    drawTerm,
    cesTerm,
    loanBalance,
    propertyType,
    occupancy,
    structureType,
    numberOfUnits,
  ]);

  const effectiveSelectedLoanAmount = selectedLoanAmount > 0
    ? clampLoanAmount(selectedLoanAmount, displayedMaxAvailable)
    : clampLoanAmount(originalCashAvailable || previousQuote?.maxAvailable || displayedMaxAvailable, displayedMaxAvailable);
  const appliedSelectedLoanAmount = submittedSelectedLoanAmount > 0
    ? clampLoanAmount(submittedSelectedLoanAmount, displayedMaxAvailable)
    : effectiveSelectedLoanAmount;
  const sliderDirty = effectiveSelectedLoanAmount !== appliedSelectedLoanAmount;
  const previousPayment = previousQuote?.monthlyPayment || 0;
  const updatedPayment = scoreAdjustedQuote?.monthlyPayment || 0;
  const payoffTotal = openLiabilities.reduce((sum, liability) => {
    const action = liabilityActions[liability.id];
    return action?.resolution === 'payoff' ? sum + (liability.unpaidBalance || 0) : sum;
  }, 0);
  const maxPayoff = displayedMaxAvailable - payoffTotal;
  const liveRate = scoreAdjustedQuote?.rate || 0;
  const cashBackAmount = appliedSelectedLoanAmount - payoffTotal;
  const originationFee = getOriginationFeeDetails({
    propertyState,
    program: product,
    product,
    loanAmount: appliedSelectedLoanAmount,
  });
  const prepaidInterest = Math.round(((appliedSelectedLoanAmount * liveRate / 100) / 365) * 15);
  const estimatedCostRows = [
    { desc: `Origination Fee (${originationFee.originationFeePct.toFixed(3)}%)`, amount: originationFee.originationFeeAmount },
    { desc: 'Appraisal Fee', amount: 500 },
    { desc: 'Credit Report', amount: 75 },
    { desc: 'Flood Certification', amount: 15 },
    { desc: 'Title Search', amount: 250 },
    { desc: 'Title Insurance (Lender)', amount: 350 },
    { desc: 'Settlement/Closing Fee', amount: 495 },
    { desc: 'Recording Fees', amount: 150 },
    { desc: 'Prepaid Interest (15 days)', amount: prepaidInterest },
    { desc: 'Homeowners Insurance (2 mo)', amount: 300 },
  ];
  const estimatedClosingCostsTotal = estimatedCostRows.reduce((sum, item) => sum + item.amount, 0);
  const sidebarProgress = currentStep === 'credit' ? 68 : currentStep === 'score-adjustment' ? 76 : currentStep === 'mortgages' ? 84 : 92;

  useEffect(() => {
    if (!displayedMaxAvailable) return;
    setSelectedLoanAmount((prev) => {
      const baseline = prev || originalCashAvailable || displayedMaxAvailable;
      return clampLoanAmount(baseline, displayedMaxAvailable);
    });
    setSubmittedSelectedLoanAmount((prev) => {
      const baseline = prev || originalCashAvailable || displayedMaxAvailable;
      return clampLoanAmount(baseline, displayedMaxAvailable);
    });
  }, [displayedMaxAvailable, originalCashAvailable]);

  const persistEstimatedCreditCardRate = async (rateValue: number) => {
    const nextFormData = {
      ...formData,
      estimatedCreditCardAverageRate: rateValue,
    };

    setFormData(nextFormData);
    localStorage.setItem('stage2-progress', JSON.stringify(nextFormData));

    try {
      await fetch('/api/application', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData: {
            estimatedCreditCardAverageRate: rateValue,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to persist estimated credit card average rate', error);
    }
  };

  const goToStep = (step: ValidationStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeCreditPull = async () => {
    setLoading(true);
    setCreditPullCompleted(false);
    setPendingCreditError(null);
    setPendingProdTestResult(null);
    setPendingProdTestXmlPreview(null);
    setPendingParsedProdTestReport(null);
    setPendingProdTestStatusMessage(null);
    setPendingCreditScore(null);
    setPendingMortgages([]);
    setLiabilityActions({});

    try {
      const requestBody = isMeridianLinkProdTest
        ? {
            mode: 'production-test',
            borrower: {
              ...prodTestBorrower,
              preferredResponseFormat: 'Xml',
            },
          }
        : {
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
          };

      const res = await fetch('/api/credit/softpull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || 'Soft credit check failed.');
      }

      if (isMeridianLinkProdTest) {
        const responseXml = String(payload?.responseXml || '').trim();
        if (!responseXml) {
          throw new Error('MeridianLink test returned no XML payload.');
        }

        const parsedReport = parseMeridianLinkResponseXml(responseXml);
        const representativeScore = getRepresentativeMeridianLinkScore(parsedReport.scores);
        const mortgageLiabilities = parsedReport.liabilities.filter((liability) => isMortgageLiability(liability) && isOpenLiability(liability));

        setPendingProdTestResult(payload);
        setPendingProdTestXmlPreview(responseXml.slice(0, 350));
        setPendingParsedProdTestReport(parsedReport);
        setPendingProdTestStatusMessage(String(payload?.reportStatusMessage || '').trim() || null);
        setPendingCreditScore(representativeScore);
        setPendingMortgages(mortgageLiabilities.map(mapLiabilityToMortgage));
        return;
      }

      setPendingCreditScore(Number(payload?.scores?.representative) || null);
      setPendingMortgages(
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
    } catch (error) {
      setPendingCreditError(error instanceof Error ? error.message : 'Soft credit check failed.');
    } finally {
      setLoading(false);
      setCreditPullCompleted(true);
    }
  };

  const handleCreditPull = async () => {
    setCreditError(null);
    setShowCreditCardRatePrompt(true);
    void executeCreditPull();
  };

  const handleMortgageMatch = (mortgageId: string, propertyIndex: number | null) => {
    setMortgages(prev => prev.map(m =>
      m.id === mortgageId ? { ...m, matchedPropertyIndex: propertyIndex } : m
    ));
  };

  const getLiabilityAction = (liabilityId: string): LiabilityActionState => (
    liabilityActions[liabilityId] || {
      resolution: null,
      excludeReason: '',
      excludeExplanation: '',
      manualRate: '',
    }
  );

  const updateLiabilityAction = (liabilityId: string, updates: Partial<LiabilityActionState>) => {
    setLiabilityActions((prev) => {
      const current = prev[liabilityId] || {
        resolution: null,
        excludeReason: '',
        excludeExplanation: '',
        manualRate: '',
      };

      return {
        ...prev,
        [liabilityId]: {
          ...current,
          ...updates,
        },
      };
    });
  };

  const handleContinueToFinalizeDetails = async () => {
    const nextFormData = {
      ...formData,
      desiredLoanAmount: appliedSelectedLoanAmount,
      verifiedMaxAvailable: displayedMaxAvailable,
      verifiedRate: liveRate,
      verifiedMonthlyPayment: updatedPayment,
      verifiedCreditScore: creditScore,
      payoffTotal,
      maxPayoff,
      cashBackAmount,
      'Credit Report - Open Mortgages': openMortgageLiabilities.map((liability) => ({
        id: liability.id,
        creditorName: liability.creditorName,
        accountType: liability.accountType,
        loanType: liability.loanType,
        unpaidBalance: liability.unpaidBalance,
        monthlyPayment: liability.monthlyPayment,
        termMonths: liability.termMonths,
        openedDate: liability.openedDate,
        status: liability.status,
        currentRating: liability.currentRating,
      })),
      'Credit Report - Liability Actions': liabilityActions,
    };

    setFormData(nextFormData);
    localStorage.setItem('stage2-progress', JSON.stringify(nextFormData));

    const parsedRate = Number(creditCardRateEstimate);
    if (creditCardRateEstimate.trim() && Number.isFinite(parsedRate)) {
      await persistEstimatedCreditCardRate(parsedRate);
    }

    router.push('/quote/finalize-details');
  };

  const renderLiabilityActions = (liability: MeridianLinkLiabilitySummary, interestRate: number | null) => {
    const action = getLiabilityAction(liability.id);

    return (
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => updateLiabilityAction(liability.id, {
              resolution: action.resolution === 'payoff' ? null : 'payoff',
              excludeReason: '',
              excludeExplanation: '',
            })}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${action.resolution === 'payoff' ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Payoff
          </button>
          <button
            type="button"
            onClick={() => updateLiabilityAction(liability.id, {
              resolution: action.resolution === 'exclude' ? null : 'exclude',
            })}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${action.resolution === 'exclude' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Exclude
          </button>
        </div>

        {action.resolution === 'exclude' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Why exclude this account?</label>
              <select
                value={action.excludeReason}
                onChange={(e) => updateLiabilityAction(liability.id, {
                  excludeReason: e.target.value as LiabilityActionState['excludeReason'],
                  excludeExplanation: e.target.value === 'Other' ? action.excludeExplanation : '',
                })}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select a reason</option>
                <option value="Already paid off">Already paid off</option>
                <option value="Someone else pays this">Someone else pays this</option>
                <option value="I don't recognize this account">I don&apos;t recognize this account</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {action.excludeReason === 'Other' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Explain</label>
                <input
                  type="text"
                  value={action.excludeExplanation}
                  onChange={(e) => updateLiabilityAction(liability.id, { excludeExplanation: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Tell us why this should be excluded"
                />
              </div>
            )}
          </div>
        )}

      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">

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

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">

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
              {isMeridianLinkProdTest ? (
                <>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
                    <p className="font-semibold">Temporary MeridianLink production test mode</p>
                    <p className="mt-1">
                      This page is acting as a MeridianLink XML test harness. The borrower fields below are sent
                      directly to the production-test route so you can try different test files.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3">Test borrower details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={prodTestBorrower.firstName}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, firstName: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Middle Name</label>
                        <input
                          type="text"
                          value={prodTestBorrower.middleName}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, middleName: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={prodTestBorrower.lastName}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, lastName: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Suffix</label>
                        <input
                          type="text"
                          value={prodTestBorrower.suffixName}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, suffixName: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <SSNField
                        label="Social Security Number"
                        name="prod-test-ssn"
                        value={prodTestBorrower.ssn}
                        onChange={(_, v) => setProdTestBorrower(prev => ({ ...prev, ssn: v }))}
                        required
                      />
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Response Format</label>
                        <select
                          value="Xml"
                          disabled
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50 text-gray-500"
                        >
                          <option value="Xml">Xml</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">This UI pass is locked to scrubbed XML so we can parse and present the credit data cleanly.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold text-gray-800 mb-3">Current residence used in the request XML</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Street Address <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={prodTestBorrower.address}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">City <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={prodTestBorrower.city}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">State <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          maxLength={2}
                          value={prodTestBorrower.state}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={prodTestBorrower.zip}
                          onChange={(e) => setProdTestBorrower(prev => ({ ...prev, zip: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                </>
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
                disabled={
                  loading ||
                  (isMeridianLinkProdTest
                    ? !prodTestRequiredReady
                    : !dob || ssn.length < 9 || (hasCoBorrower && (!cobDob || cobSsn.length < 9)))
                }
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                  !loading &&
                  (isMeridianLinkProdTest
                    ? prodTestRequiredReady
                    : dob && ssn.length >= 9 && (!hasCoBorrower || (cobDob && cobSsn.length >= 9)))
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
                    {isMeridianLinkProdTest ? 'Submitting MeridianLink Test...' : 'Pulling Credit Report...'}
                  </span>
                ) : isMeridianLinkProdTest ? (
                  'Submit MeridianLink Bill Test →'
                ) : (
                  'Run Credit Check →'
                )}
              </button>

              {prodTestResult && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
                  <p className="font-semibold">MeridianLink test submitted successfully.</p>
                  <div className="mt-2 space-y-1 text-xs md:text-sm">
                    <p><span className="font-medium">Status:</span> {String(prodTestResult.status || 'Submit')}</p>
                    <p><span className="font-medium">Vendor Order ID:</span> {String(prodTestResult.vendorOrderIdentifier || 'Not returned')}</p>
                    <p><span className="font-medium">Borrower:</span> {String(prodTestResult.borrower?.firstName || '')} {String(prodTestResult.borrower?.lastName || '')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showCreditCardRatePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-2xl">💳</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900">While we wait for that to load</h3>
                  <p className="mt-2 text-gray-600">
                    Credit cards don&apos;t report their interest rate. To estimate interest payments more accurately,
                    please choose your estimated average credit card rate.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm leading-6 text-amber-900">
                  The current average is <span className="font-semibold">{creditCardAverageRate?.averageLabel || `${resolvedAverageRate.toFixed(2)}%`}</span>,
                  and that&apos;s often a safe number to use.
                </p>

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Estimated average credit card rate</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        step="0.01"
                        value={creditCardRateEstimate}
                        onChange={(e) => setCreditCardRateEstimate(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder={resolvedAverageRate.toFixed(2)}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500">%</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreditCardRateEstimate(resolvedAverageRate.toFixed(2));
                    }}
                    className="rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Use Average
                  </button>
                </div>

                <p className="mt-3 text-xs text-amber-800">
                  {creditCardAverageRate?.observedDate ? `Observed date: ${creditCardAverageRate.observedDate}.` : ''}
                  {creditCardAverageRate?.cached !== undefined ? ` ${creditCardAverageRate.cached ? 'Served from daily cache.' : 'Fetched fresh today.'}` : ''}
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {loading
                  ? (isMeridianLinkProdTest ? 'Submitting MeridianLink test while you choose a credit card rate...' : 'Loading the credit report while you choose a credit card rate...')
                  : pendingCreditError
                    ? 'Credit submission finished. Continue to see the result.'
                    : creditPullCompleted
                      ? 'Credit submission finished. Continue when you are ready.'
                      : 'Waiting to start credit submission...'}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreditCardRatePrompt(false)}
                  className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!hasEstimatedCreditCardRate || !creditPullCompleted}
                  onClick={async () => {
                    await persistEstimatedCreditCardRate(parsedEstimatedCreditCardRate);
                    setShowCreditCardRatePrompt(false);

                    if (pendingCreditError) {
                      setCreditError(pendingCreditError);
                      return;
                    }

                    setProdTestResult(pendingProdTestResult);
                    setProdTestXmlPreview(pendingProdTestXmlPreview);
                    setParsedProdTestReport(pendingParsedProdTestReport);
                    setProdTestStatusMessage(pendingProdTestStatusMessage);
                    setCreditScore(pendingCreditScore);
                    setMortgages(pendingMortgages);
                    goToStep('score-adjustment');
                  }}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold text-white ${hasEstimatedCreditCardRate && creditPullCompleted ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
                >
                  {loading ? 'Waiting for credit...' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'score-adjustment' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 mb-4">
                Updated quote based on your actual score
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Updated Quote</h2>
              <p className="text-gray-600">Before the credit report review, here&apos;s the quote adjusted to your actual credit score. You can reselect the loan amount now.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
                <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Previous Max Loan Amount</div>
                <div className="text-xl font-bold text-gray-400 line-through">{formatCurrency(previousQuote?.maxAvailable || 0)}</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 text-center border-2 border-emerald-300">
                <div className="text-xs uppercase tracking-wider text-emerald-600 font-semibold mb-1">Updated Max Loan Amount</div>
                <div className="text-xl font-bold text-emerald-700">{formatCurrency(displayedMaxAvailable)}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
                <div className="text-xs uppercase tracking-wider text-blue-500 font-semibold mb-1">Representative Score</div>
                <div className="text-xl font-bold text-blue-900">{creditScore || statedCreditScore}</div>
              </div>
            </div>

            {pricingError && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {pricingError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
                <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Previous Rate</div>
                <div className="text-xl font-bold text-gray-400 line-through">{previousQuote?.rate ? `${previousQuote.rate.toFixed(2)}%` : '—'}</div>
              </div>
              <div className={`rounded-xl p-4 text-center border-2 ${previousQuote?.rate && liveRate <= previousQuote.rate ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Updated Rate</div>
                <div className={`text-xl font-bold ${previousQuote?.rate && liveRate <= previousQuote.rate ? 'text-green-700' : 'text-amber-700'}`}>{pricingLoading ? 'Loading rate...' : liveRate ? `${liveRate.toFixed(2)}%` : '—'}</div>
              </div>
              <div className="bg-gray-100 rounded-xl p-4 text-center border border-gray-200">
                <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">Previous Payment</div>
                <div className="text-xl font-bold text-gray-400 line-through">{formatCurrency(previousPayment)}</div>
              </div>
              <div className={`rounded-xl p-4 text-center border-2 ${previousPayment > 0 && updatedPayment <= previousPayment ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Updated Payment</div>
                <div className={`text-xl font-bold ${previousPayment > 0 && updatedPayment <= previousPayment ? 'text-green-700' : 'text-amber-700'}`}>{pricingLoading ? 'Loading payment...' : formatCurrency(updatedPayment)}</div>
              </div>
            </div>

            {displayedMaxAvailable > 0 && (
              <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
                <LoanAmountSlider
                  value={effectiveSelectedLoanAmount}
                  max={displayedMaxAvailable}
                  min={Math.min(MIN_LOAN_AMOUNT, displayedMaxAvailable)}
                  onChange={setSelectedLoanAmount}
                  onCommit={setSubmittedSelectedLoanAmount}
                />
                <div className="mt-3 text-center text-sm text-gray-600">
                  {sliderDirty ? 'Move the slider, release to refresh the quote.' : `${product} payment updates after you release the slider.`}
                </div>
              </div>
            )}

            <button
              onClick={() => goToStep('mortgages')}
              disabled={pricingLoading || !scoreAdjustedQuote}
              className="w-full py-4 px-6 rounded-xl font-semibold text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white shadow-lg transition-all"
            >
              Continue to Credit Report Review →
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STEP 3: MORTGAGE ASSIGNMENT
        ═══════════════════════════════════════════════ */}
        {currentStep === 'mortgages' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            {prodTestResult && (
              <div className={`mb-6 rounded-xl px-4 py-4 text-sm ${prodTestResult.reportReady === false ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'border border-green-200 bg-green-50 text-green-800'}`}>
                <p className="font-semibold">
                  {prodTestResult.reportReady === false
                    ? 'MeridianLink accepted the submission, but no populated report data was returned yet.'
                    : 'MeridianLink XML pulled successfully.'}
                </p>
                <div className="mt-2 space-y-1 text-xs md:text-sm">
                  <p><span className="font-medium">Status:</span> {String(prodTestResult.status || 'Submit')}</p>
                  <p><span className="font-medium">Vendor Order ID:</span> {String(prodTestResult.vendorOrderIdentifier || 'Not returned')}</p>
                  <p><span className="font-medium">Borrower:</span> {String(prodTestResult.borrower?.firstName || '')} {String(prodTestResult.borrower?.lastName || '')}</p>
                  {prodTestStatusMessage && <p><span className="font-medium">Report Status:</span> {prodTestStatusMessage}</p>}
                  {prodTestResult.responseSummary && (
                    <p><span className="font-medium">Detected Data:</span> files {Number(prodTestResult.responseSummary.creditFileCount || 0)}, scores {Number(prodTestResult.responseSummary.creditScoreCount || 0)}, liabilities {Number(prodTestResult.responseSummary.creditLiabilityCount || 0)}</p>
                  )}
                  <p><span className="font-medium">XML Preview:</span></p>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-3 text-[11px] leading-4 text-current">{prodTestXmlPreview || 'No XML preview returned.'}</pre>
                </div>
              </div>
            )}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <span className="text-3xl">🏦</span>
              </div>
              <div className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 mb-4">
                {isMeridianLinkProdTest ? 'Review open accounts' : 'Review reported mortgages'}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isMeridianLinkProdTest ? 'Credit Report Review' : 'Match Your Mortgages'}
              </h2>
              <p className="text-gray-600">
                {isMeridianLinkProdTest
                  ? `We found ${openMortgageLiabilities.length} open mortgage account${openMortgageLiabilities.length !== 1 ? 's' : ''} and ${openConsumerLiabilities.length} open consumer account${openConsumerLiabilities.length !== 1 ? 's' : ''}.`
                  : `We found ${mortgages.length} mortgage${mortgages.length !== 1 ? 's' : ''} on your credit report. Match each one to the right property so the updated quote is accurate.`}
              </p>
              {creditScore && (
                <div className="inline-flex items-center gap-2 mt-3 bg-green-50 px-4 py-2 rounded-full">
                  <span className="text-sm text-green-700 font-medium">Representative Credit Score: {creditScore}</span>
                </div>
              )}
            </div>

            {isMeridianLinkProdTest && parsedProdTestReport && (
              <div className="mb-8 space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Open mortgage accounts</h3>
                  <div className="space-y-4">
                    {openMortgageLiabilities.map((liability) => {
                      const action = getLiabilityAction(liability.id);
                      const interestRate = getDisplayedInterestRate(liability, hasEstimatedCreditCardRate ? parsedEstimatedCreditCardRate : null, action.manualRate);
                      const cardClasses = action.resolution === 'payoff'
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : action.resolution === 'exclude'
                          ? 'border-blue-200 bg-blue-50/60'
                          : 'border-gray-200 hover:border-blue-300';
                      return (
                        <div key={liability.id} className={`border-2 rounded-xl p-5 transition-colors ${cardClasses}`}>
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 lg:max-w-[180px]">
                              <h4 className="font-semibold text-gray-900 truncate">{liability.creditorName}</h4>
                              <p className="text-sm text-gray-500 truncate">{liability.loanType || liability.accountType || 'Mortgage'}</p>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm lg:flex-1">
                              <div>
                                <p className="text-gray-500">Balance</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(liability.unpaidBalance)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Payment</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(liability.monthlyPayment)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Term</p>
                                <p className="font-semibold text-gray-900">{liability.termMonths ? `${liability.termMonths} mo` : '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Open Date</p>
                                <p className="font-semibold text-gray-900">{formatDate(liability.openedDate)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Rate</p>
                                <div className="relative mt-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    step="0.01"
                                    value={action.manualRate !== '' ? action.manualRate : (interestRate !== null ? interestRate.toFixed(2) : '')}
                                    onChange={(e) => updateLiabilityAction(liability.id, { manualRate: e.target.value })}
                                    className="w-full min-w-[92px] rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="Enter"
                                  />
                                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {renderLiabilityActions(liability, interestRate)}
                        </div>
                      );
                    })}
                    {openMortgageLiabilities.length === 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                        No open mortgage accounts were found in this report.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Open consumer accounts</h3>
                  <div className="space-y-4">
                    {openConsumerLiabilities.map((liability) => {
                      const action = getLiabilityAction(liability.id);
                      const interestRate = getDisplayedInterestRate(liability, hasEstimatedCreditCardRate ? parsedEstimatedCreditCardRate : null, action.manualRate);
                      const cardClasses = action.resolution === 'payoff'
                        ? 'border-emerald-200 bg-emerald-50/60'
                        : action.resolution === 'exclude'
                          ? 'border-blue-200 bg-blue-50/60'
                          : 'border-gray-200';
                      return (
                        <div key={liability.id} className={`rounded-xl border p-5 transition-colors ${cardClasses}`}>
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 lg:max-w-[180px]">
                              <h4 className="font-semibold text-gray-900 truncate">{liability.creditorName}</h4>
                              <p className="text-sm text-gray-500 truncate">{liability.loanType || liability.accountType || 'Consumer account'}</p>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm lg:flex-1">
                              <div>
                                <p className="text-gray-500">Balance</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(liability.unpaidBalance)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Payment</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(liability.monthlyPayment)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Term</p>
                                <p className="font-semibold text-gray-900">{liability.termMonths ? `${liability.termMonths} mo` : '—'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Open Date</p>
                                <p className="font-semibold text-gray-900">{formatDate(liability.openedDate)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Rate</p>
                                <div className="relative mt-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="99"
                                    step="0.01"
                                    value={action.manualRate !== '' ? action.manualRate : (interestRate !== null ? interestRate.toFixed(2) : '')}
                                    onChange={(e) => updateLiabilityAction(liability.id, { manualRate: e.target.value })}
                                    className="w-full min-w-[92px] rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    placeholder="Enter"
                                  />
                                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">%</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {renderLiabilityActions(liability, interestRate)}
                        </div>
                      );
                    })}
                    {openConsumerLiabilities.length === 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                        No open consumer accounts were found in this report.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => goToStep('updated-quote')}
              className="w-full py-4 px-6 rounded-xl font-semibold text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg transition-all"
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
                <p className="text-3xl font-bold text-gray-400 text-center line-through">{formatCurrency(originalCashAvailable)}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-5 border-2 border-emerald-200">
                <p className="text-sm text-emerald-600 mb-1 text-center">Verified Amount</p>
                <p className="text-3xl font-bold text-emerald-700 text-center">{formatCurrency(appliedSelectedLoanAmount)}</p>
              </div>
            </div>

            {pricingError && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {pricingError}
              </div>
            )}

            <div className="bg-blue-50 rounded-xl p-5 mb-8 text-center">
              <p className="text-sm text-blue-600 mb-1">Updated Rate</p>
              <p className="text-4xl font-bold text-blue-700">{pricingLoading ? 'Loading rate...' : liveRate ? `${liveRate.toFixed(2)}%` : '—'}</p>
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
                <span className="font-medium text-gray-900">{formatCurrency(Number(formData.loanBalance || 0))}</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-gray-600">Payoff Total</span>
                <span className="font-medium text-gray-900">{formatCurrency(payoffTotal)}</span>
              </div>
              <div className="flex justify-between px-5 py-3">
                <span className="text-gray-600">Max Payoff</span>
                <span className="font-medium text-gray-900">{formatCurrency(maxPayoff)}</span>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="bg-gray-50 px-5 py-3 flex justify-between text-sm font-semibold text-gray-700">
                <span>Estimated Costs</span>
                <span>Amount</span>
              </div>
              <div className="px-5 py-2 bg-blue-50 text-sm font-semibold text-blue-700">Loan Costs</div>
              {estimatedCostRows.map((item, i) => (
                <div key={i} className="flex justify-between px-5 py-2.5 text-sm border-t border-gray-100">
                  <span className="text-gray-700">{item.desc}</span>
                  <span className="font-medium text-gray-900">${item.amount.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t border-blue-100 bg-blue-50 px-5 py-3 text-xs text-blue-700">
                State fee schedule: {originationFee.stateGroupName || 'All Others'} {originationFee.program ? `• ${originationFee.program}` : ''}
              </div>
              <div className="flex justify-between px-5 py-4 bg-gray-900 text-white font-bold text-lg">
                <span>Estimated Total</span>
                <span>${estimatedClosingCostsTotal.toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mb-6">
              These are estimates only. Origination fee is pulled from the state and loan-amount fee schedule. Actual closing costs may vary. Your loan officer will provide a detailed Loan Estimate.
            </p>

            <button
              onClick={handleContinueToFinalizeDetails}
              disabled={pricingLoading || !scoreAdjustedQuote}
              className="w-full py-4 px-6 rounded-xl font-semibold text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white shadow-lg hover:shadow-xl transition-all"
            >
              Continue to Finalize Details →
            </button>
          </div>
        )}

          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              <QuoteBuilder
                maxAvailable={displayedMaxAvailable || previousQuote?.maxAvailable || originalCashAvailable}
                desiredLoanAmount={appliedSelectedLoanAmount}
                rateRange={{ min: liveRate, max: liveRate }}
                monthlyPayment={updatedPayment}
                progress={sidebarProgress}
                stage="stage2"
                sticky={false}
                showMaxAvailable={false}
              />

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Payoff Total</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(payoffTotal)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Max Payoff</span>
                  <span className={`font-semibold ${maxPayoff < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(maxPayoff)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Cash Back Amount</span>
                  <span className={`font-semibold ${cashBackAmount < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(cashBackAmount)}</span>
                </div>
                <p className="mt-3 text-xs text-gray-500">Closing costs come out next. For now this updates live as payoff accounts are selected.</p>
              </div>
            </div>
          </div>
        </div>

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
