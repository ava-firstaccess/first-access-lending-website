import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'pqK0BqXrQ5smZEkID6fP';
const GHL_VERSION = '2021-07-28';

// Sensitive fields to NEVER pull from GHL
const BLOCKED_FIELDS = new Set([
  'dateOfBirth', 'date_of_birth', 'dob', 'ssn', 'social_security',
  'socialSecurityNumber', 'social_security_number'
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
      ...(options.headers || {})
    }
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
  const data = await ghlFetch('/contacts/search', {
    method: 'POST',
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      page: 1,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: phone }]
    })
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

  // Get full opportunity details
  const opp = await ghlFetch(`/opportunities/${oppId}`);
  return opp?.opportunity || opp || null;
}

// Map GHL contact + opportunity data to Stage 2 fields
function mapToFormFields(contact: any, opportunity: any): Record<string, any> {
  const fields: Record<string, any> = {};

  // Contact-level fields
  if (contact) {
    if (contact.firstName) fields['Borrower - First Name'] = contact.firstName;
    if (contact.lastName) fields['Borrower - Last Name'] = contact.lastName;
    if (contact.email) fields['Borrower - Email'] = contact.email;
    if (contact.phone) fields['Borrower - Phone'] = contact.phone;
    if (contact.address1) fields['Borrower - Current Address'] = [
      contact.address1, contact.city, contact.state, contact.postalCode
    ].filter(Boolean).join(', ');
  }

  // Opportunity custom fields
  if (opportunity?.customFields) {
    const cf = Array.isArray(opportunity.customFields)
      ? opportunity.customFields
      : Object.entries(opportunity.customFields).map(([k, v]) => ({ id: k, value: v }));

    for (const field of cf) {
      const key = field.key || field.fieldKey || field.id || '';
      const value = field.value ?? field.fieldValue;

      // Skip blocked fields
      if (BLOCKED_FIELDS.has(key)) continue;

      // Map known GHL custom field keys to our form field names
      // This mapping will grow as we identify all GHL field keys
      const mapping: Record<string, string> = {
        // Borrower info
        'citizenship_status': 'Borrower - Citizenship Status',
        'number_of_dependents': 'Number of Dependents',

        // Property
        'property_type': 'propertyType',
        'property_value': 'propertyValue',
        'stated_property_value': 'Stated Property Value',
        'loan_balance': 'loanBalance',
        'occupancy_type': 'Subject Property - Occupancy',

        // Current loan
        'first_mortgage_balance': 'Current Loan - First Mortgage Balance',
        'monthly_payment': 'Current Loan - Monthly Payment',
        'interest_rate': 'Current Loan - Interest Rate (%)',

        // Employment
        'employer_name': 'Borrower - Employer Name',
        'job_title': 'Borrower - Job Title',
        'years_at_employer': 'Borrower - Years at Employer',

        // Co-borrower
        'co_borrower_first_name': 'Co-Borrower - First Name',
        'co_borrower_last_name': 'Co-Borrower - Last Name',
        'co_borrower_email': 'Co-Borrower - Email',
        'co_borrower_phone': 'Co-Borrower - Phone',
      };

      if (mapping[key] && value !== undefined && value !== null && value !== '') {
        fields[mapping[key]] = value;
      }
    }
  }

  // Opportunity-level fields (name, pipeline stage, etc.)
  if (opportunity?.name) fields['_opportunityName'] = opportunity.name;
  if (opportunity?.id) fields['_opportunityId'] = opportunity.id;
  if (opportunity?.contact?.id) fields['_contactId'] = opportunity.contact.id;

  return fields;
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate via session cookie
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get application to find phone number
    const { data: app, error } = await supabase
      .from('applications')
      .select('phone')
      .eq('session_token', sessionToken)
      .single();

    if (error || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Search GHL for contact
    const contact = await findContactByPhone(app.phone);
    if (!contact) {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'No existing application found',
        fields: {}
      });
    }

    // Get opportunity
    const opportunity = await getOpportunity(contact.id);

    // Map to form fields (excluding DOB, SSN)
    const fields = mapToFormFields(contact, opportunity);

    // Save prefilled data to application
    if (Object.keys(fields).length > 0) {
      await supabase
        .from('applications')
        .update({
          form_data: fields,
          updated_at: new Date().toISOString()
        })
        .eq('session_token', sessionToken);
    }

    return NextResponse.json({
      success: true,
      found: true,
      fields,
      contactId: contact.id,
      opportunityId: opportunity?.id || null
    });

  } catch (err) {
    console.error('Prefill error:', err);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}
