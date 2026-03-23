import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate email
    if (!data.email || !data.email.includes('@')) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }
    
    // Generate email HTML
    const emailHTML = generateCalculatorEmail(data);
    
    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'First Access Lending <info@firstaccesslending.com>',
        to: data.email,
        subject: 'Your First Access Lending Mortgage Calculation',
        html: emailHTML,
      }),
    });
    
    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error('Resend API error:', {
        status: resendResponse.status,
        statusText: resendResponse.statusText,
        body: error,
        hasApiKey: !!process.env.RESEND_API_KEY,
        apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 8)
      });
      return NextResponse.json(
        { 
          error: 'Failed to send email via Resend',
          details: error,
          status: resendResponse.status
        },
        { status: 500 }
      );
    }
    
    const result = await resendResponse.json();
    
    // Send lead to Shape CRM
    try {
      await fetch('https://secure-api.setshape.com/postlead/22347/22897', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: data.email,
          property_value: data.homePrice?.toString() || '',
          loan_amount: data.loanAmount?.toString() || '',
          loan_type: data.loanType || 'conventional',
          lead_source: 'Website Calculator',
        }).toString(),
      });
    } catch (shapeError) {
      console.error('Shape CRM error (non-blocking):', shapeError);
      // Don't fail the request if Shape API fails
    }
    
    return NextResponse.json({ 
      success: true,
      messageId: result.id 
    });
    
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}

function generateCalculatorEmail(data: any): string {
  const {
    loanType = 'conventional',
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
    hoaFees = 0,
    monthlyPMI = 0,
    pmiRate = 0,
    totalMonthlyPayment,
    showTaxSavings,
    filingStatus,
    agi,
    state,
    year1Interest,
    year1PropertyTax,
    year1PMI = 0,
    stateIncomeTaxPaid = 0,
    saltDeduction = 0,
    charitableDonations = 0,
    medicalExpenses = 0,
    deductibleMedical = 0,
    totalDeductions,
    marginalTaxRate,
    taxSavings,
    effectiveMonthlyPayment,
  } = data;

  const fmt = (num: number) => `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const fmtInt = (num: number) => `$${num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const downPaymentPercent = ((downPayment / homePrice) * 100).toFixed(1);
  const needsPMI = monthlyPMI > 0;
  const pmiLabel = loanType === 'fha' ? 'FHA MIP' : 'PMI';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
      background-color: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #2563EB;
      padding-bottom: 20px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563EB;
      margin-bottom: 8px;
    }
    h1 {
      color: #1e40af;
      font-size: 24px;
      margin: 20px 0 10px 0;
    }
    h2 {
      color: #2563EB;
      font-size: 18px;
      border-bottom: 2px solid #93c5fd;
      padding-bottom: 8px;
      margin-top: 24px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    td:first-child {
      font-weight: 500;
      color: #4b5563;
    }
    td:last-child {
      text-align: right;
      color: #111827;
    }
    .total-row {
      background-color: #eff6ff;
      font-weight: bold;
      font-size: 16px;
    }
    .total-row td {
      padding: 14px 10px;
      border-top: 2px solid #2563EB;
      border-bottom: 2px solid #2563EB;
    }
    .tax-section {
      background-color: #f0fdf4;
      border: 2px solid #22c55e;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .highlight {
      background-color: #dbeafe;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .highlight-green {
      background-color: #d1fae5;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
      border-left: 4px solid #22c55e;
    }
    .cta-button {
      display: block;
      text-align: center;
      background-color: #2563EB;
      color: white;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 24px 0;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    .note {
      font-size: 11px;
      color: #6b7280;
      font-style: italic;
      margin-top: 8px;
      padding: 8px;
      background-color: #fef3c7;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">FIRST ACCESS LENDING</div>
      <div style="color: #6b7280; font-size: 14px;">Your Trusted Mortgage Partner</div>
    </div>

    <h1>Your Mortgage Calculation</h1>
    <p style="color: #6b7280;">Generated on ${new Date().toLocaleDateString()}</p>

    <h2>Loan Details</h2>
    <table>
      <tr>
        <td>Loan Type</td>
        <td>${loanType === 'fha' ? 'FHA' : 'Conventional'}</td>
      </tr>
      <tr>
        <td>Home Price</td>
        <td>${fmtInt(homePrice)}</td>
      </tr>
      <tr>
        <td>Down Payment (${downPaymentPercent}%)</td>
        <td>${fmtInt(downPayment)}</td>
      </tr>
      <tr>
        <td>Loan Amount</td>
        <td>${fmtInt(loanAmount)}</td>
      </tr>
      <tr>
        <td>Interest Rate</td>
        <td>${interestRate.toFixed(3)}%</td>
      </tr>
      <tr>
        <td>Loan Term</td>
        <td>${loanTerm} years</td>
      </tr>
    </table>

    <h2>Monthly Payment Breakdown</h2>
    <table>
      <tr>
        <td>Principal & Interest</td>
        <td>${fmt(monthlyPI)}</td>
      </tr>
      <tr>
        <td>Property Taxes</td>
        <td>${fmt(monthlyPropertyTax)}</td>
      </tr>
      <tr>
        <td>Home Insurance</td>
        <td>${fmt(monthlyInsurance)}</td>
      </tr>
      ${needsPMI ? `
      <tr>
        <td>${pmiLabel}</td>
        <td>${fmt(monthlyPMI)}</td>
      </tr>
      ` : ''}
      ${hoaFees > 0 ? `
      <tr>
        <td>HOA Fees</td>
        <td>${fmt(hoaFees)}</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td>Total Monthly Payment</td>
        <td>${fmt(totalMonthlyPayment)}</td>
      </tr>
    </table>

    ${showTaxSavings && taxSavings > 0 ? `
    <div class="tax-section">
      <h2 style="color: #15803d; border-color: #86efac;">Tax Savings Analysis</h2>
      
      <table style="margin-bottom: 12px;">
        <tr>
          <td>Filing Status</td>
          <td>${filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'}</td>
        </tr>
        <tr>
          <td>Federal Tax Bracket</td>
          <td>${(marginalTaxRate * 100).toFixed(0)}%</td>
        </tr>
        <tr>
          <td>Total Itemized Deductions</td>
          <td>${fmtInt(totalDeductions)}</td>
        </tr>
      </table>

      <div class="highlight-green">
        <table style="margin: 0;">
          <tr>
            <td style="border: none; color: #15803d; font-weight: 600;">Annual Tax Savings</td>
            <td style="border: none; font-weight: bold; color: #15803d; font-size: 18px;">${fmtInt(taxSavings)}</td>
          </tr>
          <tr>
            <td style="border: none; color: #15803d;">Monthly Savings</td>
            <td style="border: none; font-weight: 600; color: #15803d;">${fmt(taxSavings / 12)}</td>
          </tr>
        </table>
      </div>

      <div class="highlight">
        <table style="margin: 0;">
          <tr>
            <td style="border: none; color: #1e40af; font-weight: 600;">Effective Monthly Payment</td>
            <td style="border: none; font-weight: bold; color: #1e40af; font-size: 18px;">${fmt(effectiveMonthlyPayment)}</td>
          </tr>
        </table>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #6b7280;">
          After tax savings (${((taxSavings/12)/totalMonthlyPayment*100).toFixed(1)}% reduction)
        </p>
      </div>
    </div>
    ` : ''}

    <a href="https://firstaccesslending.com/getaccess" class="cta-button">
      Get Pre-Approved Now
    </a>

    <div style="text-align: center; margin: 20px 0;">
      <p style="margin: 8px 0;"><strong>Questions? We're here to help!</strong></p>
      <p style="margin: 4px 0; color: #6b7280;">
        <strong>Email:</strong> <a href="mailto:info@firstaccesslending.com" style="color: #2563EB;">info@firstaccesslending.com</a>
      </p>
      <p style="margin: 4px 0; color: #6b7280;">
        <strong>Web:</strong> <a href="https://firstaccesslending.com" style="color: #2563EB;">firstaccesslending.com</a>
      </p>
    </div>

    <div class="note">
      <strong>Disclaimer:</strong> This calculator provides estimates only and is NOT a Loan Estimate (LE) as defined by federal mortgage regulations. 
      For an official Loan Estimate, please contact First Access Lending directly. This does NOT constitute tax advice. 
      Consult a qualified tax professional before making tax-related decisions.
    </div>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} First Access Lending. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}
