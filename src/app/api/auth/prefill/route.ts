import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApplication } from '@/lib/application-session';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'pqK0BqXrQ5smZEkID6fP';
const GHL_VERSION = '2021-07-28';

// Sensitive fields to NEVER pull from GHL (matched against fieldKey suffix)
const BLOCKED_FIELD_KEYS = new Set([
  'opportunity.borrower__date_of_birth',
  'opportunity.borrower__social_security_number',
  'opportunity.coborrower__date_of_birth',
  'opportunity.coborrower__social_security_number',
]);

async function ghlFetch(path: string, options: RequestInit = {}) {
  const ghlKey = process.env.GHL_API_KEY;
  if (!ghlKey) throw new Error('GHL_API_KEY not configured');

  const res = await fetch(`${GHL_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ghlKey}`,
      'Version': GHL_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`GHL API error ${res.status}:`, text);
    return null;
  }
  return res.json();
}

// Search contact by phone number
async function findContactByPhone(phone: string) {
  // Normalize to +1XXXXXXXXXX for GHL search
  const normalized = phone.replace(/\D/g, '');
  const searchPhone = normalized.length === 10 ? `+1${normalized}` : `+${normalized}`;

  const data = await ghlFetch('/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      page: 1,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: searchPhone }],
    }),
  });
  return data?.contacts?.[0] || null;
}

// Get most recent opportunity for contact
async function getOpportunity(contactId: string) {
  const data = await ghlFetch(
    `/opportunities/search?location_id=${GHL_LOCATION_ID}&contact_id=${contactId}&order=added_desc&page=1&limit=1`
  );
  const oppId = data?.opportunities?.[0]?.id;
  if (!oppId) return null;

  const opp = await ghlFetch(`/opportunities/${oppId}`);
  return opp?.opportunity || opp || null;
}

// Build a lookup from opportunity customFields array: fieldKey -> value
function buildCustomFieldMap(opportunity: any): Record<string, any> {
  const map: Record<string, any> = {};
  if (!opportunity?.customFields) return map;

  const cf = Array.isArray(opportunity.customFields)
    ? opportunity.customFields
    : Object.entries(opportunity.customFields).map(([k, v]) => ({ id: k, value: v }));

  for (const field of cf) {
    const key = field.fieldKey || field.key || field.id || '';
    const value = field.value ?? field.fieldValue;
    if (key && value !== undefined && value !== null && String(value).trim() !== '') {
      if (!BLOCKED_FIELD_KEYS.has(key)) {
        map[key] = value;
      }
    }
  }
  return map;
}

// ── Loan Purpose mapping ──
// GHL "Loan Purpose" values -> our Stage 1 product types
function mapLoanPurpose(ghlValue: string): string | null {
  const v = (ghlValue || '').toLowerCase();
  if (v.includes('heloc')) return 'HELOC';
  if (v.includes('closed') || v.includes('ces') || v.includes('2nd') || v.includes('second')) return 'CES';
  if (v.includes('cash') && v.includes('out')) return 'CashOut';
  if (v.includes('rate') && v.includes('term')) return 'NoCashRefi';
  if (v.includes('refinance') || v.includes('refi')) return 'CashOut'; // default refi = cash-out
  return null;
}

// GHL property type -> Stage 1 property type
function mapPropertyType(ghlValue: string): string | null {
  const v = (ghlValue || '').toLowerCase();
  if (v.includes('primary') || v.includes('owner')) return 'Primary';
  if (v.includes('invest') || v.includes('rental') || v.includes('non-owner')) return 'Investment';
  if (v.includes('second') || v.includes('2nd') || v.includes('vacation')) return '2nd Home';
  return null;
}

// GHL occupancy -> Stage 1 occupancy
function mapOccupancy(ghlValue: string): string | null {
  const v = (ghlValue || '').toLowerCase();
  if (v.includes('owner') || v.includes('primary')) return 'Owner-Occupied';
  if (v.includes('invest') || v.includes('rental') || v.includes('non-owner')) return 'Rental';
  return null;
}

// Parse monetary value (strip $, commas, etc.)
function parseMoney(val: any): number | null {
  if (typeof val === 'number') return val;
  const num = parseFloat(String(val).replace(/[$,\s]/g, ''));
  return isNaN(num) ? null : num;
}

// Parse numeric value
function parseNum(val: any): number | null {
  if (typeof val === 'number') return val;
  const num = parseFloat(String(val).replace(/[,\s]/g, ''));
  return isNaN(num) ? null : num;
}

// ── Extract Stage 1 fields ──
function extractStage1(cfMap: Record<string, any>): Record<string, any> {
  const s1: Record<string, any> = {};

  // Product (loan purpose)
  const loanPurpose = cfMap['opportunity.loan_purpose'];
  if (loanPurpose) {
    const mapped = mapLoanPurpose(loanPurpose);
    if (mapped) s1.product = mapped;
  }

  // Property value (try stated first, then appraised, then purchase price)
  const propVal =
    parseMoney(cfMap['opportunity.stated_property_value']) ??
    parseMoney(cfMap['opportunity.appraised_property_value']) ??
    parseMoney(cfMap['opportunity.subject_property__original_purchase_price']);
  if (propVal) s1.propertyValue = propVal;

  // Loan balance
  const balance = parseMoney(cfMap['opportunity.current_loan__first_mortgage_balance']);
  if (balance) s1.loanBalance = balance;

  // Credit score (Encompass score first, then stated)
  const credit =
    parseNum(cfMap['opportunity.credit_score_encompass']) ??
    parseNum(cfMap['opportunity.lead__stated_credit_score']);
  if (credit && credit >= 300 && credit <= 850) s1.creditScore = credit;

  // Property type
  const pt = cfMap['opportunity.property_type'] || cfMap['opportunity.subject_property__structure_type'];
  if (pt) {
    const mapped = mapPropertyType(pt);
    if (mapped) s1.propertyType = mapped;
  }

  // Occupancy
  const occ = cfMap['opportunity.subject_property__occupancy_use'];
  if (occ) {
    const mapped = mapOccupancy(occ);
    if (mapped) s1.occupancy = mapped;
  }

  return s1;
}

// ── Extract Stage 2 fields ──
// Maps GHL opportunity fieldKey -> Stage 2 form field name
const STAGE2_FIELD_MAP: Record<string, string> = {
  // Borrower info
  'opportunity.borrower__citizenship_status': 'Borrower - Citizenship Status',
  'opportunity.number_of_dependents': 'Number of Dependents',
  'opportunity.borrower__housing_ownership_type': 'Borrower - Housing Ownership Type',
  'opportunity.borrower__primary_address_line_1': 'Borrower - Primary Street Address',
  'opportunity.borrower__primary_address_city': 'Borrower - Primary Address City',
  'opportunity.borrower__primary_address_state': 'Borrower - Primary Address State',
  'opportunity.borrower__primary_address_zip': 'Borrower - Primary Address Zip',
  'opportunity.borrower__years_in_current_home': 'Borrower - Years in Current Home',
  'opportunity.borrower__months_in_current_home': 'Borrower - Months in Current Home',
  'opportunity.borrower__prior_housing_ownership_type': 'Borrower - Prior Housing Ownership Type',
  'opportunity.borrower__prior_address_line_1': 'Borrower - Prior Address Line 1',
  'opportunity.borrower__prior_address_city': 'Borrower - Prior Address City',
  'opportunity.borrower__prior_address_state': 'Borrower - Prior Address - State',
  'opportunity.borrower__prior_address_zip': 'Borrower - Prior Address Zip',
  'opportunity.borrower__years_in_prior_home': 'Borrower - Years in Prior Home',
  'opportunity.borrower__months_in_prior_home': 'Borrower - Months in Prior Home',
  'opportunity.borrower__address_notes': 'Borrower - Address Notes',
  'opportunity.borrower__veteran': 'Borrower - Veteran',

  // Employment
  'opportunity.borrower__employment_status': 'Borrower - Employment Status',
  'opportunity.borrower__employer_name': 'Borrower - Employer Name',
  'opportunity.borrower__job_title': 'Borrower - Job Title',
  'opportunity.borrower__years_at_employer': 'Borrower - Years at Employer',
  'opportunity.borrower__months_at_employer': 'Borrower - Months at Employer',
  'opportunity.borrower__years_in_line_of_work': 'Borrower - Years in Line of Work',
  'opportunity.borrower__previous_employer_name': 'Borrower - Previous Employer Name',
  'opportunity.borrower__previous_employer_position': 'Borrower - Previous Employer Position',
  'opportunity.borrower__years_at_previous_employer': 'Borrower - Years at Previous Employer',
  'opportunity.borrower__months_at_previous_employer': 'Borrower - Months at Previous Employer',
  'opportunity.borrower__monthly_base_income': 'Borrower - Monthly Base Income',
  'opportunity.borrower__other_income_1_type': 'Borrower - Other Income 1 Type',
  'opportunity.borrower__other_income_1_amount': 'Borrower - Other Income 1 Amount',
  'opportunity.borrower__other_income_2_type': 'Borrower - Other Income 2 Type',
  'opportunity.borrower__other_income_2_amount': 'Borrower - Other Income 2 Amount',
  'opportunity.borrower__other_income_3_type': 'Borrower - Other Income 3 Type',
  'opportunity.borrower__other_income_3_amount': 'Borrower - Other Income 3 Amount',

  // Co-Borrower
  'opportunity.borrower__has_coborrower': 'Borrower - Has Co-Borrower',
  'opportunity.coborrower__first_name': 'Co-Borrower - First Name',
  'opportunity.coborrower__last_name': 'Co-Borrower - Last Name',
  'opportunity.coborrower__phone': 'Co-Borrower - Phone',
  'opportunity.coborrower__email': 'Co-Borrower - Email',
  'opportunity.coborrower__citizenship_status': 'Co-Borrower - Citizenship Status',
  'opportunity.coborrower__employment_status': 'Co-Borrower - Employment Status',
  'opportunity.coborrower__employer_name': 'Co-Borrower - Employer Name',
  'opportunity.coborrower__job_title': 'Co-Borrower - Job Title',
  'opportunity.coborrower__years_at_employer': 'Co-Borrower - Years at Employer',
  'opportunity.coborrower__months_at_employer': 'Co-Borrower - Months at Employer',
  'opportunity.coborrower__years_in_line_of_work': 'Co-Borrower - Years in Line of Work',
  'opportunity.coborrower__monthly_base_income': 'Co-Borrower - Monthly Base Income',
  'opportunity.coborrower__veteran': 'Co-Borrower - Veteran',

  // Property
  'opportunity.present_address_same_as_subject_property': 'Present Address Same as Subject Property',
  'opportunity.subject_property__occupancy_use': 'Subject Property - Occupancy Use',
  'opportunity.subject_property__number_of_units': 'Subject Property - Number of Units',
  'opportunity.subject_property__structure_type': 'Subject Property - Structure Type',
  'opportunity.stated_property_value': 'Stated Property Value',
  'opportunity.listed_for_sale_last_6_months': 'Listed For Sale (Last 6 Months)',

  // Current loan
  'opportunity.current_loan__free__clear': 'Current Loan - Free & Clear',
  'opportunity.current_loan__first_mortgage_balance': 'Current Loan - First Mortgage Balance',
  'opportunity.current_loan__monthly_payment': 'Current Loan - Monthly Payment',
  'opportunity.current_loan__type': 'Current Loan - Type',
  'opportunity.current_loan__term_months': 'Current Loan - Term (Months)',
  'opportunity.current_loan__interest_rate_': 'Current Loan - Interest Rate (%)',
  'opportunity.current_loan__rate_type': 'Current Loan - Rate Type',
  'opportunity.current_loan__mortgage_insurance_present': 'Current Loan - Mortgage Insurance Present',
  'opportunity.current_loan__escrowed': 'Current Loan - Escrowed',
  'opportunity.current_loan__pay_hoa': 'Current Loan - Pay HOA',
  'opportunity.current_loan__hoa_dues': 'Current Loan - Monthly HOA Dues',
  'opportunity.current_loan__annual_hoi': 'Current Loan - Monthly HOI',
  'opportunity.current_loan__annual_taxes': 'Current Loan - Monthly Taxes',
  'opportunity.current_loan__notes': 'Current Loan - Notes',

  // Title
  'opportunity.current_title_held_as': 'Current Title Held As',

  // Assets
  'opportunity.assets__account_type': 'Assets - Account Type',
  'opportunity.assets__checkingsavings_total': 'Assets - Checking/Savings Total',
  'opportunity.assets__retirement_accounts_total': 'Assets - Retirement Accounts Total',
  'opportunity.assets__cash_left_over_end_of_month': 'Assets - Cash Left Over End of Month',
  'opportunity.assets_section_notes': 'Assets Section Notes',

  // Declarations
  'opportunity.dec__additional_financing__new_credit__other_mortgage': 'Dec - Additional Financing / New Credit / Other Mortgage',
  'opportunity.dec__judgments__federal_debt__lawsuits': 'Dec - Judgments / Federal Debt / Lawsuits',
  'opportunity.dec__cosignerguarantor_any_undisclosed_debt': 'Dec - Co-Signer/Guarantor (Any Undisclosed Debt)',
  'opportunity.dec__bankruptcy__short_sale__foreclosure_last_7_years': 'Dec - Bankruptcy / Short Sale / Foreclosure (Last 7 Years)',
  'opportunity.dec__same_for_coborrower': 'Dec - Same for Co-Borrower',
  'opportunity.dec__bankruptcy_type': 'Dec - Borrower Bankruptcy Type',
  'opportunity.dec__coborrower_bankruptcy_type': 'Dec - Co-Borrower Bankruptcy Type',
  'opportunity.alimony_or_child_support': 'Alimony or Child Support',

  // Demographics
  'opportunity.dem__borrower_ethnicity': 'Dem - Borrower Ethnicity',
  'opportunity.dem__borrower_ethnicity_detail': 'Dem - Borrower Ethnicity Detail',
  'opportunity.dem__borrower_sex': 'Dem - Borrower Sex',
  'opportunity.dem__borrower_race': 'Dem - Borrower Race',
  'opportunity.dem__coborrower_ethnicity': 'Dem - Co-Borrower Ethnicity',
  'opportunity.dem__coborrower_ethnicity_detail': 'Dem - Co-Borrower Ethnicity Detail',
  'opportunity.dem__coborrower_race': 'Dem - Co-Borrower Race',
  'opportunity.dem__coborrower_sex': 'Dem - Co-Borrower Sex',

  // Other properties
  'opportunity.owns_other_properties': 'Owns Other Properties',
  'opportunity.number_of_other_properties': 'Number of Other Properties',
  'opportunity.other_properties__address_1': 'Other Properties - Address 1',
  'opportunity.other_properties__address_1_escrowed': 'Other Properties - Address 1 Escrowed',
  'opportunity.other_properties__address_2': 'Other Properties - Address 2',
  'opportunity.other_properties__address_2_escrowed': 'Other Properties - Address 2 Escrowed',
  'opportunity.other_properties__notes': 'Other Properties - Notes',

  // Credit
  'opportunity.credit_score_encompass': 'Credit Score Encompass',
  'opportunity.credit_section_notes': 'Credit Section Notes',

  // Notes
  'opportunity.income_section_notes': 'Income Section Notes',
  'opportunity.borrower_section_notes': 'Borrower Section Notes',
};

function extractStage2(contact: any, cfMap: Record<string, any>): Record<string, any> {
  const s2: Record<string, any> = {};

  // Contact-level fields
  if (contact) {
    if (contact.firstName) s2['Borrower - First Name'] = contact.firstName;
    if (contact.lastName) s2['Borrower - Last Name'] = contact.lastName;
    if (contact.email) s2['Borrower - Email'] = contact.email;
    if (contact.phone) s2['Borrower - Phone'] = contact.phone;
    if (contact.address1) s2['Borrower - Primary Street Address'] = contact.address1;
    if (contact.city) s2['Borrower - Primary Address City'] = contact.city;
    if (contact.state) s2['Borrower - Primary Address State'] = contact.state;
    if (contact.postalCode) s2['Borrower - Primary Address Zip'] = contact.postalCode;
  }

  // Map all opportunity custom fields
  for (const [ghlKey, formField] of Object.entries(STAGE2_FIELD_MAP)) {
    const value = cfMap[ghlKey];
    if (value !== undefined) {
      s2[formField] = value;
    }
  }

  return s2;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthenticatedApplication(req, 'id, phone, session_expires_at');
    if ('response' in auth) return auth.response;

    const { supabase, app, sessionToken } = auth;
    const phone = typeof app.phone === 'string' ? app.phone : '';

    // Search GHL for contact
    const contact = await findContactByPhone(phone);
    if (!contact) {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'No existing application found',
        stage1Fields: {},
        stage2Fields: {},
      });
    }

    // Get opportunity
    const opportunity = await getOpportunity(contact.id);

    // Build field map from opportunity custom fields
    const cfMap = buildCustomFieldMap(opportunity);

    // Extract stage-specific fields
    const stage1Fields = extractStage1(cfMap);
    const stage2Fields = extractStage2(contact, cfMap);

    // Metadata
    const meta: Record<string, string> = {};
    if (opportunity?.name) meta._opportunityName = opportunity.name;
    if (opportunity?.id) meta._opportunityId = opportunity.id;
    if (contact?.id) meta._contactId = contact.id;

    // Save to Supabase
    await supabase
      .from('applications')
      .update({
        form_data: { ...stage1Fields, ...stage2Fields, ...meta },
        updated_at: new Date().toISOString(),
      })
      .eq('session_token', sessionToken);

    return NextResponse.json({
      success: true,
      found: true,
      stage1Fields,
      stage2Fields,
      contactId: contact.id,
      opportunityId: opportunity?.id || null,
    });
  } catch (err) {
    console.error('Prefill error:', err);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}
