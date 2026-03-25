import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'pqK0BqXrQ5smZEkID6fP';
// Get Access pipeline (new, dedicated for website leads)
const GHL_PIPELINE_ID = 'sLrWXmhxdYQNwKoW2wrQ';
const GHL_STAGE_NEW_LEAD = '71528f87-6da1-4c54-b6bf-ea3129d691a2';
const GHL_VERSION = '2021-07-28';

// ── Form field name → GHL opportunity custom field ID ──
// Generated from GHL API: GET /locations/:id/customFields?model=opportunity
const FORM_TO_GHL: Record<string, string> = {
  // Borrower info
  'Borrower - Citizenship Status': '7JHMSK46IDrHbMOHTa4Y',
  'Number of Dependents': 'izgMwhmP6Toi3ZdSKc2u',
  'Borrower - Housing Ownership Type': 'vESxuzIbgq8EfwO5uyJg',
  'Borrower - Primary Street Address': 'ZnteaOrxRpHGvpakt4AS',
  'Borrower - Primary Address City': '7AW7XRQiprhYaIEulRq8',
  'Borrower - Primary Address State': 'ZVY4ecWAwRC9zASwEseS',
  'Borrower - Primary Address Zip': 'lZ3ap9iuAQJVeni6y6oU',
  'Borrower - Years in Current Home': '3wJ1MwoZspYBOcSY1MbZ',
  'Borrower - Months in Current Home': '5yhCuT6CLsFj7btoKek9',
  'Borrower - Prior Housing Ownership Type': 'SRhTgguRRSoGJhclcOri',
  'Borrower - Prior Address Line 1': '8mthgG6TEE3FWPJeMYfn',
  'Borrower - Prior Address City': 'cp4P9T1tVIznPa6jmncu',
  'Borrower - Prior Address - State': '1IdHIAVbRLQgCvEFQSNB',
  'Borrower - Prior Address Zip': 'wRPo7ZnWhkpUINAw4Dvb',
  'Borrower - Years in Prior Home': '3Evdm3TefwgwnDOOctiI',
  'Borrower - Months in Prior Home': 'pwydwH51DHCgDDqrTflA',
  'Borrower - Address Notes': 'srLF89vzKJWi0Y45QcmZ',
  'Borrower - Veteran': 'Gcpu5OPNy2HsXJ9Y6i3t',
  'Borrower - Date of Birth': 'oOyGdSGTEONkT4uiIcXz',
  'Borrower - Social Security Number': 'MtYBSTJmhH3YQEQPO7W5',

  // Employment
  'Borrower - Employment Status': 'aMUTCHErr2HdVlfNZRJf',
  'Borrower - Employer Name': 'gfdiD84FwseEAkPetUtr',
  'Borrower - Job Title': 'dKCOe2Vb8cwK1WkrsIbf',
  'Borrower - Years at Employer': 'U5UcojqWpG9NcN2xe7cL',
  'Borrower - Months at Employer': 'QFspoBT0eJyzHeUhem6w',
  'Borrower - Years in Line of Work': 'BROoNWM25ilespXfPxGz',
  'Borrower - Previous Employer Name': 'cqZQn4459IN0XI7M7ZKt',
  'Borrower - Previous Employer Position': 'nGRte9f4hVOzjNkInWUt',
  'Borrower - Years at Previous Employer': 'nlSSzbQb4DWEzjA8v0Ma',
  'Borrower - Months at Previous Employer': 'V3hSWb717c6cyAgtK7xT',
  'Borrower - Monthly Base Income': 'uBIFT0h4CtFNic0oxuCW',
  'Borrower - Pay Type': '1St1ZXBc2WLFSQPFhgrO',
  'Borrower - Hourly Rate': 'mSGGNmRbSylCC9E2OjfR',
  'Borrower - Bonus Monthly Income': 'qTm0oRoKt4uveqScnQMy',
  'Borrower - Commission Monthly Income': 'Zu5ypp7m51QZZ0yccH25',
  'Borrower - Overtime Monthly Income': 'kB9drqMk5ochgLuK9RgM',
  'Borrower - Other Monthly Income': '5fM2OaWbQO6zMeIA5Nbe',
  'Borrower - Self-Employed 25%+ Owner': 'XctjtGU4ndkkilaUCQsq',
  'Borrower - Self-Employed Monthly Business Income': 'b9eYRJj9Trflyv0GqbPH',
  'Borrower - Other Income 1 Type': 'uV8XeoInJw7acVKAmHfz',
  'Borrower - Other Income 1 Amount': 'CTINWWG6pBqgn0oqwDqx',
  'Borrower - Other Income 2 Type': 'Q4bCzV5pvDMBHXIKO2H3',
  'Borrower - Other Income 2 Amount': 'B3w2uYUhaY7rqQW0s4O4',
  'Borrower - Other Income 3 Type': '4hu2z0uHIysWRYeG1pZ9',
  'Borrower - Other Income 3 Amount': 'LfpxSy6PBTbRIHfebG4f',

  // Co-Borrower
  'Borrower - Has Co-Borrower': 'Cxd4P2zg8p3unOneJBrf',
  'Co-Borrower - First Name': 'OngTKgIBaOt3ppzWcMnV',
  'Co-Borrower - Last Name': 'e1byhH0EKwAfj78lDbWg',
  'Co-Borrower - Phone': 'RyaT3rYP0tdUPIMtx4Xo',
  'Co-Borrower - Email': 'oagZTlVMcL2jzy1PjHjz',
  'Co-Borrower - Date of Birth': 'ISkPC0IRcFn1wPQfa0BZ',
  'Co-Borrower - Social Security Number': 'jt1yjJ4Q0Ms1zf1F6qAH',
  'Co-Borrower - Citizenship Status': 'AKBkZPOQeC2vIf8PbHm1',
  'Co-Borrower - Employment Status': '8IoT4uwttvfETzsfEZjG',
  'Co-Borrower - Employer Name': 'sXhQ6EXOxn0HZsREf2TN',
  'Co-Borrower - Job Title': 'U0yq8HGiBVSDeDo6A83P',
  'Co-Borrower - Years at Employer': '0yqCrD5uKcpVZ9w1SpiC',
  'Co-Borrower - Months at Employer': 'Tq0zuoY0ZbSlZGUhmWOJ',
  'Co-Borrower - Years in Line of Work': '7WO5A9geGWvrigw4xPDY',
  'Co-Borrower - Monthly Base Income': '97cjfss9MneF30ty6A2v',
  'Co-Borrower - Veteran': 'tYDucgUCXkBju6DC0vAL',
  'Co-Borrower - Pay Type': 'Jc6k2UHAnpOtnUuGpKVJ',
  'Co-Borrower - Hourly Rate': 'fSPR6YEsIbAWQwpZHbBl',
  'Co-Borrower - Bonus Monthly Income': '21DHSwtmCbEMHed3NF6Q',
  'Co-Borrower - Commission Monthly Income': 'gl0yAuFu4O0XCEmDWKDx',
  'Co-Borrower - Overtime Monthly Income': 'MSY3dClApO6rUOu3NkxD',
  'Co-Borrower - Other Monthly Income': 'XUE5GrHZYTUQUiSRirWN',
  'Co-Borrower - Self-Employed 25%+ Owner': 'pGwAjCOcpTFPI8gx6CLZ',
  'Co-Borrower - Self-Employed Monthly Business Income': 'huTNdvAuDEHiHndubrqI',
  'Co-Borrower - Previous Employer Name': 'fHsGEokTK1wBMjPFUhZB',
  'Co-Borrower - Previous Employer Position': 'YYPuAFrSad2tkgxkQ3sx',
  'Co-Borrower - Months at Previous Employer': 'qO46URjM5a7Hn30QWp2e',
  'Co-Borrower - Years at Previous Employer': '4JH6GykF9bP7vvaq4PMD',
  'Co-Borrower - Other Income 1 Type': 'CqXtIuXY87sBaDVq6UtN',
  'Co-Borrower - Other Income 1 Amount': '2WDGgQSpjW8LJxYZ9pcn',
  'Co-Borrower - Other Income 2 Type': 'M1c6gaLk1zr66blqS2ci',
  'Co-Borrower - Other Income 2 Amount': 'lgPwI6b1tcQd6BCdKtGB',
  'Co-Borrower - Other Income 3 Type': 'glyzpw9EvpwcrR0ioIyq',
  'Co-Borrower - Other Income 3 Amount': '0IKNOjGtXpe761MHcprd',

  // Property / Subject
  'Loan Purpose': '6MuhWhwXCm1GOGMazyD2',
  'Loan Type': 'Z4UNxmlZz3XI1i1ddh8h',
  'Property Type': 'cVawq6S57Nsa3TfPnYY0',
  'Stated Property Value': 'LNQik0ammFBk61RJwSl0',
  'Subject Property - Street Address': 'gEax09qKcNqzc9u3LUO2',
  'Subject Property - City': 'sNRWwqWfqLIvUMDN2TEu',
  'Subject Property - State': 'sxpWnvYijRZUlM1xaUpn',
  'Subject Property - Zip': 'sAFIQAWKxmTaowpcnFvP',
  'Subject Property - Occupancy Use': 'DQnzQRDmFmVYzHSjzCNZ',
  'Subject Property - Number of Units': 'sjXbqICEqFBZoMJZOgDM',
  'Subject Property - Structure Type': 'lhE9uWIcp8jD11nBwdr8',
  'Subject Property - Notes': '9MOKVow8tUulc6MR4qFw',
  'Present Address Same as Subject Property': 'dPfXLG8un2F7MhLRL8Ho',
  'Listed For Sale (Last 6 Months)': 'd0j27Hw5pT0Ztrm8j9MH',
  'Purchase - Currently In Contract': 'tx5u4oiD9o2c6Ky8FWMD',
  'Purchase - Down Payment Amount': 'beUU9LDmT0sWfg0sDchx',
  'Purchase - Down Payment Percentage': 'oVenejePOgzibhn4kQ7M',
  'Purchase - Down Payment Source': 'fSdCelClyQRZndXJI4Af',
  'Purchase - First-Time Homebuyer': 'bda1BPh9L5dNm3BrL0vQ',
  'Purchase - Property Type Sought': 'oQhysigMKQZVSfUGzwYP',
  'Purchase - Purchase Price': 'B5CUFsy1FSE54PH6oSgX',
  'Purchase - Working With Agent': 'enbGwjWaDPSQfKfzrP49',

  // Current loan
  'Current Loan - Free & Clear': '96o5NUFeTgh4RZDfVzw0',
  'Current Loan - First Mortgage Balance': 'MPcopVZVLkCFeaoPF6LV',
  'Current Loan - Monthly Payment': 'EafrsHKfoYPdDIrFZJAB',
  'Current Loan - Type': 'cuexgqANOnQfgFXl5UW2',
  'Current Loan - Term (Months)': 'L16Nhh6FLZsbSe38qdTE',
  'Current Loan - Interest Rate (%)': 'PaI5OuFNXb5359Wusu56',
  'Current Loan - Rate Type': 'PuZtSTGlH1ai7DTo7JTS',
  'Current Loan - Mortgage Insurance Present': 'Z92kpVhpKdgW0u5USzGz',
  'Current Loan - Mortgage Insurance Amount': 'gVvIhANp3wlDtggEq9yy',
  'Current Loan - Escrowed': 'M5hL6iufhnmWPSe2CBvo',
  'Current Loan - Pay HOA': 'XY15b4rSlFysg5ykBUBG',
  'Current Loan - Monthly HOA Dues': 'H4bfbnQbDdrG7bpXRmCy',
  'Current Loan - Monthly HOI': 'okVwQfssO6jzTJZYo1fx',
  'Current Loan - Monthly Taxes': 'FOUtMdtMUtc1Vlv9ry6f',
  'Current Loan - Rent': '2mrJMr8ymjKxVCGOiRsB',
  'Current Loan - Notes': 'yVIi8RvTpIkRXMGwShHD',

  // Second mortgage
  'Second Mortgage - Present': 'pVJM3ObS631WLwGQ59un',
  'Second Mortgage - Balance': 'zAeZ4bfQtYDI2ck1LgUi',
  'Second Mortgage - Monthly Payment': 'MC6GMt296zS8wbPyi42W',
  'Second Mortgage - Interest Rate (%)': 'GWpfYQO69hZ6ZgGFIOyj',
  'Second Mortgage - Rate Type': 'Qz02VY8UaN33bYf40vwO',

  // Title
  'Current Title Held As': 'XwSxBHLzYSM0aSwaLrWA',
  'Title Will Be Held As': 'mkOz3fctvg65uCEpR62R',
  'Title Section Notes': 'S0gRgV42X4ppEEMgMBnr',

  // Assets
  'Assets - Account Type': 'lvNGIbWlX0FlzFQ6hsoS',
  'Assets - Checking/Savings Total': 'ociiBUKGlQ0SxPFYw3eT',
  'Assets - Retirement Accounts Total': 'oBCFD4HfCk0mEv0xheP7',
  'Assets - Cash Left Over End of Month': 'QriJqSFFCKcYa1mrx0JQ',
  'Assets Section Notes': '8QNWGIMxYCvNphsyy665',

  // Declarations
  'Dec - Additional Financing / New Credit / Other Mortgage': '7unfmhO5HpM5fZAlSYy6',
  'Dec - Judgments / Federal Debt / Lawsuits': '3wgGHnodHzrlAHcnFvhZ',
  'Dec - Co-Signer/Guarantor (Any Undisclosed Debt)': 'Qf4sNhf9v2rOKiLH584s',
  'Dec - Bankruptcy / Short Sale / Foreclosure (Last 7 Years)': '4wwPcl4Y4H6YPBanPmXg',
  'Dec - Same for Co-Borrower': 'jpsc8IEuD998mKE5BRln',
  'Dec - Borrower Bankruptcy Type': 'zBIxjUkSJTaPnAi6igrR',
  'Dec - Co-Borrower Bankruptcy Type': 'jbgMprAnfOtvl38VIigd',
  'Dec - Borrower Bankruptcy (Last 7 Years)': 'puYi5mui4huP2gl0Oic5',
  'Dec - Borrower Deed in Lieu (Last 7 Years)': 'abI3iI0ZYf9cIspn1qyH',
  'Dec - Borrower Delinquent/Default on Federal Debt': 'NY8FYFizAh7dGjUeAvtx',
  'Dec - Borrower Outstanding Judgments': 'WC1uJf3v3UfMKpUyv9V6',
  'Dec - Borrower Party to Lawsuit with Financial Liability': 'UeFMmKw3fXHf9dzYJ9az',
  'Dec - Borrower Property Foreclosed (Last 7 Years)': '8jBNNuY3WM4JHzWsWtoB',
  'Dec - Borrower Short Sale / Pre-Foreclosure Sale (Last 7 Years)': 'RYVgTuWrgIcP3HbPQdKF',
  'Dec - Co-Borrower Bankruptcy (Last 7 Years)': 'mKafAO4eX65vzSCuWZjD',
  'Dec - Co-Borrower Deed in Lieu (Last 7 Years)': 'THg2fd02NOSECQ6G3j4q',
  'Dec - Co-Borrower Delinquent/Default on Federal Debt': '9uHPX2POInZfDuxgM8Xu',
  'Dec - Co-Borrower Outstanding Judgments': 'E4fEHByvy6QNOB4naL5t',
  'Dec - Co-Borrower Party to Lawsuit with Financial Liability': '5Zu899avmoPcz2KMhXo8',
  'Dec - Co-Borrower Property Foreclosed (Last 7 Years)': '5nPrkgbNTgB7r5iaOhuR',
  'Dec - Co-Borrower Short Sale / Pre-Foreclosure Sale (Last 7 Years)': 'YNQlEt79HBDetoCIx4YQ',
  'Alimony or Child Support': 'IQT8vdRee4bQMOPGoxBt',
  'Alimony/Child Support Monthly Payment': 'HdpChSzkTfWLajlq3UaJ',

  // Demographics
  'Dem - Borrower Ethnicity': 'uisB3ihmc3sdv493Y4qV',
  'Dem - Borrower Ethnicity Detail': 'AaxvWnabKj4xw8rgwwO3',
  'Dem - Borrower Sex': 'M7m4Ko7UY9WvJf2U8biE',
  'Dem - Borrower Race': '9Glofn0HQJv955PYHUau',
  'Dem - Co-Borrower Ethnicity': '7bhX2JWGWBfsG03fNOXB',
  'Dem - Co-Borrower Ethnicity Detail': 'GxWw1o4zXGn3pus2coQ3',
  'Dem - Co-Borrower Race': 'l1mesQUiebpS6UPeqeGi',
  'Dem - Co-Borrower Sex': '6dPWNcAOxleHZ9aqQbt5',

  // Other properties
  'Owns Other Properties': 'lTFs8vM71L5a7hAYEZww',
  'Number of Other Properties': 'qInfjRFbMSLbeI3dmCHJ',
  'Other Properties - Address 1': 'ZhiVKGeeBue3Lixmx6QU',
  'Other Properties - Address 1 Escrowed': 'pfgSMahbTO1W7EciQ1a5',
  'Other Properties - Address 2': 'xjEkhdpAJTgsVWVLCkEq',
  'Other Properties - Address 2 Escrowed': 'ommoyF1gGi9Hf3ksKgQr',
  'Other Properties - Address 3': 'PZMBtF1mSwb5YdhzqNqi',
  'Other Properties - Address 3 Escrowed': 'cvbes8OoBauXgaa9HvCK',
  'Other Properties - Address 4': 'BR0YsK72HhEXMf2HOJym',
  'Other Properties - Address 4 Escrowed': 'XVC7zqVgaq3g0eq1ppwY',
  'Other Properties - Address 5': '1xx6iP9BlQ3jBjzffCjU',
  'Other Properties - Address 5 Escrowed': 'B4ZKRzA6QbbG7OSfP5xR',
  'Other Properties - Notes': 'EPgOAARO1UG4R1b6AvBD',

  // Credit
  'Credit Score Encompass': 'ieoaliOFUrMO0QMHSFq4',
  'Credit Section Notes': '9hzcTaCPgMXjqn30x79w',

  // Notes
  'Income Section Notes': '7yVe5OSibAP32lViGOZk',
  'Borrower Section Notes': '3tkKOxAfKSS3m6KFxuSC',

  // Tracking
  'Opportunity Created Source': 'sfN0Toy3wc5AJwytPi4v',
  'Lead Source': 'd2dQltWz9yvBmFqRliD5',
  'Lead Sub Source': 'YXtEqxNwJFgiefTVHgHA',
  'Lead Type': 'pJ58b0TPXI1aTc8SjkAD',
  'Application Date': '0UoSSP8TCoVpcAMveBUt',
};

// Fields that are internal/metadata and should NOT be sent to GHL
const SKIP_FIELDS = new Set([
  '_opportunityName', '_opportunityId', '_contactId',
  'product', 'propertyValue', 'loanBalance', 'creditScore',
  'propertyType', 'occupancy', 'cashOut', 'cashOutAmount',
  'drawTerm', 'propertyAddress', '_creditScoreInput',
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
    console.error(`GHL API error ${res.status} on ${path}:`, text);
    throw new Error(`GHL API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Search contact by phone
async function findContactByPhone(phone: string) {
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

// Create contact
async function createContact(formData: Record<string, any>, phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const body: any = {
    locationId: GHL_LOCATION_ID,
    phone: `+1${normalized}`,
    firstName: formData['Borrower - First Name'] || '',
    lastName: formData['Borrower - Last Name'] || '',
    email: formData['Borrower - Email'] || '',
    source: 'GetAccess Website',
  };

  // Add address if available
  if (formData['Borrower - Primary Street Address']) {
    body.address1 = formData['Borrower - Primary Street Address'];
    body.city = formData['Borrower - Primary Address City'] || '';
    body.state = formData['Borrower - Primary Address State'] || '';
    body.postalCode = formData['Borrower - Primary Address Zip'] || '';
  }

  const data = await ghlFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data?.contact || data;
}

// Update contact
async function updateContact(contactId: string, formData: Record<string, any>) {
  const body: any = {};
  if (formData['Borrower - First Name']) body.firstName = formData['Borrower - First Name'];
  if (formData['Borrower - Last Name']) body.lastName = formData['Borrower - Last Name'];
  if (formData['Borrower - Email']) body.email = formData['Borrower - Email'];
  if (formData['Borrower - Primary Street Address']) {
    body.address1 = formData['Borrower - Primary Street Address'];
    body.city = formData['Borrower - Primary Address City'] || '';
    body.state = formData['Borrower - Primary Address State'] || '';
    body.postalCode = formData['Borrower - Primary Address Zip'] || '';
  }

  if (Object.keys(body).length === 0) return;

  await ghlFetch(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// Get most recent opportunity for contact
async function findOpportunity(contactId: string) {
  const data = await ghlFetch(
    `/opportunities/search?location_id=${GHL_LOCATION_ID}&contact_id=${contactId}&order=added_desc&page=1&limit=1`
  );
  return data?.opportunities?.[0] || null;
}

// Build custom fields array for GHL opportunity write
function buildCustomFields(formData: Record<string, any>): Array<{ id: string; field_value: any }> {
  const fields: Array<{ id: string; field_value: any }> = [];

  // Map Stage 1 data to GHL fields
  if (formData.propertyValue) {
    fields.push({ id: 'LNQik0ammFBk61RJwSl0', field_value: formData.propertyValue }); // Stated Property Value
  }
  if (formData.loanBalance) {
    fields.push({ id: 'MPcopVZVLkCFeaoPF6LV', field_value: formData.loanBalance }); // First Mortgage Balance
  }
  if (formData.creditScore) {
    fields.push({ id: 'ONng5zFrN8SWAytTTbIq', field_value: formData.creditScore }); // Stated Credit Score
  }
  if (formData.propertyAddress) {
    // Parse address if it's a formatted string
    fields.push({ id: 'gEax09qKcNqzc9u3LUO2', field_value: formData.propertyAddress }); // Subject Property Address
  }

  // Map product type to Loan Purpose
  const productMap: Record<string, string> = {
    'HELOC': 'HELOC',
    'CES': 'Closed-End Second',
    'CashOut': 'Cash-Out Refinance',
    'NoCashRefi': 'Rate & Term Refinance',
  };
  if (formData.product && productMap[formData.product]) {
    fields.push({ id: '6MuhWhwXCm1GOGMazyD2', field_value: productMap[formData.product] });
  }

  // Map property type
  if (formData.propertyType) {
    fields.push({ id: 'cVawq6S57Nsa3TfPnYY0', field_value: formData.propertyType });
  }

  // Map occupancy
  if (formData.occupancy) {
    fields.push({ id: 'DQnzQRDmFmVYzHSjzCNZ', field_value: formData.occupancy });
  }

  // Map all Stage 2 form fields
  for (const [formField, ghlId] of Object.entries(FORM_TO_GHL)) {
    const value = formData[formField];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      // Don't duplicate fields we already set from Stage 1
      if (!fields.some(f => f.id === ghlId)) {
        // Clean value: strip wrapping quotes, parse stringified JSON
        let cleanValue: any = value;
        if (typeof cleanValue === 'string') {
          // Handle double-JSON-encoded strings like '"1990-02-29"'
          if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
            try { cleanValue = JSON.parse(cleanValue); } catch { /* keep as-is */ }
          }
          if (typeof cleanValue === 'string') {
            cleanValue = cleanValue.replace(/^"+|"+$/g, '').trim();
          }
        }
        fields.push({ id: ghlId, field_value: cleanValue });
      }
    }
  }

  // Set source and application date
  if (!fields.some(f => f.id === 'sfN0Toy3wc5AJwytPi4v')) {
    fields.push({ id: 'sfN0Toy3wc5AJwytPi4v', field_value: 'GetAccess Website' });
  }
  if (!fields.some(f => f.id === '0UoSSP8TCoVpcAMveBUt')) {
    fields.push({ id: '0UoSSP8TCoVpcAMveBUt', field_value: new Date().toISOString().split('T')[0] });
  }

  return fields;
}

// Create opportunity
async function createOpportunity(contactId: string, formData: Record<string, any>) {
  const firstName = formData['Borrower - First Name'] || '';
  const lastName = formData['Borrower - Last Name'] || '';
  const name = `${firstName} ${lastName}`.trim() || 'New Application';

  const body = {
    pipelineId: GHL_PIPELINE_ID,
    locationId: GHL_LOCATION_ID,
    name,
    pipelineStageId: GHL_STAGE_NEW_LEAD,
    status: 'open',
    contactId,
    customFields: buildCustomFields(formData),
  };

  const data = await ghlFetch('/opportunities/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data?.opportunity || data;
}

// Update opportunity
async function updateOpportunity(oppId: string, formData: Record<string, any>) {
  const body = {
    customFields: buildCustomFields(formData),
  };

  const data = await ghlFetch(`/opportunities/${oppId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return data?.opportunity || data;
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──
    const sessionToken = req.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get application
    const { data: app, error: appErr } = await supabase
      .from('applications')
      .select('id, phone, form_data')
      .eq('session_token', sessionToken)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    // Get submitted form data (merge with any stored data)
    const { formData: submittedData } = await req.json();
    const mergedData = { ...(app.form_data || {}), ...(submittedData || {}) };

    // ── 1. Save final data to Supabase ──
    await supabase
      .from('applications')
      .update({
        form_data: mergedData,
        stage: 'submitted',
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', app.id);

    // ── 2. Upsert GHL contact ──
    let contact = await findContactByPhone(app.phone);
    let contactId: string;

    if (contact) {
      contactId = contact.id;
      await updateContact(contactId, mergedData);
    } else {
      const newContact = await createContact(mergedData, app.phone);
      contactId = newContact.id;
    }

    // ── 3. Upsert GHL opportunity ──
    let opportunityId: string;
    const existingOpp = await findOpportunity(contactId);

    if (existingOpp) {
      opportunityId = existingOpp.id;
      await updateOpportunity(opportunityId, mergedData);
    } else {
      const newOpp = await createOpportunity(contactId, mergedData);
      opportunityId = newOpp.id;
    }

    // ── 4. Update Supabase with GHL IDs ──
    await supabase
      .from('applications')
      .update({
        form_data: {
          ...mergedData,
          _contactId: contactId,
          _opportunityId: opportunityId,
        },
      })
      .eq('id', app.id);

    return NextResponse.json({
      success: true,
      contactId,
      opportunityId,
      isNew: !contact,
      message: existingOpp
        ? 'Application updated in CRM'
        : 'New application created in CRM',
    });
  } catch (err: any) {
    console.error('Submit error:', err);
    return NextResponse.json(
      { error: err.message || 'Submission failed' },
      { status: 500 }
    );
  }
}
