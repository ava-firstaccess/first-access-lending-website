// Stage 2: Full 1003 Application Form
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SectionCard from '@/components/quote/SectionCard';
import QuoteBuilder from '@/components/quote/QuoteBuilder';
import {
  TextField,
  DateField,
  CurrencyField,
  NumberField,
  SelectField,
  RadioField,
  TextareaField,
  SSNField
} from '@/components/quote/FormField';
import { isFieldVisible, isSectionComplete, VisibilityRule } from '@/components/quote/ConditionalEngine';
import visibilityRules from '@/data/dynamic_form_rules.json';

interface FormData {
  [key: string]: any;
}

function Stage2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<FormData>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load Stage 1 data from URL params or localStorage
  useEffect(() => {
    const stage1Data: FormData = {};
    searchParams.forEach((value, key) => {
      stage1Data[key] = value;
    });
    
    // Merge with any saved progress from localStorage
    const savedData = localStorage.getItem('stage2-progress');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setFormData({ ...stage1Data, ...parsed });
    } else {
      setFormData(stage1Data);
    }
  }, [searchParams]);

  // Auto-save progress to localStorage
  useEffect(() => {
    if (Object.keys(formData).length > 0) {
      const timer = setTimeout(() => {
        localStorage.setItem('stage2-progress', JSON.stringify(formData));
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [formData]);

  const updateField = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const rules = visibilityRules.rules as VisibilityRule[];

  // Field visibility helper
  const isVisible = (fieldName: string) => isFieldVisible(fieldName, formData, rules);

  // Section completion helpers
  const sections = {
    borrowerInfo: [
      { name: 'Borrower - First Name', required: true },
      { name: 'Borrower - Last Name', required: true },
      { name: 'Borrower - Phone', required: true },
      { name: 'Borrower - Email', required: true },
      { name: 'Borrower - Date of Birth', required: true },
      { name: 'Borrower - SSN', required: true },
      { name: 'Borrower - Citizenship Status', required: true },
      { name: 'Borrower - Has Co-Borrower', required: true }
    ],
    coBorrower: [
      { name: 'Co-Borrower - First Name', required: true },
      { name: 'Co-Borrower - Last Name', required: true },
      { name: 'Co-Borrower - Phone', required: true },
      { name: 'Co-Borrower - Email', required: true },
      { name: 'Co-Borrower - Employment Status', required: true }
    ],
    currentResidence: [
      { name: 'Borrower - Housing Ownership Type', required: true },
      { name: 'Borrower - Current Address Line 1', required: true },
      { name: 'Borrower - Current Address City', required: true },
      { name: 'Borrower - Current Address State', required: true },
      { name: 'Borrower - Current Address Zip', required: true },
      { name: 'Borrower - Years in Current Home', required: true },
      { name: 'Borrower - Months in Current Home', required: true }
    ],
    subjectProperty: [
      { name: 'Present Address Same as Subject Property', required: true },
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
      { name: 'Current Loan - First Mortgage Balance', required: false },
      { name: 'Current Loan - Monthly Payment', required: false },
      { name: 'Current Loan - Type', required: false },
      { name: 'Current Loan - Term (Months)', required: false },
      { name: 'Current Loan - Interest Rate (%)', required: false },
      { name: 'Current Loan - Rate Type', required: false },
      { name: 'Current Loan - Mortgage Insurance Present', required: false },
      { name: 'Current Loan - Escrowed', required: false },
      { name: 'Current Loan - Pay HOA', required: false },
      { name: 'Second Mortgage - Present', required: false }
    ],
    secondMortgage: [
      { name: 'Second Mortgage - Balance', required: true },
      { name: 'Second Mortgage - Monthly Payment', required: true },
      { name: 'Second Mortgage - Type', required: true },
      { name: 'Second Mortgage - Interest Rate (%)', required: true }
    ],
    otherProperties: [
      { name: 'Owns Other Properties', required: true },
      { name: 'Number of Other Properties', required: false },
      { name: 'Other Properties - Notes', required: false }
    ],
    employmentIncome: [
      { name: 'Borrower - Employment Status', required: true },
      { name: 'Borrower - Base Monthly Income', required: false }
    ],
    assets: [
      { name: 'Assets - Account Type', required: true },
      { name: 'Assets - Checking/Savings Total', required: true },
      { name: 'Assets - Retirement Total', required: true },
      { name: 'Assets - Cash Left Over', required: false }
    ],
    declarations: [
      { name: 'Dec - Judgments / Federal Debt / Delinquent', required: true },
      { name: 'Dec - Bankruptcy / Short Sale / Foreclosure', required: true },
      { name: 'Dec - Ownership Interest Last 3 Years', required: true },
      { name: 'Dec - Primary Residence Last 3 Years', required: true },
      { name: 'Dec - Family/Business Relationship', required: true }
    ],
    demographics: [
      { name: 'Dem - Borrower Ethnicity', required: false },
      { name: 'Dem - Borrower Sex', required: false },
      { name: 'Dem - Borrower Race', required: false }
    ]
  };

  const isSectionCompleted = (sectionFields: { name: string; required?: boolean }[]) =>
    isSectionComplete(sectionFields, formData, rules);

  const handleSubmit = async () => {
    // TODO: Submit to API
    console.log('Submitting form data:', formData);
    alert('Form submitted! (API integration pending)');
  };

  const handleBackToResults = () => {
    router.push('/quote/stage1/results?' + searchParams.toString());
  };

  // Calculate progress (percentage of completed sections)
  const completedSections = Object.values(sections).filter(fields => isSectionCompleted(fields)).length;
  const totalSections = Object.keys(sections).length;
  const progress = (completedSections / totalSections) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 py-8">
      <div className="container mx-auto px-4">
        
        {/* Desktop: Two Column Layout */}
        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={handleBackToResults}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Results
              </button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Application</h1>
              <p className="text-gray-600">Fill out the sections below to finalize your loan application.</p>
              {isSaving && (
                <p className="text-sm text-green-600 mt-2">✓ Progress saved</p>
              )}
            </div>

            {/* Exit Ramp */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700">
                <strong>Need help?</strong> Call us at{' '}
                <a href="tel:1-888-885-7789" className="text-blue-600 hover:text-blue-700 font-semibold">
                  1-888-885-7789
                </a>
              </p>
            </div>

            {/* Sections */}
            
            {/* 1. Borrower Info */}
            <SectionCard
              title="Borrower Information"
              description="Your personal details"
              isComplete={isSectionCompleted(sections.borrowerInfo)}
              defaultOpen={!isSectionCompleted(sections.borrowerInfo)}
              sectionNumber={1}
            >
              <TextField label="First Name" name="Borrower - First Name" value={formData['Borrower - First Name']} onChange={updateField} required />
              <TextField label="Last Name" name="Borrower - Last Name" value={formData['Borrower - Last Name']} onChange={updateField} required />
              <TextField type="tel" label="Phone" name="Borrower - Phone" value={formData['Borrower - Phone']} onChange={updateField} required placeholder="(555) 123-4567" />
              <TextField type="email" label="Email" name="Borrower - Email" value={formData['Borrower - Email']} onChange={updateField} required />
              <DateField label="Date of Birth" name="Borrower - Date of Birth" value={formData['Borrower - Date of Birth']} onChange={updateField} required />
              <SSNField label="Social Security Number" name="Borrower - SSN" value={formData['Borrower - SSN']} onChange={updateField} required />
              <SelectField
                label="Citizenship Status"
                name="Borrower - Citizenship Status"
                value={formData['Borrower - Citizenship Status']}
                onChange={updateField}
                required
                options={[
                  { value: 'US Citizen', label: 'U.S. Citizen' },
                  { value: 'Permanent Resident', label: 'Permanent Resident Alien' },
                  { value: 'Non-Permanent Resident', label: 'Non-Permanent Resident Alien' }
                ]}
              />
              <RadioField
                label="Do you have a co-borrower?"
                name="Borrower - Has Co-Borrower"
                value={formData['Borrower - Has Co-Borrower']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
              />
            </SectionCard>

            {/* 2. Co-Borrower (conditional) */}
            {isVisible('Co-Borrower - First Name') && (
              <SectionCard
                title="Co-Borrower Information"
                description="Co-borrower personal details"
                isComplete={isSectionCompleted(sections.coBorrower)}
                defaultOpen={!isSectionCompleted(sections.coBorrower)}
                sectionNumber={2}
              >
                <TextField label="First Name" name="Co-Borrower - First Name" value={formData['Co-Borrower - First Name']} onChange={updateField} required />
                <TextField label="Last Name" name="Co-Borrower - Last Name" value={formData['Co-Borrower - Last Name']} onChange={updateField} required />
                <TextField type="tel" label="Phone" name="Co-Borrower - Phone" value={formData['Co-Borrower - Phone']} onChange={updateField} required placeholder="(555) 123-4567" />
                <TextField type="email" label="Email" name="Co-Borrower - Email" value={formData['Co-Borrower - Email']} onChange={updateField} required />
                <SelectField
                  label="Employment Status"
                  name="Co-Borrower - Employment Status"
                  value={formData['Co-Borrower - Employment Status']}
                  onChange={updateField}
                  required
                  options={[
                    { value: 'Employed', label: 'Employed' },
                    { value: 'Self-Employed', label: 'Self-Employed' },
                    { value: 'Retired', label: 'Retired' },
                    { value: 'Not Employed', label: 'Not Employed' }
                  ]}
                />
              </SectionCard>
            )}

            {/* 3. Current Residence */}
            <SectionCard
              title="Current Residence"
              description="Where you live now"
              isComplete={isSectionCompleted(sections.currentResidence)}
              defaultOpen={false}
              sectionNumber={3}
            >
              <SelectField
                label="Housing Type"
                name="Borrower - Housing Ownership Type"
                value={formData['Borrower - Housing Ownership Type']}
                onChange={updateField}
                required
                options={[
                  { value: 'Own', label: 'Own' },
                  { value: 'Rent', label: 'Rent' },
                  { value: 'Living Rent Free', label: 'Living Rent Free' }
                ]}
              />
              <TextField label="Street Address" name="Borrower - Current Address Line 1" value={formData['Borrower - Current Address Line 1']} onChange={updateField} required className="md:col-span-2" />
              <TextField label="City" name="Borrower - Current Address City" value={formData['Borrower - Current Address City']} onChange={updateField} required />
              <SelectField
                label="State"
                name="Borrower - Current Address State"
                value={formData['Borrower - Current Address State']}
                onChange={updateField}
                required
                options={[
                  { value: 'CA', label: 'California' },
                  { value: 'NY', label: 'New York' },
                  { value: 'TX', label: 'Texas' },
                  { value: 'FL', label: 'Florida' }
                  // Add all states
                ]}
              />
              <TextField label="Zip Code" name="Borrower - Current Address Zip" value={formData['Borrower - Current Address Zip']} onChange={updateField} required />
              <NumberField label="Years at Address" name="Borrower - Years in Current Home" value={formData['Borrower - Years in Current Home']} onChange={updateField} required min={0} max={99} />
              <NumberField label="Months at Address" name="Borrower - Months in Current Home" value={formData['Borrower - Months in Current Home']} onChange={updateField} required min={0} max={11} />
            </SectionCard>

            {/* 4. Subject Property */}
            <SectionCard
              title="Subject Property"
              description="The property you're financing"
              isComplete={isSectionCompleted(sections.subjectProperty)}
              defaultOpen={false}
              sectionNumber={4}
            >
              <RadioField
                label="Is this the same as your current address?"
                name="Present Address Same as Subject Property"
                value={formData['Present Address Same as Subject Property']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
              <SelectField
                label="Occupancy"
                name="Subject Property - Occupancy"
                value={formData['Subject Property - Occupancy']}
                onChange={updateField}
                required
                options={[
                  { value: 'Primary Residence', label: 'Primary Residence' },
                  { value: 'Second Home', label: 'Second Home' },
                  { value: 'Investment Property', label: 'Investment Property' }
                ]}
              />
              <NumberField label="Number of Units" name="Subject Property - Units" value={formData['Subject Property - Units']} onChange={updateField} required min={1} max={4} />
              <SelectField
                label="Structure Type"
                name="Subject Property - Structure Type"
                value={formData['Subject Property - Structure Type']}
                onChange={updateField}
                required
                options={[
                  { value: 'Single Family', label: 'Single Family' },
                  { value: 'Condo', label: 'Condo' },
                  { value: 'Townhouse', label: 'Townhouse' },
                  { value: 'Multi-Family', label: 'Multi-Family' }
                ]}
              />
              <CurrencyField label="Stated Property Value" name="Stated Property Value" value={formData['Stated Property Value']} onChange={updateField} required />
              <RadioField
                label="Listed for sale in last 6 months?"
                name="Listed For Sale (Last 6 Months)"
                value={formData['Listed For Sale (Last 6 Months)']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
              />
            </SectionCard>

            {/* 5. Title */}
            <SectionCard
              title="Title & Vesting"
              description="How the property is owned"
              isComplete={isSectionCompleted(sections.title)}
              defaultOpen={false}
              sectionNumber={5}
            >
              <SelectField
                label="Current Title Held As"
                name="Title - Current Title Held As"
                value={formData['Title - Current Title Held As']}
                onChange={updateField}
                required
                options={[
                  { value: 'Sole Ownership', label: 'Sole Ownership' },
                  { value: 'Joint Tenants', label: 'Joint Tenants' },
                  { value: 'Tenants in Common', label: 'Tenants in Common' },
                  { value: 'Community Property', label: 'Community Property' }
                ]}
              />
              <SelectField
                label="Title Will Be Held As"
                name="Title - Will Be Held As"
                value={formData['Title - Will Be Held As']}
                onChange={updateField}
                required
                options={[
                  { value: 'Sole Ownership', label: 'Sole Ownership' },
                  { value: 'Joint Tenants', label: 'Joint Tenants' },
                  { value: 'Tenants in Common', label: 'Tenants in Common' },
                  { value: 'Community Property', label: 'Community Property' }
                ]}
              />
            </SectionCard>

            {/* 6. Current Loan */}
            <SectionCard
              title="Current Loan Details"
              description="Your existing mortgage (if any)"
              isComplete={isSectionCompleted(sections.currentLoan)}
              defaultOpen={false}
              sectionNumber={6}
            >
              <RadioField
                label="Is the property free & clear?"
                name="Current Loan - Free & Clear"
                value={formData['Current Loan - Free & Clear']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
              
              {isVisible('Current Loan - First Mortgage Balance') && (
                <>
                  <CurrencyField label="First Mortgage Balance" name="Current Loan - First Mortgage Balance" value={formData['Current Loan - First Mortgage Balance']} onChange={updateField} />
                  <CurrencyField label="Monthly Payment" name="Current Loan - Monthly Payment" value={formData['Current Loan - Monthly Payment']} onChange={updateField} />
                  <SelectField
                    label="Loan Type"
                    name="Current Loan - Type"
                    value={formData['Current Loan - Type']}
                    onChange={updateField}
                    options={[
                      { value: 'Conventional', label: 'Conventional' },
                      { value: 'FHA', label: 'FHA' },
                      { value: 'VA', label: 'VA' },
                      { value: 'USDA', label: 'USDA' }
                    ]}
                  />
                  <NumberField label="Term (Months)" name="Current Loan - Term (Months)" value={formData['Current Loan - Term (Months)']} onChange={updateField} placeholder="360" />
                  <NumberField label="Interest Rate (%)" name="Current Loan - Interest Rate (%)" value={formData['Current Loan - Interest Rate (%)']} onChange={updateField} step={0.001} placeholder="7.250" />
                  <SelectField
                    label="Rate Type"
                    name="Current Loan - Rate Type"
                    value={formData['Current Loan - Rate Type']}
                    onChange={updateField}
                    options={[
                      { value: 'Fixed', label: 'Fixed' },
                      { value: 'ARM', label: 'Adjustable (ARM)' }
                    ]}
                  />
                  <RadioField
                    label="Mortgage Insurance Present?"
                    name="Current Loan - Mortgage Insurance Present"
                    value={formData['Current Loan - Mortgage Insurance Present']}
                    onChange={updateField}
                    inline
                    options={[
                      { value: 'Yes', label: 'Yes' },
                      { value: 'No', label: 'No' }
                    ]}
                  />
                  <RadioField
                    label="Taxes & Insurance Escrowed?"
                    name="Current Loan - Escrowed"
                    value={formData['Current Loan - Escrowed']}
                    onChange={updateField}
                    inline
                    options={[
                      { value: 'Yes', label: 'Yes' },
                      { value: 'No', label: 'No' }
                    ]}
                  />
                  <RadioField
                    label="HOA Dues?"
                    name="Current Loan - Pay HOA"
                    value={formData['Current Loan - Pay HOA']}
                    onChange={updateField}
                    inline
                    options={[
                      { value: 'Yes', label: 'Yes' },
                      { value: 'No', label: 'No' }
                    ]}
                  />
                  {isVisible('Current Loan - HOA Dues') && (
                    <CurrencyField label="Monthly HOA Dues" name="Current Loan - HOA Dues" value={formData['Current Loan - HOA Dues']} onChange={updateField} />
                  )}
                  <RadioField
                    label="Second Mortgage Present?"
                    name="Second Mortgage - Present"
                    value={formData['Second Mortgage - Present']}
                    onChange={updateField}
                    inline
                    options={[
                      { value: 'Yes', label: 'Yes' },
                      { value: 'No', label: 'No' }
                    ]}
                    className="md:col-span-2"
                  />
                </>
              )}
            </SectionCard>

            {/* 7. Second Mortgage (conditional) */}
            {isVisible('Second Mortgage - Balance') && (
              <SectionCard
                title="Second Mortgage"
                description="Details about your second lien"
                isComplete={isSectionCompleted(sections.secondMortgage)}
                defaultOpen={!isSectionCompleted(sections.secondMortgage)}
                sectionNumber={7}
              >
                <CurrencyField label="Balance" name="Second Mortgage - Balance" value={formData['Second Mortgage - Balance']} onChange={updateField} required />
                <CurrencyField label="Monthly Payment" name="Second Mortgage - Monthly Payment" value={formData['Second Mortgage - Monthly Payment']} onChange={updateField} required />
                <SelectField
                  label="Loan Type"
                  name="Second Mortgage - Type"
                  value={formData['Second Mortgage - Type']}
                  onChange={updateField}
                  required
                  options={[
                    { value: 'HELOC', label: 'HELOC' },
                    { value: 'Home Equity Loan', label: 'Home Equity Loan (Closed-End)' }
                  ]}
                />
                <NumberField label="Interest Rate (%)" name="Second Mortgage - Interest Rate (%)" value={formData['Second Mortgage - Interest Rate (%)']} onChange={updateField} required step={0.001} placeholder="8.500" />
              </SectionCard>
            )}

            {/* 8. Other Properties */}
            <SectionCard
              title="Other Properties"
              description="Additional real estate you own"
              isComplete={isSectionCompleted(sections.otherProperties)}
              defaultOpen={false}
              sectionNumber={8}
            >
              <RadioField
                label="Do you own other properties?"
                name="Owns Other Properties"
                value={formData['Owns Other Properties']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
              {formData['Owns Other Properties'] === 'Yes' && (
                <>
                  <NumberField label="Number of Properties" name="Number of Other Properties" value={formData['Number of Other Properties']} onChange={updateField} min={1} max={10} />
                  <TextareaField label="Notes (addresses, values)" name="Other Properties - Notes" value={formData['Other Properties - Notes']} onChange={updateField} className="md:col-span-2" rows={3} />
                </>
              )}
            </SectionCard>

            {/* 9. Employment & Income */}
            <SectionCard
              title="Employment & Income"
              description="Your income sources"
              isComplete={isSectionCompleted(sections.employmentIncome)}
              defaultOpen={false}
              sectionNumber={9}
            >
              <SelectField
                label="Employment Status"
                name="Borrower - Employment Status"
                value={formData['Borrower - Employment Status']}
                onChange={updateField}
                required
                options={[
                  { value: 'Employed', label: 'Employed' },
                  { value: 'Self-Employed', label: 'Self-Employed' },
                  { value: 'Retired', label: 'Retired' },
                  { value: 'Not Employed', label: 'Not Employed' }
                ]}
              />
              <CurrencyField label="Base Monthly Income" name="Borrower - Base Monthly Income" value={formData['Borrower - Base Monthly Income']} onChange={updateField} placeholder="Gross monthly income" />
            </SectionCard>

            {/* 10. Assets */}
            <SectionCard
              title="Assets"
              description="Your financial accounts"
              isComplete={isSectionCompleted(sections.assets)}
              defaultOpen={false}
              sectionNumber={10}
            >
              <SelectField
                label="Primary Account Type"
                name="Assets - Account Type"
                value={formData['Assets - Account Type']}
                onChange={updateField}
                required
                options={[
                  { value: 'Checking', label: 'Checking' },
                  { value: 'Savings', label: 'Savings' },
                  { value: 'Both', label: 'Both Checking & Savings' }
                ]}
              />
              <CurrencyField label="Total Checking/Savings" name="Assets - Checking/Savings Total" value={formData['Assets - Checking/Savings Total']} onChange={updateField} required />
              <CurrencyField label="Total Retirement Accounts" name="Assets - Retirement Total" value={formData['Assets - Retirement Total']} onChange={updateField} required />
              <CurrencyField label="Cash Left After Closing" name="Assets - Cash Left Over" value={formData['Assets - Cash Left Over']} onChange={updateField} placeholder="Reserves" />
            </SectionCard>

            {/* 11. Declarations */}
            <SectionCard
              title="Declarations"
              description="Required disclosure questions"
              isComplete={isSectionCompleted(sections.declarations)}
              defaultOpen={false}
              sectionNumber={11}
            >
              <RadioField
                label="Outstanding judgments, federal debt, or delinquent accounts?"
                name="Dec - Judgments / Federal Debt / Delinquent"
                value={formData['Dec - Judgments / Federal Debt / Delinquent']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
              <RadioField
                label="Bankruptcy, short sale, or foreclosure in last 7 years?"
                name="Dec - Bankruptcy / Short Sale / Foreclosure"
                value={formData['Dec - Bankruptcy / Short Sale / Foreclosure']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
              <RadioField
                label="Ownership interest in another property in last 3 years?"
                name="Dec - Ownership Interest Last 3 Years"
                value={formData['Dec - Ownership Interest Last 3 Years']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
              <RadioField
                label="Primary residence in last 3 years?"
                name="Dec - Primary Residence Last 3 Years"
                value={formData['Dec - Primary Residence Last 3 Years']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
              <RadioField
                label="Family or business relationship with seller?"
                name="Dec - Family/Business Relationship"
                value={formData['Dec - Family/Business Relationship']}
                onChange={updateField}
                required
                inline
                options={[
                  { value: 'Yes', label: 'Yes' },
                  { value: 'No', label: 'No' }
                ]}
                className="md:col-span-2"
              />
            </SectionCard>

            {/* 12. Demographics */}
            <SectionCard
              title="Demographics"
              description="Optional - for government monitoring purposes"
              isComplete={isSectionCompleted(sections.demographics)}
              defaultOpen={false}
              sectionNumber={12}
            >
              <SelectField
                label="Ethnicity (Optional)"
                name="Dem - Borrower Ethnicity"
                value={formData['Dem - Borrower Ethnicity']}
                onChange={updateField}
                options={[
                  { value: 'Hispanic or Latino', label: 'Hispanic or Latino' },
                  { value: 'Not Hispanic or Latino', label: 'Not Hispanic or Latino' },
                  { value: 'I do not wish to provide', label: 'I do not wish to provide this information' }
                ]}
              />
              <SelectField
                label="Sex (Optional)"
                name="Dem - Borrower Sex"
                value={formData['Dem - Borrower Sex']}
                onChange={updateField}
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'I do not wish to provide', label: 'I do not wish to provide this information' }
                ]}
              />
              <SelectField
                label="Race (Optional)"
                name="Dem - Borrower Race"
                value={formData['Dem - Borrower Race']}
                onChange={updateField}
                options={[
                  { value: 'American Indian or Alaska Native', label: 'American Indian or Alaska Native' },
                  { value: 'Asian', label: 'Asian' },
                  { value: 'Black or African American', label: 'Black or African American' },
                  { value: 'Native Hawaiian or Other Pacific Islander', label: 'Native Hawaiian or Other Pacific Islander' },
                  { value: 'White', label: 'White' },
                  { value: 'I do not wish to provide', label: 'I do not wish to provide this information' }
                ]}
              />
            </SectionCard>

            {/* Submit Button */}
            <div className="mt-8 bg-white rounded-xl shadow-md p-6">
              <button
                onClick={handleSubmit}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
              >
                Submit Application
              </button>
              <p className="text-sm text-gray-600 text-center mt-3">
                By submitting, you agree to our terms and authorize a credit check.
              </p>
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

        {/* Mobile: Stacked Layout */}
        <div className="lg:hidden space-y-6">
          {/* Same content as desktop but stacked */}
          <p className="text-sm text-gray-600">Mobile layout: same sections, stacked vertically</p>
        </div>

      </div>
    </div>
  );
}

export default function Stage2() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <Stage2Content />
    </Suspense>
  );
}
