import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Generate HTML for PDF
    const htmlContent = generatePDFHTML(data);

    // Send email using the existing email infrastructure
    const emailResponse = await fetch(process.env.EMAIL_API_URL || 'http://localhost:3000/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: data.email,
        subject: 'Your First Access Lending Mortgage Calculation',
        html: htmlContent,
        from: 'ava@fal.firstaccesslending.com',
        replyTo: 'info@firstaccesslending.com',
      }),
    });

    if (!emailResponse.ok) {
      throw new Error('Failed to send email');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PDF/Email error:', error);
    return NextResponse.json(
      { error: 'Failed to generate and send PDF' },
      { status: 500 }
    );
  }
}

function generatePDFHTML(data: any): string {
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
    hoaFees,
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
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid #2563EB;
      padding-bottom: 20px;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #2563EB;
      margin-bottom: 10px;
    }
    .tagline {
      color: #666;
      font-size: 14px;
    }
    h1 {
      color: #1e40af;
      margin-bottom: 10px;
    }
    h2 {
      color: #2563EB;
      border-bottom: 2px solid #93c5fd;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    h3 {
      color: #15803d;
      margin-top: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    td:first-child {
      font-weight: 600;
      color: #4b5563;
    }
    td:last-child {
      text-align: right;
      color: #111827;
    }
    .total-row {
      background-color: #eff6ff;
      font-weight: bold;
      font-size: 18px;
    }
    .total-row td {
      padding: 16px 12px;
      border-top: 2px solid #2563EB;
      border-bottom: 2px solid #2563EB;
    }
    .tax-savings {
      background-color: #f0fdf4;
      border: 2px solid #22c55e;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .deduction-breakdown {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 15px;
      margin: 15px 0;
    }
    .deduction-breakdown table {
      margin: 10px 0 0 0;
    }
    .deduction-breakdown td {
      padding: 8px 12px;
      font-size: 14px;
    }
    .deduction-breakdown td:first-child {
      padding-left: 24px;
      font-weight: normal;
    }
    .deduction-breakdown .subtotal {
      border-top: 1px solid #94a3b8;
      font-style: italic;
    }
    .highlight {
      background-color: #dbeafe;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .highlight-green {
      background-color: #d1fae5;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #22c55e;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
    .contact {
      margin-top: 30px;
      padding: 20px;
      background-color: #f9fafb;
      border-radius: 8px;
      text-align: center;
    }
    .contact a {
      color: #2563EB;
      text-decoration: none;
    }
    .note {
      font-size: 12px;
      color: #6b7280;
      font-style: italic;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">FIRST ACCESS LENDING</div>
    <div class="tagline">Your Trusted Mortgage Partner</div>
  </div>

  <h1>Mortgage Payment Calculation</h1>
  <p>Generated on ${new Date().toLocaleDateString()}</p>

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
      <td>${pmiLabel} ${loanType === 'fha' ? '(Mortgage Insurance Premium)' : '(Private Mortgage Insurance)'}</td>
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

  ${showTaxSavings ? `
  <div class="tax-savings">
    <h3>Tax Savings Analysis</h3>
    
    <table>
      <tr>
        <td>Filing Status</td>
        <td>${filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'}</td>
      </tr>
      <tr>
        <td>State</td>
        <td>${state}</td>
      </tr>
      <tr>
        <td>Adjusted Gross Income</td>
        <td>${fmtInt(agi)}</td>
      </tr>
      <tr>
        <td>Federal Tax Bracket</td>
        <td>${(marginalTaxRate * 100).toFixed(0)}%</td>
      </tr>
    </table>

    <div class="deduction-breakdown">
      <h4 style="margin-top: 0; color: #475569;">Itemized Deduction Breakdown</h4>
      <table style="margin: 10px 0 0 0;">
        <tr>
          <td>• Mortgage Interest (Year 1)</td>
          <td>${fmtInt(year1Interest)}</td>
        </tr>
        <tr>
          <td>• State Income Tax Paid</td>
          <td>${fmtInt(stateIncomeTaxPaid)}</td>
        </tr>
        <tr>
          <td>• Property Taxes (Annual)</td>
          <td>${fmtInt(year1PropertyTax)}</td>
        </tr>
        <tr class="subtotal">
          <td style="padding-left: 40px;">SALT Deduction (capped at $10,000)</td>
          <td>${fmtInt(saltDeduction)}</td>
        </tr>
        ${needsPMI && agi < 100000 ? `
        <tr>
          <td>• PMI (Annual)</td>
          <td>${fmtInt(year1PMI)}</td>
        </tr>
        ` : ''}
        ${charitableDonations > 0 ? `
        <tr>
          <td>• Charitable Donations</td>
          <td>${fmtInt(charitableDonations)}</td>
        </tr>
        ` : ''}
        ${deductibleMedical > 0 ? `
        <tr>
          <td>• Medical Expenses (deductible portion)</td>
          <td>${fmtInt(deductibleMedical)}</td>
        </tr>
        ` : ''}
        <tr class="total-row" style="font-size: 16px;">
          <td style="padding-left: 12px;">Total Itemized Deductions</td>
          <td>${fmtInt(totalDeductions)}</td>
        </tr>
        <tr>
          <td>Standard Deduction</td>
          <td>${fmtInt(filingStatus === 'married' ? 29200 : 14600)}</td>
        </tr>
      </table>
      <p class="note">
        State & local tax (SALT) deduction is capped at $10,000 by federal law.
        ${needsPMI && agi >= 100000 ? ' PMI not deductible for AGI above $100,000.' : ''}
        ${medicalExpenses > 0 ? ' Medical expenses only deductible if exceeding 7.5% of AGI.' : ''}
      </p>
    </div>

    <div class="highlight-green">
      <table style="margin: 0;">
        <tr>
          <td style="border: none; font-size: 18px; color: #15803d;">Annual Tax Savings</td>
          <td style="border: none; font-size: 20px; font-weight: bold; color: #15803d;">${fmtInt(taxSavings)}</td>
        </tr>
        <tr>
          <td style="border: none; color: #15803d;">Monthly Tax Savings</td>
          <td style="border: none; font-weight: bold; color: #15803d;">${fmt(taxSavings / 12)}</td>
        </tr>
      </table>
    </div>

    <div class="highlight">
      <table style="margin: 0;">
        <tr>
          <td style="border: none; font-size: 18px; color: #1e40af;">Effective Monthly Payment</td>
          <td style="border: none; font-size: 20px; font-weight: bold; color: #1e40af;">${fmt(effectiveMonthlyPayment)}</td>
        </tr>
      </table>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
        After tax savings ${taxSavings > 0 ? `(${(((taxSavings/12)/totalMonthlyPayment)*100).toFixed(1)}% reduction)` : ''}
      </p>
    </div>

    ${taxSavings === 0 ? `
    <p class="note" style="background-color: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b;">
      <strong>Note:</strong> Your itemized deductions do not exceed the standard deduction, so itemizing may not provide additional tax benefit in this scenario.
    </p>
    ` : ''}
  </div>
  ` : ''}

  <div class="contact">
    <h3 style="margin-top: 0; color: #1e40af;">Ready to Get Started?</h3>
    <p>Contact First Access Lending today for a personalized quote</p>
    <p>
      <strong>Phone:</strong> <a href="tel:+1-XXX-XXX-XXXX">(XXX) XXX-XXXX</a><br>
      <strong>Email:</strong> <a href="mailto:info@firstaccesslending.com">info@firstaccesslending.com</a><br>
      <strong>Web:</strong> <a href="https://firstaccesslending.com">firstaccesslending.com</a>
    </p>
  </div>

  <div class="footer">
    <p style="background-color: #fef3c7; padding: 12px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 15px;">
      <strong style="color: #92400e;">⚠️ Important:</strong> This calculator provides <strong>estimates only</strong> and is <strong>NOT</strong> a Loan Estimate (LE) 
      as defined by federal mortgage regulations. This is not governed by TILA-RESPA Integrated Disclosure (TRID) requirements. 
      For an official Loan Estimate, contact First Access Lending directly.
    </p>
    
    <p>
      <strong>Tax Disclaimer:</strong> This does <strong>NOT</strong> constitute tax advice. Tax savings are estimates only. 
      <strong>Consult a qualified tax professional</strong> before making tax-related decisions.
    </p>
    
    <p style="margin-top: 12px;">
      <strong>Assumptions:</strong> Conventional PMI: 0.17% for &lt;90% LTV, 0.24% for 90-95% LTV. FHA MIP: 0.80% for ≤95% LTV, 0.85% for &gt;95% LTV 
      (does not include upfront MIP). Minimum down payment: 5% conventional, 3.5% FHA. Actual rates vary by credit score, loan amount, and lender. 
      State tax rates are simplified estimates. SALT deduction capped at $10,000. PMI deductibility phases out for AGI above $100,000. 
      Actual results may vary significantly based on credit profile, loan type, property location, and individual tax circumstances. Tax laws change frequently.
    </p>
    
    <p style="margin-top: 12px;">
      <strong>Contact First Access Lending</strong> for an accurate, personalized quote and official Loan Estimate.
    </p>
    
    <p style="margin-top: 20px;">
      &copy; ${new Date().getFullYear()} First Access Lending. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;
}
