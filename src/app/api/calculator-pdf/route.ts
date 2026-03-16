import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const {
      email,
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
      totalMonthlyPayment,
      showTaxSavings,
      filingStatus,
      agi,
      year1Interest,
      year1PropertyTax,
      marginalTaxRate,
      taxSavings,
      effectiveMonthlyPayment,
    } = data;

    // Generate HTML for PDF
    const htmlContent = generatePDFHTML(data);

    // Send email using the existing email infrastructure
    const emailResponse = await fetch(process.env.EMAIL_API_URL || 'http://localhost:3000/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
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
    totalMonthlyPayment,
    showTaxSavings,
    filingStatus,
    agi,
    year1Interest,
    year1PropertyTax,
    marginalTaxRate,
    taxSavings,
    effectiveMonthlyPayment,
  } = data;

  const fmt = (num: number) => `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  const fmtInt = (num: number) => `$${num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

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
    .tax-savings h3 {
      color: #15803d;
      margin-top: 0;
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
      <td>Home Price</td>
      <td>${fmtInt(homePrice)}</td>
    </tr>
    <tr>
      <td>Down Payment (${((downPayment/homePrice)*100).toFixed(1)}%)</td>
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
        <td>Adjusted Gross Income</td>
        <td>${fmtInt(agi)}</td>
      </tr>
      <tr>
        <td>Your Tax Bracket</td>
        <td>${(marginalTaxRate * 100).toFixed(0)}%</td>
      </tr>
      <tr>
        <td>Year 1 Mortgage Interest</td>
        <td>${fmtInt(year1Interest)}</td>
      </tr>
      <tr>
        <td>Annual Property Taxes</td>
        <td>${fmtInt(year1PropertyTax)}</td>
      </tr>
      <tr>
        <td>Total Deductions</td>
        <td>${fmtInt(year1Interest + year1PropertyTax)}</td>
      </tr>
    </table>

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
        After tax savings (${((taxSavings/12)/totalMonthlyPayment*100).toFixed(1)}% reduction)
      </p>
    </div>
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
    <p>
      <strong>Disclaimer:</strong> This calculator provides estimates only and should not be considered financial or tax advice. 
      Actual payments and tax savings may vary based on individual circumstances, loan terms, and applicable tax laws. 
      Tax benefits depend on itemizing deductions and may change with tax law updates. Please consult with a qualified 
      tax professional for personalized advice. Contact First Access Lending for an accurate loan quote.
    </p>
    <p style="margin-top: 20px;">
      &copy; ${new Date().getFullYear()} First Access Lending. All rights reserved.
    </p>
  </div>
</body>
</html>
  `;
}
