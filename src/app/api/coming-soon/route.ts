import { NextRequest, NextResponse } from 'next/server';
const LOGO_URL = 'https://first-access-lending-website.vercel.app/logo.png';

// Coming Soon: create/find GHL contact, create/move opportunity to Coming Soon pipeline, send email

const GHL_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'pqK0BqXrQ5smZEkID6fP';

// TODO: Replace with actual pipeline/stage IDs once created in GHL
const COMING_SOON_PIPELINE_ID = process.env.GHL_COMING_SOON_PIPELINE_ID || '';
const COMING_SOON_STAGE_ID = process.env.GHL_COMING_SOON_STAGE_ID || '';

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function buildComingSoonEmail(firstName: string, stateName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <!-- Header with Logo -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="First Access Lending" style="height:55px;display:inline-block;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:22px;">Hi ${firstName},</h2>
              <p style="margin:0 0 16px;color:#475569;font-size:16px;line-height:1.6;">
                Thanks for your interest in First Access Lending! We appreciate you taking the time to explore your home equity options.
              </p>
              <p style="margin:0 0 16px;color:#475569;font-size:16px;line-height:1.6;">
                We're not yet licensed in <strong>${stateName}</strong>, but we're actively working to expand into your area. We've saved your information and will reach out as soon as we're able to serve homeowners in your state.
              </p>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
                In the meantime, here's what you can expect from us:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:12px 16px;background:#eff6ff;border-radius:8px;">
                    <p style="margin:0 0 8px;color:#1e40af;font-size:14px;font-weight:600;">✓ Priority notification when we're licensed in ${stateName}</p>
                    <p style="margin:0 0 8px;color:#1e40af;font-size:14px;font-weight:600;">✓ No spam — just one email when we're ready</p>
                    <p style="margin:0;color:#1e40af;font-size:14px;font-weight:600;">✓ Your information is safe and secure</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#475569;font-size:16px;line-height:1.6;">
                Thank you for your patience. We look forward to helping you unlock the value in your home.
              </p>
              <p style="margin:24px 0 0;color:#1e293b;font-size:16px;font-weight:600;">
                — The First Access Lending Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">
                First Access Lending | NMLS #1988098 | Equal Housing Lender
              </p>
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                <a href="https://eastcoastcap.com/privacy-policy/" style="color:#64748b;text-decoration:underline;">Privacy Policy</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { email, firstName, lastName, phone, state } = await req.json();

    if (!email || !state) {
      return NextResponse.json({ error: 'Email and state required' }, { status: 400 });
    }

    const stateName = STATE_NAMES[state] || state;
    const headers = ghlHeaders();
    let contactId: string | null = null;

    // 1. Find or create contact
    // Try by email first
    const searchRes = await fetch(
      `${GHL_BASE}/contacts/search/duplicate?locationId=${LOCATION_ID}&email=${encodeURIComponent(email)}`,
      { headers }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.contact?.id) {
        contactId = searchData.contact.id;
      }
    }

    // If phone provided and no contact found, search by phone
    if (!contactId && phone) {
      const normalized = normalizePhone(phone);
      const phoneSearch = await fetch(
        `${GHL_BASE}/contacts/search/duplicate?locationId=${LOCATION_ID}&phone=${encodeURIComponent(normalized)}`,
        { headers }
      );
      if (phoneSearch.ok) {
        const phoneData = await phoneSearch.json();
        if (phoneData.contact?.id) {
          contactId = phoneData.contact.id;
        }
      }
    }

    if (!contactId) {
      // Create new contact
      const createBody: Record<string, unknown> = {
        locationId: LOCATION_ID,
        email,
        name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        tags: ['coming-soon', `state-${state.toLowerCase()}`],
      };
      if (phone) {
        createBody.phone = normalizePhone(phone);
      }

      const createRes = await fetch(`${GHL_BASE}/contacts/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(createBody),
      });

      if (createRes.ok) {
        const createData = await createRes.json();
        contactId = createData.contact?.id;
      } else {
        console.error('GHL contact create failed:', createRes.status, await createRes.text());
      }
    } else {
      // Update existing contact with coming-soon tag
      await fetch(`${GHL_BASE}/contacts/${contactId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          tags: ['coming-soon', `state-${state.toLowerCase()}`],
        }),
      });
    }

    // 2. Create opportunity in Coming Soon pipeline
    if (contactId && COMING_SOON_PIPELINE_ID && COMING_SOON_STAGE_ID) {
      const oppBody = {
        pipelineId: COMING_SOON_PIPELINE_ID,
        pipelineStageId: COMING_SOON_STAGE_ID,
        locationId: LOCATION_ID,
        contactId,
        name: `Coming Soon - ${stateName} - ${email}`,
        status: 'open',
      };

      const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(oppBody),
      });

      if (!oppRes.ok) {
        console.error('GHL opportunity create failed:', oppRes.status, await oppRes.text());
      }
    }

    // 3. Send coming soon email via GHL
    if (contactId) {
      const emailHtml = buildComingSoonEmail(firstName || 'there', stateName);
      
      // Send email via GHL conversations API (creates email activity on contact)
      // Using the create-email endpoint 
      await fetch(`${GHL_BASE}/conversations/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'Email',
          contactId,
          subject: `We're coming to ${stateName} soon!`,
          html: emailHtml,
          emailFrom: 'First Access Lending <noreply@firstaccesslending.com>',
        }),
      });
    }

    return NextResponse.json({ 
      success: true,
      message: `We'll notify you when we're available in ${stateName}!`
    });

  } catch (err) {
    console.error('Coming soon error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
