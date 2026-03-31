// Stage 2: Full 1003 Application Form
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SectionCard from '@/components/quote/SectionCard';
import QuoteBuilder from '@/components/quote/QuoteBuilder';
import AddressAutocomplete from '@/components/quote/AddressAutocomplete';
import {
  TextField,
  DateField,
  CurrencyField,
  NumberField,
  SelectField,
  RadioField,
  CheckboxGroupField,
  TextareaField,
  SSNField,
  PhoneField
} from '@/components/quote/FormField';
import { isFieldVisible, isSectionComplete, VisibilityRule } from '@/components/quote/ConditionalEngine';
import visibilityRules from '@/data/dynamic_form_rules.json';
import { useStepTracker } from '@/hooks/useStepTracker';

interface FormData {
  [key: string]: any;
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }
];

const OTHER_INCOME_TYPES = [
  { value: 'Social Security', label: 'Social Security' },
  { value: 'Pension', label: 'Pension' },
  { value: 'Disability', label: 'Disability' },
  { value: 'Child Support Received', label: 'Child Support Received' },
  { value: 'Alimony Received', label: 'Alimony Received' },
  { value: 'Rental Income', label: 'Rental Income' },
  { value: 'Investment Income', label: 'Investment/Dividend Income' },
  { value: 'Trust Income', label: 'Trust Income' },
  { value: 'VA Benefits', label: 'VA Benefits' },
  { value: 'Other', label: 'Other' }
];

// Race field per 1003 - primary race dropdown with sub-options
function RaceField({ prefix, formData, onChange }: {
  prefix: string; // e.g. "Dem - Borrower" or "Dem - Co-Borrower"
  formData: FormData;
  onChange: (name: string, value: any) => void;
}) {
  const raceKey = `${prefix} Race`;
  const raceDetailKey = `${prefix} Race Detail`;
  const tribeKey = `${prefix} Tribe Name`;
  const otherAsianKey = `${prefix} Other Asian`;
  const otherPIKey = `${prefix} Other Pacific Islander`;
  const race = formData[raceKey] || '';

  return (
    <div className="md:col-span-2 space-y-3">
      <SelectField
        label="Race (Optional)"
        name={raceKey}
        value={race}
        onChange={onChange}
        options={[
          { value: 'American Indian or Alaska Native', label: 'American Indian or Alaska Native' },
          { value: 'Asian', label: 'Asian' },
          { value: 'Black or African American', label: 'Black or African American' },
          { value: 'Native Hawaiian or Other Pacific Islander', label: 'Native Hawaiian or Other Pacific Islander' },
          { value: 'White', label: 'White' },
          { value: 'I do not wish to provide', label: 'I do not wish to provide' }
        ]}
      />

      {/* American Indian - tribe name */}
      {race === 'American Indian or Alaska Native' && (
        <TextField label="Name of enrolled or principal tribe" name={tribeKey} value={formData[tribeKey]} onChange={onChange} placeholder="Enter tribe name" />
      )}

      {/* Asian - sub-options */}
      {race === 'Asian' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SelectField
            label="Asian Detail"
            name={raceDetailKey}
            value={formData[raceDetailKey]}
            onChange={onChange}
            options={[
              { value: 'Asian Indian', label: 'Asian Indian' },
              { value: 'Chinese', label: 'Chinese' },
              { value: 'Filipino', label: 'Filipino' },
              { value: 'Japanese', label: 'Japanese' },
              { value: 'Korean', label: 'Korean' },
              { value: 'Vietnamese', label: 'Vietnamese' },
              { value: 'Other Asian', label: 'Other Asian' }
            ]}
          />
          {formData[raceDetailKey] === 'Other Asian' && (
            <TextField label="Other Asian race" name={otherAsianKey} value={formData[otherAsianKey]} onChange={onChange} placeholder="e.g. Hmong, Laotian, Thai, Pakistani, Cambodian" />
          )}
        </div>
      )}

      {/* Native Hawaiian or Other Pacific Islander - sub-options */}
      {race === 'Native Hawaiian or Other Pacific Islander' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SelectField
            label="Pacific Islander Detail"
            name={raceDetailKey}
            value={formData[raceDetailKey]}
            onChange={onChange}
            options={[
              { value: 'Native Hawaiian', label: 'Native Hawaiian' },
              { value: 'Guamanian or Chamorro', label: 'Guamanian or Chamorro' },
              { value: 'Samoan', label: 'Samoan' },
              { value: 'Other Pacific Islander', label: 'Other Pacific Islander' }
            ]}
          />
          {formData[raceDetailKey] === 'Other Pacific Islander' && (
            <TextField label="Other Pacific Islander race" name={otherPIKey} value={formData[otherPIKey]} onChange={onChange} placeholder="Enter race" />
          )}
        </div>
      )}
    </div>
  );
}

// Synced Annual/Monthly currency pair - compact inline toggle
// User's typed value is always preserved. Toggle changes the calculation direction, not the input.
function AnnualMonthlyField({ label, namePrefix, formData, onChange, required = false }: {
  label: string;
  namePrefix: string;
  formData: FormData;
  onChange: (name: string, value: any) => void;
  required?: boolean;
}) {
  const annualKey = `${namePrefix} - Annual`;
  const monthlyKey = `${namePrefix} - Monthly`;
  // Track which mode the user originally entered their number in
  const inputModeKey = `${namePrefix} - _inputMode`;
  const [mode, setMode] = useState<'monthly' | 'annual'>(formData[inputModeKey] || 'monthly');
  // Store the raw user input separately so toggling doesn't mutate it
  const inputKey = `${namePrefix} - _rawInput`;
  const rawInput = formData[inputKey] ?? formData[monthlyKey] ?? '';

  const recalculate = (raw: string, currentMode: 'monthly' | 'annual') => {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned) || 0;
    if (currentMode === 'monthly') {
      onChange(monthlyKey, cleaned);
      onChange(annualKey, cleaned ? Math.round(num * 12) : '');
    } else {
      onChange(annualKey, cleaned);
      onChange(monthlyKey, cleaned ? Math.round((num / 12) * 100) / 100 : '');
    }
    onChange(inputKey, cleaned);
    onChange(inputModeKey, currentMode);
  };

  const handleChange = (raw: string) => {
    recalculate(raw, mode);
  };

  // Toggle: keep the user's original number, just recalculate in the other direction
  const handleModeSwitch = (newMode: 'monthly' | 'annual') => {
    if (newMode === mode) return;
    setMode(newMode);
    // Recalculate from the same raw input but in the new mode direction
    const currentRaw = String(rawInput);
    if (currentRaw) {
      recalculate(currentRaw, newMode);
    }
  };

  const monthlyVal = formData[monthlyKey] ?? '';
  const annualVal = formData[annualKey] ?? '';
  const displayValue = rawInput;
  const derivedValue = mode === 'monthly'
    ? (annualVal ? `$${Number(annualVal).toLocaleString()}/yr` : '')
    : (monthlyVal ? `$${Number(monthlyVal).toLocaleString()}/mo` : '');

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex items-center rounded-xl border-2 border-gray-300 focus-within:border-blue-600 bg-white transition-colors overflow-hidden">
        {/* Toggle */}
        <div className="flex shrink-0 border-r border-gray-200">
          <button
            type="button"
            onClick={() => handleModeSwitch('monthly')}
            className={`px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
              mode === 'monthly' ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            /mo
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('annual')}
            className={`px-3 py-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
              mode === 'annual' ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            /yr
          </button>
        </div>
        {/* Dollar sign + input */}
        <span className="pl-3 text-lg text-gray-400">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="0"
          required={required}
          className="flex-1 px-2 py-3 text-lg font-semibold text-gray-900 bg-transparent outline-none placeholder:text-gray-300"
        />
        {/* Derived value inline in the field */}
        {derivedValue && (
          <span className="pr-3 text-xs text-gray-400 whitespace-nowrap">= {derivedValue}</span>
        )}
      </div>
    </div>
  );
}

function Stage2Content() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({});

  // Stage 1 data
  const stage1Product = formData['product'] || '';
  const stage1PropertyType = formData['propertyType'] || 'Primary';
  const stage1Address = formData['propertyAddress'] || '';
  const stage1PropertyValue = formData['propertyValue'] || '';
  const stage1LoanBalance = formData['loanBalance'] || '';
  const isFirstLienProduct = stage1Product === 'CashOut' || stage1Product === 'NoCashRefi';
  const isPrimary = stage1PropertyType === 'Primary';

  // Load Stage 1 data from localStorage, then try GHL prefill
  useEffect(() => {
    const stage1Raw = localStorage.getItem('stage1-data');
    const stage1Data: FormData = stage1Raw ? JSON.parse(stage1Raw) : {};

    // Auto-populate Stage 2 fields from Stage 1
    if (stage1Data.loanBalance && stage1Data.loanBalance !== '0' && Number(stage1Data.loanBalance) > 0) {
      stage1Data['Current Loan - Free & Clear'] = 'No';
      stage1Data['Current Loan - First Mortgage Balance'] = parseFloat(stage1Data.loanBalance);
    } else {
      stage1Data['Current Loan - Free & Clear'] = 'Yes';
    }

    // Auto-populate current address from subject property if primary residence
    if (stage1Data.propertyType === 'Primary' && stage1Data.propertyAddress) {
      if (!stage1Data['Borrower - Current Address']) {
        stage1Data['Borrower - Current Address'] = stage1Data.propertyAddress;
      }
      if (!stage1Data['Borrower - Housing Ownership Type']) {
        stage1Data['Borrower - Housing Ownership Type'] = 'Own';
      }
    }

    // Set default values that are shown visually but need to exist in formData
    const occupancyMap: Record<string, string> = {
      'Primary': 'Primary Residence',
      'Investment': 'Investment Property',
      '2nd Home': 'Second Home',
    };
    if (!stage1Data['Subject Property - Occupancy'] && stage1Data.propertyType) {
      stage1Data['Subject Property - Occupancy'] = occupancyMap[stage1Data.propertyType] || '';
    }
    if (!stage1Data['Stated Property Value'] && stage1Data.propertyValue) {
      stage1Data['Stated Property Value'] = stage1Data.propertyValue;
    }

    // Auto-populate structure type from Stage 1 selection
    if (stage1Data.structureType && !stage1Data['Subject Property - Structure Type']) {
      const structureMap: Record<string, string> = {
        'SFR': 'Single Family',
        'Condo': 'Condo',
        'Townhouse': 'Townhouse',
        'Multi-Family': 'Multi-Family',
        'PUD': 'Single Family', // PUD mapped to Single Family
      };
      stage1Data['Subject Property - Structure Type'] = structureMap[stage1Data.structureType] || '';
    }
    // Auto-populate unit number and unit count from Stage 1
    if (stage1Data.unitNumber && !stage1Data['Subject Property - Unit Number']) {
      stage1Data['Subject Property - Unit Number'] = stage1Data.unitNumber;
    }
    if (stage1Data.numberOfUnits && !stage1Data['Subject Property - Units']) {
      stage1Data['Subject Property - Units'] = stage1Data.numberOfUnits;
    }

    // Merge with any saved progress from localStorage
    const savedData = localStorage.getItem('stage2-progress');
    const localData = savedData ? { ...stage1Data, ...JSON.parse(savedData) } : stage1Data;
    setFormData(localData);

    // Try to load GHL prefill from localStorage (set by verify page)
    try {
      const stage2Prefill = localStorage.getItem('stage2Prefill');
      if (stage2Prefill) {
        const ghlData = JSON.parse(stage2Prefill);
        setFormData(prev => {
          const merged = { ...ghlData, ...prev };
          // For empty fields, prefer GHL data
          for (const [key, value] of Object.entries(ghlData)) {
            if (!prev[key] || prev[key] === '' || prev[key] === undefined) {
              merged[key] = value as any;
            }
          }
          return merged;
        });
        localStorage.removeItem('stage2Prefill'); // consume once
      }
    } catch { /* No prefill data available */ }

    // Fallback: try API directly (if authenticated but no localStorage prefill)
    fetch('/api/auth/prefill')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.found && data.stage2Fields) {
          setFormData(prev => {
            const merged = { ...data.stage2Fields, ...prev };
            for (const [key, value] of Object.entries(data.stage2Fields)) {
              if (!prev[key] || prev[key] === '' || prev[key] === undefined) {
                merged[key] = value as any;
              }
            }
            return merged;
          });
        }
      })
      .catch(() => { /* Not authenticated or GHL unavailable */ });
  }, []);

  // Auto-save progress to localStorage (debounced)
  const saveTimerRef = useRef<NodeJS.Timeout>(undefined);
  useEffect(() => {
    if (Object.keys(formData).length > 0) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem('stage2-progress', JSON.stringify(formData));
      }, 1500);
      return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }
  }, [formData]);

  const updateField = useCallback((name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const { trackStep } = useStepTracker('stage2');

  const rules = visibilityRules.rules as VisibilityRule[];
  const isVisible = (fieldName: string) => isFieldVisible(fieldName, formData, rules);

  // Helper: check employment status (now single-select string)
  const hasEmploymentType = (person: string, type: string) => {
    const status = formData[`${person} - Employment Status`];
    // Handle legacy array values from old submissions
    if (Array.isArray(status)) return status.includes(type);
    return status === type;
  };
  const hasAnyEmployment = (person: string) => {
    const status = formData[`${person} - Employment Status`];
    if (Array.isArray(status)) return status.length > 0;
    return !!status;
  };
  const hasVariableIncome = (person: string, type: string) => {
    const types = formData[`${person} - Variable Income Types`];
    return Array.isArray(types) ? types.includes(type) : types === type;
  };

  // Section definitions for completion tracking
  const sections = {
    loanDetails: [
      { name: 'product', required: true },
      { name: 'propertyType', required: true },
      { name: 'propertyAddress', required: true },
      { name: 'propertyValue', required: true },
    ],
    borrowerInfo: [
      { name: 'Borrower - First Name', required: true },
      { name: 'Borrower - Last Name', required: true },
      { name: 'Borrower - Phone', required: true },
      { name: 'Borrower - Email', required: true },
      // DOB and SSN collected post-submission during credit validation
      { name: 'Borrower - Citizenship Status', required: true },
      { name: 'Borrower - Has Co-Borrower', required: true }
    ],
    currentResidence: [
      { name: 'Borrower - Housing Ownership Type', required: true },
      { name: 'Borrower - Current Address', required: true },
      { name: 'Borrower - Years in Current Home', required: true },
      { name: 'Borrower - Months in Current Home', required: true }
    ],
    subjectProperty: [
      { name: 'Subject Property - Occupancy', required: true },
      { name: 'Subject Property - Units', required: true },
      { name: 'Subject Property - Structure Type', required: true },
      { name: 'Stated Property Value', required: true },
      { name: 'Listed For Sale (Last 6 Months)', required: true }
    ],
    title: [
      { name: 'Title - Current Title Held As', required: true },
      { name: 'Title - Will Be Held As', required: true }
    ],
    currentLoan: [
      { name: 'Current Loan - Free & Clear', required: true },
      // Conditional: if not free & clear
      ...(formData['Current Loan - Free & Clear'] === 'No' ? [
        { name: 'Current Loan - First Mortgage Balance', required: true },
        { name: 'Current Loan - Monthly Payment', required: true },
      ] : []),
    ],
    otherProperties: [
      { name: 'Owns Other Properties', required: true },
      ...(formData['Owns Other Properties'] === 'Yes' ? [
        { name: 'Number of Other Properties', required: true },
        // Dynamic REO fields based on count
        ...Array.from({ length: Math.min(Number(formData['Number of Other Properties']) || 0, 5) }, (_, i) => {
          const n = i + 1;
          return [
            { name: `Other Properties - Address ${n}`, required: true },
            { name: `Other Properties - Address ${n} Escrow`, required: true },
            ...(formData[`Other Properties - Address ${n} Escrow`] === 'No' ? [
              { name: `Other Properties - ${n} Taxes - Monthly`, required: true },
              { name: `Other Properties - ${n} Insurance - Monthly`, required: true },
            ] : []),
            { name: `Other Properties - Address ${n} HOA`, required: true },
            ...(formData[`Other Properties - Address ${n} HOA`] === 'Yes' ? [
              { name: `Other Properties - ${n} HOA Amount`, required: true },
            ] : []),
          ];
        }).flat(),
      ] : []),
    ],
    employmentIncome: [
      { name: 'Borrower - Employment Status', required: true },
      // Conditional: if employed, require employer info
      ...(formData['Borrower - Employment Status'] === 'Employed' || formData['Borrower - Employment Status'] === 'Self-Employed' ? [
        { name: 'Borrower - Employer Name', required: true },
        { name: 'Borrower - Job Title', required: true },
        { name: 'Borrower - Years at Employer', required: true },
        { name: 'Borrower - Base Income - Monthly', required: true },
      ] : []),
      // Conditional: if overtime selected, require OT amount
      ...(formData['Borrower - Variable Income Types']?.includes?.('Overtime') || formData['Borrower - Variable Income Types'] === 'Overtime' ? [
        { name: 'Borrower - Overtime Monthly Income', required: true },
      ] : []),
    ],
    assets: [
      { name: 'Assets - Account Type', required: true },
      { name: 'Assets - Checking/Savings Total', required: true },
      { name: 'Assets - Retirement Total', required: true }
    ],
    declarations: [
      { name: 'Dec - Judgments / Federal Debt / Delinquent', required: true },
      { name: 'Dec - Bankruptcy / Short Sale / Foreclosure', required: true },
      { name: 'Dec - Borrower Co-Signer on Note', required: true },
      { name: 'Dec - Borrower Obligated Alimony/Support', required: true },
    ],
    demographics: [
      { name: 'Dem - Borrower Ethnicity', required: false }
    ]
  };

  const isSectionCompleted = (sectionFields: { name: string; required?: boolean }[]) =>
    isSectionComplete(sectionFields, formData, rules);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitResult(null);

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitResult({ success: false, message: data.error || 'Submission failed. Please try again.' });
        setSubmitting(false);
        return;
      }

      setSubmitResult({ success: true, message: data.message || 'Application submitted successfully!' });
      // Clear saved progress
      // TODO: RE-ENABLE BEFORE LAUNCH - Temporarily disabled for testing
      // localStorage.removeItem('stage2-progress');
      // localStorage.removeItem('stage1-data');
    } catch {
      setSubmitResult({ success: false, message: 'Network error. Please check your connection and try again.' });
    }
    setSubmitting(false);
  };

  const handleBackToResults = () => {
    // Stage 1 data lives in localStorage - results page reads from there
    router.push('/quote/stage1/results');
  };

  // Step navigation
  const [currentStep, setCurrentStep] = useState(0);

  const sectionOrder = [
    { key: 'loanDetails', title: 'Loan Details' },
    { key: 'borrowerInfo', title: 'Borrower Information' },
    { key: 'currentResidence', title: 'Current Residence' },
    { key: 'subjectProperty', title: 'Subject Property' },
    { key: 'title', title: 'Title & Vesting' },
    { key: 'currentLoan', title: 'Current Loan & Liens' },
    { key: 'otherProperties', title: 'Other Properties' },
    { key: 'employmentIncome', title: 'Employment & Income' },
    { key: 'assets', title: 'Assets' },
    { key: 'declarations', title: 'Declarations' },
    { key: 'demographics', title: 'Demographics' },
  ];

  const totalSteps = sectionOrder.length;
  const currentSectionKey = sectionOrder[currentStep]?.key || 'borrowerInfo';
  const progress = ((currentStep + 1) / (totalSteps + 1)) * 100;

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const goNext = () => {
    // Validate required fields in current section before advancing
    const currentFields = sections[currentSectionKey as keyof typeof sections];
    if (currentFields) {
      const missing = currentFields
        .filter((f: { name: string; required?: boolean }) => f.required && (formData[f.name] === undefined || formData[f.name] === null || formData[f.name] === ''))
        .map((f: { name: string; required?: boolean }) => f.name);
      if (missing.length > 0) {
        setValidationErrors(missing);
        // Scroll to top to show error message
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    setValidationErrors([]);

    // Track step completion to Supabase (async, non-blocking)
    trackStep(currentSectionKey, currentStep, totalSteps, formData);

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goBack = () => {
    setValidationErrors([]);
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleBackToResults();
    }
  };

  // ─── Employment & Income Section (per person) ───
  const renderEmploymentFields = (person: 'Borrower' | 'Co-Borrower') => {
    const empStatus = formData[`${person} - Employment Status`];
    const isEmployed = empStatus === 'Employed';
    const isSelfEmployed = empStatus === 'Self-Employed';
    const isRetired = empStatus === 'Retired';
    const isNotEmployed = empStatus === 'Not Employed';
    const showEmployerFields = isEmployed || isSelfEmployed;
    const additionalJobs = Number(formData[`${person} - Additional Jobs`]) || 0;
    const youOrCb = person === 'Borrower' ? 'Your' : "Co-Borrower's";

    // Render fields for a single job (primary or additional)
    const renderJob = (jobIndex: number) => {
      const suffix = jobIndex === 0 ? '' : ` - Job ${jobIndex + 1}`;
      const prefix = `${person}${suffix}`;
      const jobEmpType = jobIndex === 0 ? empStatus : (formData[`${prefix} - Employment Type`] || '');
      const jobIsSE = jobIndex === 0 ? isSelfEmployed : jobEmpType === 'Self-Employed';
      const jobLabel = jobIndex === 0 ? '' : `Job ${jobIndex + 1}: `;

      return (
        <React.Fragment key={`job-${person}-${jobIndex}`}>
          {/* Job header */}
          {jobIndex > 0 && (
            <div className="md:col-span-2 border-t-2 border-blue-200 pt-4 mt-4 flex items-center justify-between">
              <h4 className="font-semibold text-blue-700">Additional Income Source {jobIndex}</h4>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => {
                    const next = { ...prev };
                    // Remove this job's fields
                    Object.keys(next).forEach(k => { if (k.startsWith(prefix)) delete next[k]; });
                    next[`${person} - Additional Jobs`] = Math.max(0, (Number(next[`${person} - Additional Jobs`]) || 0) - 1);
                    return next;
                  });
                }}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                ✕ Remove
              </button>
            </div>
          )}

          {/* Employment Type per job (primary uses the main selector, additional gets its own) */}
          {jobIndex > 0 && (
            <SelectField
              label="Employment Type"
              name={`${prefix} - Employment Type`}
              value={formData[`${prefix} - Employment Type`]}
              onChange={updateField}
              required
              options={[
                { value: 'Employed', label: 'Employed (W-2)' },
                { value: 'Self-Employed', label: 'Self-Employed' },
                { value: 'Alimony/Child Support', label: 'Alimony / Child Support' },
              ]}
              className="md:col-span-2"
            />
          )}

          {/* Alimony/Child Support - just show amount */}
          {jobIndex > 0 && jobEmpType === 'Alimony/Child Support' && (
            <AnnualMonthlyField
              label="Alimony / Child Support Received"
              namePrefix={`${prefix} - Alimony Income`}
              formData={formData}
              onChange={updateField}
              required
            />
          )}

          {/* Regular job fields (W-2 or Self-Employed) */}
          {(jobIndex === 0 || (jobEmpType && jobEmpType !== 'Alimony/Child Support')) && jobEmpType !== 'Alimony/Child Support' && (
            <>
              {jobIndex === 0 && (
                <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                  <h4 className="font-semibold text-gray-700 mb-1">
                    {isSelfEmployed ? 'Business Details' : 'Employer Details'}
                  </h4>
                </div>
              )}
              <TextField label={jobIsSE ? `${jobLabel}Business Name` : `${jobLabel}Employer Name`} name={`${prefix} - Employer Name`} value={formData[`${prefix} - Employer Name`]} onChange={updateField} required />
              <TextField label={`${jobLabel}Job Title / Position`} name={`${prefix} - Job Title`} value={formData[`${prefix} - Job Title`]} onChange={updateField} required />
              <NumberField label="Years at Employer" name={`${prefix} - Years at Employer`} value={formData[`${prefix} - Years at Employer`]} onChange={updateField} required min={0} max={99} />
              <NumberField label="Months at Employer" name={`${prefix} - Months at Employer`} value={formData[`${prefix} - Months at Employer`]} onChange={updateField} required min={0} max={11} />
              {jobIndex === 0 && (
                <NumberField label="Years in Line of Work" name={`${person} - Years in Line of Work`} value={formData[`${person} - Years in Line of Work`]} onChange={updateField} required min={0} max={99} />
              )}

              {jobIsSE && (
                <RadioField
                  label="Own 25% or more of the business?"
                  name={`${prefix} - Self-Employed 25%+ Ownership`}
                  value={formData[`${prefix} - Self-Employed 25%+ Ownership`]}
                  onChange={updateField}
                  required inline
                  options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                />
              )}

              <SelectField
                label="Pay Type" name={`${prefix} - Pay Type`}
                value={formData[`${prefix} - Pay Type`]} onChange={updateField} required
                options={[{ value: 'Salary', label: 'Salary' }, { value: 'Hourly', label: 'Hourly' }]}
              />

              {formData[`${prefix} - Pay Type`] === 'Hourly' && (
                <CurrencyField label="Hourly Rate" name={`${prefix} - Hourly Rate`} value={formData[`${prefix} - Hourly Rate`]} onChange={updateField} required placeholder="Per hour" />
              )}

              <AnnualMonthlyField
                label={jobIsSE ? 'Net Business Income' : 'Base Income'}
                namePrefix={jobIsSE ? `${prefix} - Self-Employed Income` : `${prefix} - Base Income`}
                formData={formData}
                onChange={updateField}
                required
              />
            </>
          )}
        </React.Fragment>
      );
    };

    return (
      <>
        <SelectField
          label={`${youOrCb} Employment Type`}
          name={`${person} - Employment Status`}
          value={formData[`${person} - Employment Status`]}
          onChange={updateField}
          required
          options={[
            { value: 'Employed', label: 'Employed (W-2)' },
            { value: 'Self-Employed', label: 'Self-Employed' },
            { value: 'Retired', label: 'Retired' },
            { value: 'Not Employed', label: 'Not Currently Employed' }
          ]}
          className="md:col-span-2"
        />

        {/* ── Primary Job ── */}
        {showEmployerFields && renderJob(0)}

        {/* ── Additional Jobs ── */}
        {showEmployerFields && Array.from({ length: additionalJobs }, (_, i) => renderJob(i + 1))}

        {/* Add Additional Income - prominent button */}
        {showEmployerFields && (
          <div className="md:col-span-2 pt-3">
            <button
              type="button"
              onClick={() => updateField(`${person} - Additional Jobs`, additionalJobs + 1)}
              className="w-full py-3 px-4 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 hover:bg-blue-50 hover:border-blue-400 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Additional Income Source
            </button>
            <p className="text-xs text-gray-500 text-center mt-1">Second job, self-employment, alimony/child support received</p>
          </div>
        )}

        {/* Variable Income (only for primary job) */}
        {showEmployerFields && (
          <>
            <CheckboxGroupField
              label="Additional Income Types"
              name={`${person} - Variable Income Types`}
              value={formData[`${person} - Variable Income Types`]}
              onChange={updateField}
              inline
              options={[
                { value: 'Overtime', label: 'Overtime' },
                { value: 'Commission', label: 'Commission' },
                { value: 'Bonus', label: 'Bonus' },
                { value: 'Other', label: 'Other' }
              ]}
              className="md:col-span-2"
            />

            {hasVariableIncome(person, 'Overtime') && (
              <CurrencyField label="Overtime Monthly Income" name={`${person} - Overtime Monthly Income`} value={formData[`${person} - Overtime Monthly Income`]} onChange={updateField} required />
            )}
            {hasVariableIncome(person, 'Commission') && (
              <CurrencyField label="Commission Monthly Income" name={`${person} - Commission Monthly Income`} value={formData[`${person} - Commission Monthly Income`]} onChange={updateField} required />
            )}
            {hasVariableIncome(person, 'Bonus') && (
              <CurrencyField label="Bonus Monthly Income" name={`${person} - Bonus Monthly Income`} value={formData[`${person} - Bonus Monthly Income`]} onChange={updateField} required />
            )}
            {hasVariableIncome(person, 'Other') && (
              <CurrencyField label="Other Monthly Income" name={`${person} - Other Monthly Income`} value={formData[`${person} - Other Monthly Income`]} onChange={updateField} required />
            )}
          </>
        )}

        {/* Previous Employers - chain until cumulative >= 2 years */}
        {showEmployerFields && (() => {
          if (formData[`${person} - Years at Employer`] === undefined || formData[`${person} - Years at Employer`] === '') return null;
          const currentYrs = Number(formData[`${person} - Years at Employer`]) || 0;
          const currentMos = Number(formData[`${person} - Months at Employer`]) || 0;
          let cumulative = currentYrs + currentMos / 12;
          const jobs = [];
          
          for (let i = 1; i <= 4 && cumulative < 2; i++) {
            const suffix = i === 1 ? '' : ` ${i}`;
            const nameKey = `${person} - Previous Employer Name${suffix}`;
            const posKey = `${person} - Previous Employer Position${suffix}`;
            const yrsKey = `${person} - Years at Previous Employer${suffix}`;
            const mosKey = `${person} - Months at Previous Employer${suffix}`;
            
            jobs.push(
              <React.Fragment key={`prev-job-${i}`}>
                <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                  <h4 className="font-semibold text-gray-700 mb-1">Previous Employer {i > 1 ? i : ''}</h4>
                  <p className="text-sm text-gray-500 mb-3">Need 2 years of employment history</p>
                </div>
                <TextField label="Employer Name" name={nameKey} value={formData[nameKey]} onChange={updateField} required />
                <TextField label="Position" name={posKey} value={formData[posKey]} onChange={updateField} required />
                <NumberField label="Years" name={yrsKey} value={formData[yrsKey]} onChange={updateField} required min={0} max={99} />
                <NumberField label="Months" name={mosKey} value={formData[mosKey]} onChange={updateField} required min={0} max={11} />
              </React.Fragment>
            );
            
            const prevYrs = Number(formData[yrsKey]) || 0;
            const prevMos = Number(formData[mosKey]) || 0;
            cumulative += prevYrs + prevMos / 12;
            if (!formData[yrsKey] && formData[yrsKey] !== 0) break;
          }
          
          return jobs;
        })()}

        {/* ── Retired / Not Employed: Other Income ── */}
        {(isRetired || isNotEmployed) && !showEmployerFields && (
          <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
            <h4 className="font-semibold text-gray-700 mb-1">Income Sources</h4>
            <p className="text-sm text-gray-500 mb-3">{isRetired ? 'Retirement income, pensions, Social Security, etc.' : 'Any current income sources'}</p>
          </div>
        )}

        {/* Other Income chain */}
        {(isRetired || isNotEmployed || showEmployerFields) && (
          <>
            {showEmployerFields && (
              <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                <h4 className="font-semibold text-gray-700 mb-1">Other Income Sources</h4>
                <p className="text-sm text-gray-500 mb-3">Social Security, pension, rental income, etc. (optional for employed)</p>
              </div>
            )}
            <SelectField label="Other Income 1 Type" name={`${person} - Other Income 1 Type`} value={formData[`${person} - Other Income 1 Type`]} onChange={updateField} options={OTHER_INCOME_TYPES} required={isRetired || isNotEmployed} />
            {formData[`${person} - Other Income 1 Type`] && (
              <>
                <CurrencyField label="Other Income 1 Amount (Monthly)" name={`${person} - Other Income 1 Amount`} value={formData[`${person} - Other Income 1 Amount`]} onChange={updateField} required />
                <SelectField label="Other Income 2 Type" name={`${person} - Other Income 2 Type`} value={formData[`${person} - Other Income 2 Type`]} onChange={updateField} options={OTHER_INCOME_TYPES} />
              </>
            )}
            {formData[`${person} - Other Income 2 Type`] && (
              <>
                <CurrencyField label="Other Income 2 Amount (Monthly)" name={`${person} - Other Income 2 Amount`} value={formData[`${person} - Other Income 2 Amount`]} onChange={updateField} required />
                <SelectField label="Other Income 3 Type" name={`${person} - Other Income 3 Type`} value={formData[`${person} - Other Income 3 Type`]} onChange={updateField} options={OTHER_INCOME_TYPES} />
              </>
            )}
            {formData[`${person} - Other Income 3 Type`] && (
              <CurrencyField label="Other Income 3 Amount (Monthly)" name={`${person} - Other Income 3 Amount`} value={formData[`${person} - Other Income 3 Amount`]} onChange={updateField} required />
            )}
          </>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4">

        <div className="grid lg:grid-cols-3 lg:gap-8 gap-6">
          <div className="lg:col-span-2">

            {/* Header */}
            <div className="mb-8">
              <button onClick={handleBackToResults} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Results
              </button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Application</h1>
              <p className="text-gray-600">100% automated - no phone calls unless you want them.</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{sectionOrder[currentStep]?.title}</span>
                <span className="text-sm text-gray-500">Step {currentStep + 1} of {totalSteps}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }} />
              </div>
            </div>

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-semibold text-red-700 mb-1">Please complete the required fields:</p>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {validationErrors.map((field) => (
                    <li key={field}>{field.replace(/^(Borrower - |Subject Property - |Title - |Current Loan - |Dec - |Assets - )/, '')}</li>
                  ))}
                </ul>
              </div>
            )}

            <form autoComplete="on" onSubmit={(e) => e.preventDefault()}>

            {/* ═══════════════════════════════════════════════
                LOAN DETAILS (Stage 1 Summary)
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'loanDetails' && (
            <SectionCard title="Loan Details" description="Confirm or update your selections" isComplete={!!formData['product'] && !!formData['propertyAddress']} defaultOpen={true} sectionNumber={1}>
              <SelectField
                label="Product" name="product" value={formData['product']} onChange={updateField} required
                options={[
                  { value: 'HELOC', label: 'HELOC' },
                  { value: 'CES', label: 'Closed-End Second' },
                  { value: 'CashOut', label: 'Cash-Out Refinance' },
                  { value: 'NoCashRefi', label: 'Rate/Term Refinance' }
                ]}
              />
              <SelectField
                label="Property Type" name="propertyType" value={formData['propertyType']} onChange={updateField} required
                options={[
                  { value: 'Primary', label: 'Primary Residence' },
                  { value: 'Investment', label: 'Investment Property' },
                  { value: '2nd Home', label: 'Second Home' }
                ]}
              />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Address <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={formData['propertyAddress'] || ''}
                  onChange={(e) => updateField('propertyAddress', e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>
              <CurrencyField label="Property Value" name="propertyValue" value={formData['propertyValue']} onChange={updateField} required />
              <CurrencyField label="Current Loan Balance" name="loanBalance" value={formData['loanBalance']} onChange={updateField} required />
              {(formData['product'] === 'HELOC') && (
                <>
                  <SelectField
                    label="Total Term" name="helocTotalTerm" value={formData['helocTotalTerm'] || '20'} onChange={updateField}
                    options={[{ value: '20', label: '20 Years' }, { value: '30', label: '30 Years' }]}
                  />
                  <SelectField
                    label="Draw Period" name="helocDrawTerm" value={formData['helocDrawTerm'] || '5'} onChange={updateField}
                    options={[{ value: '3', label: '3 Years' }, { value: '5', label: '5 Years' }, { value: '10', label: '10 Years' }]}
                  />
                </>
              )}
              {(formData['product'] === 'CES') && (
                <SelectField
                  label="Term" name="cesTerm" value={formData['cesTerm'] || '20'} onChange={updateField}
                  options={[{ value: '20', label: '20 Years' }, { value: '30', label: '30 Years' }]}
                />
              )}
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                BORROWER INFORMATION
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'borrowerInfo' && (
            <SectionCard title="Borrower Information" description="Your personal details" isComplete={isSectionCompleted(sections.borrowerInfo)} defaultOpen={true} sectionNumber={currentStep + 1}>
              <TextField label="First Name" name="Borrower - First Name" value={formData['Borrower - First Name']} onChange={updateField} required autoComplete="given-name" />
              <TextField label="Last Name" name="Borrower - Last Name" value={formData['Borrower - Last Name']} onChange={updateField} required autoComplete="family-name" />
              <PhoneField label="Phone" name="Borrower - Phone" value={formData['Borrower - Phone']} onChange={updateField} required />
              <TextField type="email" label="Email" name="Borrower - Email" value={formData['Borrower - Email']} onChange={updateField} required autoComplete="email" />
              {/* DOB and SSN moved to post-submission credit validation section */}
              <SelectField
                label="Citizenship Status" name="Borrower - Citizenship Status" value={formData['Borrower - Citizenship Status']} onChange={updateField} required
                options={[
                  { value: 'US Citizen', label: 'U.S. Citizen' },
                  { value: 'Permanent Resident', label: 'Permanent Resident Alien' },
                  { value: 'Non-Permanent Resident', label: 'Non-Permanent Resident Alien' }
                ]}
              />
              <NumberField label="Number of Dependents" name="Number of Dependents" value={formData['Number of Dependents']} onChange={updateField} min={0} max={20} />
              {Number(formData['Number of Dependents']) > 0 && (
                <TextField label="Ages of Dependents" name="Ages of Dependents" value={formData['Ages of Dependents']} onChange={updateField} placeholder="e.g. 5, 8, 12" />
              )}
              <RadioField
                label="Do you have a co-borrower?" name="Borrower - Has Co-Borrower" value={formData['Borrower - Has Co-Borrower']} onChange={updateField} required inline
                options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
              />
              {formData['Borrower - Has Co-Borrower'] === 'Yes' && (
                <>
                  <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                    <h4 className="font-semibold text-gray-700 mb-3">Co-Borrower Details</h4>
                  </div>
                  <TextField label="Co-Borrower First Name" name="Co-Borrower - First Name" value={formData['Co-Borrower - First Name']} onChange={updateField} required />
                  <TextField label="Co-Borrower Last Name" name="Co-Borrower - Last Name" value={formData['Co-Borrower - Last Name']} onChange={updateField} required />
                  <PhoneField label="Co-Borrower Phone" name="Co-Borrower - Phone" value={formData['Co-Borrower - Phone']} onChange={updateField} required />
                  <TextField type="email" label="Co-Borrower Email" name="Co-Borrower - Email" value={formData['Co-Borrower - Email']} onChange={updateField} required />
                  <SelectField
                    label="Co-Borrower Citizenship Status" name="Co-Borrower - Citizenship Status" value={formData['Co-Borrower - Citizenship Status']} onChange={updateField} required
                    options={[
                      { value: 'US Citizen', label: 'U.S. Citizen' },
                      { value: 'Permanent Resident', label: 'Permanent Resident Alien' },
                      { value: 'Non-Permanent Resident', label: 'Non-Permanent Resident Alien' }
                    ]}
                  />
                </>
              )}
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                CURRENT RESIDENCE - Google Address Picker
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'currentResidence' && (
            <SectionCard title="Current Residence" description="Where you live now" isComplete={isSectionCompleted(sections.currentResidence)} defaultOpen={true} sectionNumber={currentStep + 1}>
              <SelectField
                label="Housing Type" name="Borrower - Housing Ownership Type" value={formData['Borrower - Housing Ownership Type']} onChange={updateField} required
                options={[
                  { value: 'Own', label: 'Own' },
                  { value: 'Rent', label: 'Rent' },
                  { value: 'Living Rent Free', label: 'Living Rent Free' }
                ]}
              />
              {formData['Borrower - Housing Ownership Type'] === 'Rent' && (
                <CurrencyField label="Monthly Rent" name="Current Loan - Rent" value={formData['Current Loan - Rent']} onChange={updateField} required placeholder="Monthly rent payment" />
              )}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Address <span className="text-red-500 ml-1">*</span>
                </label>
                <AddressAutocomplete
                  value={formData['Borrower - Current Address'] || ''}
                  onChange={(address) => updateField('Borrower - Current Address', address)}
                  placeholder="Start typing your address..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <NumberField label="Years at Address" name="Borrower - Years in Current Home" value={formData['Borrower - Years in Current Home']} onChange={updateField} required min={0} max={99} />
              <NumberField label="Months at Address" name="Borrower - Months in Current Home" value={formData['Borrower - Months in Current Home']} onChange={updateField} required min={0} max={11} />

              {/* Prior Addresses - chain until cumulative >= 2 years */}
              {(() => {
                const currentYrs = Number(formData['Borrower - Years in Current Home']) || 0;
                const currentMos = Number(formData['Borrower - Months in Current Home']) || 0;
                if (formData['Borrower - Years in Current Home'] === undefined || formData['Borrower - Years in Current Home'] === '') return null;
                
                const priorAddresses = [];
                let cumulative = currentYrs + currentMos / 12;
                
                for (let i = 1; i <= 4 && cumulative < 2; i++) {
                  const suffix = i === 1 ? '' : ` ${i}`;
                  const yrsKey = i === 1 ? 'Borrower - Years at Prior Address' : `Borrower - Years at Prior Address ${i}`;
                  const mosKey = i === 1 ? 'Borrower - Months at Prior Address' : `Borrower - Months at Prior Address ${i}`;
                  const addrKey = i === 1 ? 'Borrower - Prior Address' : `Borrower - Prior Address ${i}`;
                  const housingKey = i === 1 ? 'Borrower - Prior Housing Ownership Type' : `Borrower - Prior Housing Ownership Type ${i}`;
                  
                  priorAddresses.push(
                    <div key={`prior-addr-${i}`}>
                      <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                        <h4 className="font-semibold text-gray-700 mb-1">Prior Address {i > 1 ? i : ''}</h4>
                        <p className="text-sm text-gray-500 mb-3">Required - need 2 years of address history</p>
                      </div>
                      <SelectField
                        label="Housing Type" name={housingKey} value={formData[housingKey]} onChange={updateField} required
                        options={[
                          { value: 'Own', label: 'Own' },
                          { value: 'Rent', label: 'Rent' },
                          { value: 'Living Rent Free', label: 'Living Rent Free' }
                        ]}
                      />
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Address <span className="text-red-500 ml-1">*</span></label>
                        <AddressAutocomplete
                          value={formData[addrKey] || ''}
                          onChange={(address) => updateField(addrKey, address)}
                          placeholder="Start typing address..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <NumberField label="Years" name={yrsKey} value={formData[yrsKey]} onChange={updateField} required min={0} max={99} />
                      <NumberField label="Months" name={mosKey} value={formData[mosKey]} onChange={updateField} required min={0} max={11} />
                    </div>
                  );
                  
                  const priorYrs = Number(formData[yrsKey]) || 0;
                  const priorMos = Number(formData[mosKey]) || 0;
                  cumulative += priorYrs + priorMos / 12;
                  
                  // Only show next if this one has data
                  if (!formData[yrsKey] && formData[yrsKey] !== 0) break;
                }
                
                return priorAddresses;
              })()}
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                SUBJECT PROPERTY - Dynamic based on property type
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'subjectProperty' && (
            <SectionCard title="Subject Property" description="The property you're financing" isComplete={isSectionCompleted(sections.subjectProperty)} defaultOpen={true} sectionNumber={currentStep + 1}>
              {/* Show address from Stage 1 - greyed out for primary, editable for investment/2nd home */}
              {isPrimary ? (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject Property Address</label>
                  <div className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600">
                    {stage1Address || 'Address from previous step'}
                  </div>
                  <p className="text-sm text-blue-600 mt-1">✓ Subject property is your primary residence</p>
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Property Address <span className="text-red-500 ml-1">*</span>
                  </label>
                  <AddressAutocomplete
                    value={formData['Subject Property - Address'] || stage1Address || ''}
                    onChange={(address) => updateField('Subject Property - Address', address)}
                    placeholder="Enter the subject property address..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {stage1PropertyType === 'Investment' ? 'Investment property' : 'Second home'}
                  </p>
                </div>
              )}

              <SelectField
                label="Occupancy" name="Subject Property - Occupancy" value={formData['Subject Property - Occupancy'] || (isPrimary ? 'Primary Residence' : stage1PropertyType === 'Investment' ? 'Investment Property' : 'Second Home')} onChange={updateField} required
                options={[
                  { value: 'Primary Residence', label: 'Primary Residence' },
                  { value: 'Second Home', label: 'Second Home' },
                  { value: 'Investment Property', label: 'Investment Property' }
                ]}
              />
              <NumberField label="Number of Units" name="Subject Property - Units" value={formData['Subject Property - Units']} onChange={updateField} required min={1} max={4} />
              <SelectField
                label="Structure Type" name="Subject Property - Structure Type" value={formData['Subject Property - Structure Type']} onChange={updateField} required
                options={[
                  { value: 'Single Family', label: 'Single Family' },
                  { value: 'Condo', label: 'Condo' },
                  { value: 'Townhouse', label: 'Townhouse' },
                  { value: 'Multi-Family', label: 'Multi-Family' }
                ]}
              />
              {formData['Subject Property - Structure Type'] === 'Condo' && (
                <TextField label="Unit #" name="Subject Property - Unit Number" value={formData['Subject Property - Unit Number']} onChange={updateField} required />
              )}
              <CurrencyField label="Stated Property Value" name="Stated Property Value" value={formData['Stated Property Value'] || stage1PropertyValue} onChange={updateField} required />
              <RadioField
                label="Listed for sale in last 6 months?" name="Listed For Sale (Last 6 Months)" value={formData['Listed For Sale (Last 6 Months)']} onChange={updateField} required inline
                options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
              />
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                TITLE & VESTING
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'title' && (
            <SectionCard title="Title & Vesting" description="How the property is owned" isComplete={isSectionCompleted(sections.title)} defaultOpen={true} sectionNumber={currentStep + 1}>
              <SelectField
                label="Current Title Held As" name="Title - Current Title Held As" value={formData['Title - Current Title Held As']} onChange={updateField} required
                options={[
                  { value: 'Sole Ownership', label: 'Sole Ownership' },
                  { value: 'Joint Tenants', label: 'Joint Tenants' },
                  { value: 'Tenants in Common', label: 'Tenants in Common' },
                  { value: 'Community Property', label: 'Community Property' }
                ]}
              />
              <SelectField
                label="Title Will Be Held As" name="Title - Will Be Held As" value={formData['Title - Will Be Held As']} onChange={updateField} required
                options={[
                  { value: 'Sole Ownership', label: 'Sole Ownership' },
                  { value: 'Joint Tenants', label: 'Joint Tenants' },
                  { value: 'Tenants in Common', label: 'Tenants in Common' },
                  { value: 'Community Property', label: 'Community Property' }
                ]}
              />
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                CURRENT LOAN & LIENS - Data carries over from Stage 1
                PMI/Escrow use inline 2-column layout
                Term/Type/RateType only for CashOut/NoCashRefi
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'currentLoan' && (
            <SectionCard title="Current Loan Details" description="Your existing mortgage (if any)" isComplete={isSectionCompleted(sections.currentLoan)} defaultOpen={true} sectionNumber={currentStep + 1}>
              <RadioField
                label="Is the property free & clear?" name="Current Loan - Free & Clear"
                value={formData['Current Loan - Free & Clear']} onChange={updateField} required inline
                options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                className="md:col-span-2"
              />

              {formData['Current Loan - Free & Clear'] === 'No' && (
                <>
                  <CurrencyField label="First Mortgage Balance" name="Current Loan - First Mortgage Balance" value={formData['Current Loan - First Mortgage Balance']} onChange={updateField} required />
                  <CurrencyField label="Monthly Payment" name="Current Loan - Monthly Payment" value={formData['Current Loan - Monthly Payment']} onChange={updateField} required />
                  <NumberField label="Interest Rate (%)" name="Current Loan - Interest Rate (%)" value={formData['Current Loan - Interest Rate (%)']} onChange={updateField} step={0.001} placeholder="7.250" />

                  {/* Only show term, type, rate type for first lien products */}
                  {isFirstLienProduct && (
                    <>
                      <SelectField
                        label="Loan Type" name="Current Loan - Type" value={formData['Current Loan - Type']} onChange={updateField}
                        options={[
                          { value: 'Conventional', label: 'Conventional' },
                          { value: 'FHA', label: 'FHA' },
                          { value: 'VA', label: 'VA' },
                          { value: 'USDA', label: 'USDA' }
                        ]}
                      />
                      <NumberField label="Term (Months)" name="Current Loan - Term (Months)" value={formData['Current Loan - Term (Months)']} onChange={updateField} placeholder="360" />
                      <SelectField
                        label="Rate Type" name="Current Loan - Rate Type" value={formData['Current Loan - Rate Type']} onChange={updateField}
                        options={[
                          { value: 'Fixed', label: 'Fixed' },
                          { value: 'ARM', label: 'Adjustable (ARM)' }
                        ]}
                      />
                    </>
                  )}

                  {/* PMI - Yes/No in col1, amount in col2 (same row) */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <RadioField
                      label="Mortgage Insurance (PMI)?" name="Current Loan - Mortgage Insurance Present"
                      value={formData['Current Loan - Mortgage Insurance Present']} onChange={updateField} inline
                      options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                    />
                    {formData['Current Loan - Mortgage Insurance Present'] === 'Yes' && (
                      <CurrencyField label="Monthly PMI Amount" name="Current Loan - PMI Amount" value={formData['Current Loan - PMI Amount']} onChange={updateField} required placeholder="Monthly MI" />
                    )}
                  </div>

                  {/* Escrow - Yes/No in col1, if No -> taxes col1 + insurance col2 on next row */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <RadioField
                      label="Taxes & Insurance Escrowed?" name="Current Loan - Escrowed"
                      value={formData['Current Loan - Escrowed']} onChange={updateField} inline
                      options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                    />
                  </div>
                  {formData['Current Loan - Escrowed'] === 'No' && (
                    <>
                      <AnnualMonthlyField label="Property Taxes" namePrefix="Current Loan - Taxes" formData={formData} onChange={updateField} required />
                      <AnnualMonthlyField label="Homeowners Insurance" namePrefix="Current Loan - HOI" formData={formData} onChange={updateField} required />
                    </>
                  )}

                  {/* HOA - Yes/No in col1, amount in col2 */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <RadioField
                      label="HOA Dues?" name="Current Loan - Pay HOA"
                      value={formData['Current Loan - Pay HOA']} onChange={updateField} inline
                      options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                    />
                    {formData['Current Loan - Pay HOA'] === 'Yes' && (
                      <CurrencyField label="Monthly HOA Dues" name="Current Loan - HOA Dues" value={formData['Current Loan - HOA Dues']} onChange={updateField} required />
                    )}
                  </div>

                  {/* Second Mortgage */}
                  <RadioField
                    label="Second Mortgage Present?" name="Second Mortgage - Present"
                    value={formData['Second Mortgage - Present']} onChange={updateField} inline
                    options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                    className="md:col-span-2"
                  />
                  {formData['Second Mortgage - Present'] === 'Yes' && (
                    <>
                      <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                        <h4 className="font-semibold text-gray-700 mb-3">Second Mortgage Details</h4>
                      </div>
                      <CurrencyField label="Balance" name="Second Mortgage - Balance" value={formData['Second Mortgage - Balance']} onChange={updateField} required />
                      <CurrencyField label="Monthly Payment" name="Second Mortgage - Monthly Payment" value={formData['Second Mortgage - Monthly Payment']} onChange={updateField} required />
                      <SelectField
                        label="Loan Type" name="Second Mortgage - Type" value={formData['Second Mortgage - Type']} onChange={updateField} required
                        options={[
                          { value: 'HELOC', label: 'HELOC' },
                          { value: 'Home Equity Loan', label: 'Home Equity Loan (Closed-End)' }
                        ]}
                      />
                      <NumberField label="Interest Rate (%)" name="Second Mortgage - Interest Rate (%)" value={formData['Second Mortgage - Interest Rate (%)']} onChange={updateField} required step={0.001} placeholder="8.500" />
                    </>
                  )}
                </>
              )}
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                OTHER PROPERTIES
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'otherProperties' && (
            <SectionCard title="Other Properties" description="Additional real estate you own" isComplete={isSectionCompleted(sections.otherProperties)} defaultOpen={true} sectionNumber={currentStep + 1}>
              <RadioField
                label="Do you own other properties?" name="Owns Other Properties" value={formData['Owns Other Properties']} onChange={updateField} required inline
                options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                className="md:col-span-2"
              />
              {formData['Owns Other Properties'] === 'Yes' && (
                <>
                  <NumberField label="How many other properties?" name="Number of Other Properties" value={formData['Number of Other Properties']} onChange={updateField} min={1} max={5} required />
                  {Array.from({ length: Math.min(Number(formData['Number of Other Properties']) || 0, 5) }, (_, i) => {
                    const n = i + 1;
                    const escrowKey = `Other Properties - Address ${n} Escrow`;
                    const hoaKey = `Other Properties - Address ${n} HOA`;
                    return (
                      <div key={`prop-${n}`} className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                        <h4 className="font-semibold text-gray-700 mb-3">Property {n}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Address <span className="text-red-500">*</span></label>
                            <AddressAutocomplete
                              value={formData[`Other Properties - Address ${n}`] || ''}
                              onChange={(address) => updateField(`Other Properties - Address ${n}`, address)}
                              placeholder="Property address..."
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>

                          {/* Escrow question */}
                          <RadioField
                            label="Do you escrow taxes and homeowner's insurance in the mortgage?"
                            name={escrowKey}
                            value={formData[escrowKey]}
                            onChange={updateField} required inline
                            options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                            className="md:col-span-2"
                          />

                          {/* If not escrowed, show taxes and insurance */}
                          {formData[escrowKey] === 'No' && (
                            <AnnualMonthlyField label={`Property ${n} Taxes`} namePrefix={`Other Properties - ${n} Taxes`} formData={formData} onChange={updateField} required />
                          )}
                          {formData[escrowKey] === 'No' && (
                            <AnnualMonthlyField label={`Property ${n} Insurance`} namePrefix={`Other Properties - ${n} Insurance`} formData={formData} onChange={updateField} required />
                          )}

                          {/* HOA */}
                          <RadioField
                            label="Do you pay HOA?"
                            name={hoaKey}
                            value={formData[hoaKey]}
                            onChange={updateField} required inline
                            options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
                          />
                          {formData[hoaKey] === 'Yes' && (
                            <CurrencyField label="Monthly HOA Dues" name={`Other Properties - ${n} HOA Amount`} value={formData[`Other Properties - ${n} HOA Amount`]} onChange={updateField} required />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                EMPLOYMENT & INCOME - Full GHL fields with checkboxes
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'employmentIncome' && (
            <SectionCard title="Employment & Income" description="Your income sources" isComplete={isSectionCompleted(sections.employmentIncome)} defaultOpen={true} sectionNumber={currentStep + 1}>
              {renderEmploymentFields('Borrower')}

              {/* Co-Borrower Employment (if applicable) */}
              {formData['Borrower - Has Co-Borrower'] === 'Yes' && (
                <>
                  <div className="md:col-span-2 border-t-2 border-blue-200 pt-6 mt-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Co-Borrower Employment & Income</h3>
                  </div>
                  {renderEmploymentFields('Co-Borrower')}
                </>
              )}
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                ASSETS
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'assets' && (
            <SectionCard title="Assets" description="Your financial accounts" isComplete={isSectionCompleted(sections.assets)} defaultOpen={true} sectionNumber={currentStep + 1}>
              <SelectField
                label="Primary Account Type" name="Assets - Account Type" value={formData['Assets - Account Type']} onChange={updateField} required
                options={[
                  { value: 'Checking', label: 'Checking' },
                  { value: 'Savings', label: 'Savings' },
                  { value: 'Both', label: 'Both Checking & Savings' }
                ]}
              />
              <CurrencyField label="Total Checking/Savings" name="Assets - Checking/Savings Total" value={formData['Assets - Checking/Savings Total']} onChange={updateField} required />
              <CurrencyField label="Total Retirement Accounts" name="Assets - Retirement Total" value={formData['Assets - Retirement Total']} onChange={updateField} required />
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                DECLARATIONS
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'declarations' && (
            <SectionCard title="Declarations" description="Required disclosure questions" isComplete={isSectionCompleted(sections.declarations)} defaultOpen={true} sectionNumber={currentStep + 1}>
              {/* 1003 Section V declarations */}
              <RadioField label="Outstanding judgments, federal debt, delinquent accounts, or party to a lawsuit?" name="Dec - Judgments / Federal Debt / Delinquent" value={formData['Dec - Judgments / Federal Debt / Delinquent']} onChange={updateField} required inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} className="md:col-span-2" />
              {formData['Dec - Judgments / Federal Debt / Delinquent'] === 'Yes' && (
                <>
                  <RadioField label="Outstanding judgments?" name="Dec - Borrower Outstanding Judgments" value={formData['Dec - Borrower Outstanding Judgments']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                  <RadioField label="Delinquent/default on federal debt?" name="Dec - Borrower Delinquent/Default Federal Debt" value={formData['Dec - Borrower Delinquent/Default Federal Debt']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                  <RadioField label="Party to a lawsuit?" name="Dec - Borrower Party to Lawsuit" value={formData['Dec - Borrower Party to Lawsuit']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                </>
              )}

              <RadioField label="Bankruptcy, short sale, or foreclosure in last 7 years?" name="Dec - Bankruptcy / Short Sale / Foreclosure" value={formData['Dec - Bankruptcy / Short Sale / Foreclosure']} onChange={updateField} required inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} className="md:col-span-2" />
              {formData['Dec - Bankruptcy / Short Sale / Foreclosure'] === 'Yes' && (
                <>
                  <RadioField label="Bankruptcy in last 7 years?" name="Dec - Borrower Bankruptcy (Last 7 Years)" value={formData['Dec - Borrower Bankruptcy (Last 7 Years)']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                  {formData['Dec - Borrower Bankruptcy (Last 7 Years)'] === 'Yes' && (
                    <SelectField label="Bankruptcy Type" name="Dec - Borrower Bankruptcy Type" value={formData['Dec - Borrower Bankruptcy Type']} onChange={updateField} options={[{ value: 'Chapter 7', label: 'Chapter 7' }, { value: 'Chapter 11', label: 'Chapter 11' }, { value: 'Chapter 13', label: 'Chapter 13' }]} />
                  )}
                  <RadioField label="Short sale or pre-foreclosure?" name="Dec - Borrower Short Sale / Pre-Foreclosure" value={formData['Dec - Borrower Short Sale / Pre-Foreclosure']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                  <RadioField label="Deed in lieu?" name="Dec - Borrower Deed in Lieu (Last 7 Years)" value={formData['Dec - Borrower Deed in Lieu (Last 7 Years)']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                  <RadioField label="Property foreclosure?" name="Dec - Borrower Property Foreclosure" value={formData['Dec - Borrower Property Foreclosure']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                </>
              )}

              {/* Additional 1003 declarations */}
              <RadioField label="Are you a co-signer or endorser on any note?" name="Dec - Borrower Co-Signer on Note" value={formData['Dec - Borrower Co-Signer on Note']} onChange={updateField} required inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} className="md:col-span-2" />

              <RadioField label="Are you obligated to pay alimony, child support, or separate maintenance?" name="Dec - Borrower Obligated Alimony/Support" value={formData['Dec - Borrower Obligated Alimony/Support']} onChange={updateField} required inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} className="md:col-span-2" />
              {formData['Dec - Borrower Obligated Alimony/Support'] === 'Yes' && (
                <CurrencyField label="Monthly Alimony/Child Support/Maintenance Amount" name="Dec - Borrower Alimony/Support Amount" value={formData['Dec - Borrower Alimony/Support Amount']} onChange={updateField} required />
              )}

              {/* Co-Borrower Declarations */}
              {formData['Borrower - Has Co-Borrower'] === 'Yes' && (
                <>
                  <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                    <RadioField
                      label="Same declarations for Co-Borrower?" name="Dec - Same for Co-Borrower"
                      value={formData['Dec - Same for Co-Borrower']} onChange={updateField} inline
                      options={[{ value: 'Yes', label: 'Yes, same answers' }, { value: 'No', label: 'No, different' }]}
                    />
                  </div>
                  {formData['Dec - Same for Co-Borrower'] === 'No' && (
                    <>
                      <RadioField label="Co-Borrower: Outstanding judgments, federal debt, delinquent accounts, or party to a lawsuit?" name="Dec - Co-Borrower Judgments / Federal Debt / Delinquent" value={formData['Dec - Co-Borrower Judgments / Federal Debt / Delinquent']} onChange={updateField} required inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} className="md:col-span-2" />
                      {formData['Dec - Co-Borrower Judgments / Federal Debt / Delinquent'] === 'Yes' && (
                        <>
                          <RadioField label="Co-Borrower: Outstanding judgments?" name="Dec - Co-Borrower Outstanding Judgments" value={formData['Dec - Co-Borrower Outstanding Judgments']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                          <RadioField label="Co-Borrower: Delinquent/default on federal debt?" name="Dec - Co-Borrower Delinquent/Default Federal Debt" value={formData['Dec - Co-Borrower Delinquent/Default Federal Debt']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                          <RadioField label="Co-Borrower: Party to a lawsuit?" name="Dec - Co-Borrower Party to Lawsuit" value={formData['Dec - Co-Borrower Party to Lawsuit']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                        </>
                      )}

                      <RadioField label="Co-Borrower: Bankruptcy, short sale, or foreclosure in last 7 years?" name="Dec - Co-Borrower Bankruptcy / Short Sale / Foreclosure" value={formData['Dec - Co-Borrower Bankruptcy / Short Sale / Foreclosure']} onChange={updateField} required inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} className="md:col-span-2" />
                      {formData['Dec - Co-Borrower Bankruptcy / Short Sale / Foreclosure'] === 'Yes' && (
                        <>
                          <RadioField label="Co-Borrower: Bankruptcy in last 7 years?" name="Dec - Co-Borrower Bankruptcy (Last 7 Years)" value={formData['Dec - Co-Borrower Bankruptcy (Last 7 Years)']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                          {formData['Dec - Co-Borrower Bankruptcy (Last 7 Years)'] === 'Yes' && (
                            <SelectField label="Co-Borrower Bankruptcy Type" name="Dec - Co-Borrower Bankruptcy Type" value={formData['Dec - Co-Borrower Bankruptcy Type']} onChange={updateField} options={[{ value: 'Chapter 7', label: 'Chapter 7' }, { value: 'Chapter 11', label: 'Chapter 11' }, { value: 'Chapter 13', label: 'Chapter 13' }]} />
                          )}
                          <RadioField label="Co-Borrower: Short sale or pre-foreclosure?" name="Dec - Co-Borrower Short Sale / Pre-Foreclosure" value={formData['Dec - Co-Borrower Short Sale / Pre-Foreclosure']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                          <RadioField label="Co-Borrower: Deed in lieu?" name="Dec - Co-Borrower Deed in Lieu" value={formData['Dec - Co-Borrower Deed in Lieu']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                          <RadioField label="Co-Borrower: Property foreclosure?" name="Dec - Co-Borrower Property Foreclosure" value={formData['Dec - Co-Borrower Property Foreclosure']} onChange={updateField} inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} />
                        </>
                      )}

                      <RadioField label="Co-Borrower: Obligated to pay alimony, child support, or separate maintenance?" name="Dec - Co-Borrower Obligated Alimony/Support" value={formData['Dec - Co-Borrower Obligated Alimony/Support']} onChange={updateField} required inline options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} className="md:col-span-2" />
                      {formData['Dec - Co-Borrower Obligated Alimony/Support'] === 'Yes' && (
                        <CurrencyField label="Co-Borrower Monthly Alimony/Support Amount" name="Dec - Co-Borrower Alimony/Support Amount" value={formData['Dec - Co-Borrower Alimony/Support Amount']} onChange={updateField} required />
                      )}
                    </>
                  )}
                </>
              )}
            </SectionCard>
            )}

            {/* ═══════════════════════════════════════════════
                DEMOGRAPHICS
            ═══════════════════════════════════════════════ */}
            {currentSectionKey === 'demographics' && (
            <SectionCard title="Demographics" description="Optional - for government monitoring purposes" isComplete={isSectionCompleted(sections.demographics)} defaultOpen={true} sectionNumber={currentStep + 1}>
              <SelectField label="Ethnicity (Optional)" name="Dem - Borrower Ethnicity" value={formData['Dem - Borrower Ethnicity']} onChange={updateField}
                options={[
                  { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
                  { value: 'Not Hispanic or Latino', label: 'Not Hispanic or Latino' },
                  { value: 'I do not wish to provide', label: 'I do not wish to provide' }
                ]}
              />
              {formData['Dem - Borrower Ethnicity'] === 'Hispanic or Latino' && (
                <SelectField label="Ethnicity Detail (Optional)" name="Dem - Borrower Ethnicity Detail" value={formData['Dem - Borrower Ethnicity Detail']} onChange={updateField}
                  options={[
                    { value: 'Mexican', label: 'Mexican' },
                    { value: 'Puerto Rican', label: 'Puerto Rican' },
                    { value: 'Cuban', label: 'Cuban' },
                    { value: 'Other Hispanic or Latino', label: 'Other Hispanic or Latino' }
                  ]}
                />
              )}
              <SelectField label="Sex (Optional)" name="Dem - Borrower Sex" value={formData['Dem - Borrower Sex']} onChange={updateField}
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'I do not wish to provide', label: 'I do not wish to provide' }
                ]}
              />
              <RaceField prefix="Dem - Borrower " formData={formData} onChange={updateField} />

              {/* Co-Borrower Demographics */}
              {formData['Borrower - Has Co-Borrower'] === 'Yes' && (
                <>
                  <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                    <h4 className="font-semibold text-gray-700 mb-3">Co-Borrower Demographics</h4>
                  </div>
                  <SelectField label="Co-Borrower Ethnicity (Optional)" name="Dem - Co-Borrower Ethnicity" value={formData['Dem - Co-Borrower Ethnicity']} onChange={updateField}
                    options={[
                      { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
                      { value: 'Not Hispanic or Latino', label: 'Not Hispanic or Latino' },
                      { value: 'I do not wish to provide', label: 'I do not wish to provide' }
                    ]}
                  />
                  {formData['Dem - Co-Borrower Ethnicity'] === 'Hispanic or Latino' && (
                    <SelectField label="Co-Borrower Ethnicity Detail (Optional)" name="Dem - Co-Borrower Ethnicity Detail" value={formData['Dem - Co-Borrower Ethnicity Detail']} onChange={updateField}
                      options={[
                        { value: 'Mexican', label: 'Mexican' },
                        { value: 'Puerto Rican', label: 'Puerto Rican' },
                        { value: 'Cuban', label: 'Cuban' },
                        { value: 'Other Hispanic or Latino', label: 'Other Hispanic or Latino' }
                      ]}
                    />
                  )}
                  <SelectField label="Co-Borrower Sex (Optional)" name="Dem - Co-Borrower Sex" value={formData['Dem - Co-Borrower Sex']} onChange={updateField}
                    options={[
                      { value: 'Male', label: 'Male' },
                      { value: 'Female', label: 'Female' },
                      { value: 'I do not wish to provide', label: 'I do not wish to provide' }
                    ]}
                  />
                  <RaceField prefix="Dem - Co-Borrower " formData={formData} onChange={updateField} />
                </>
              )}
            </SectionCard>
            )}

            </form>

            {/* Navigation Buttons */}
            <div className="mt-6 flex items-center justify-between gap-4">
              <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium py-3 px-6 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {currentStep < totalSteps - 1 ? (
                <button onClick={goNext} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all text-center">
                  Continue
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || submitResult?.success}
                  className={`flex-1 font-semibold py-3 px-6 rounded-xl shadow-lg transition-all text-center ${
                    submitResult?.success
                      ? 'bg-green-500 text-white cursor-default'
                      : submitting
                      ? 'bg-gray-400 text-white cursor-wait'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white hover:shadow-xl'
                  }`}
                >
                  {submitResult?.success ? '✓ Submitted' : submitting ? 'Submitting...' : 'Get Access: Next Step — Validation'}
                </button>
              )}

              {submitResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  submitResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {submitResult.message}
                </div>
              )}
            </div>

            <div className="text-center mt-4">
              <a href="tel:1-888-885-7789" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Need help? Call 1-888-885-7789
              </a>
            </div>

          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <QuoteBuilder
              maxAvailable={Number(formData['propertyValue']) || 0}
              rateRange={{ min: 7.5, max: 8.0 }}
              monthlyPayment={1200}
              progress={progress}
              stage="stage2"
            />
          </div>
        </div>

      </div>
    </div>
  );
}

export default function Stage2() {
  return <Stage2Content />;
}
