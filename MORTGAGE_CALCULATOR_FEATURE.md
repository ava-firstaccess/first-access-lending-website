# Mortgage Calculator with Tax Savings - Feature Documentation

## Overview
Built a comprehensive mortgage payment calculator with integrated tax savings analysis for the First Access Lending website. The calculator helps potential borrowers understand their monthly payments AND the tax benefits of homeownership.

## Live URL
Once deployed: **https://firstaccesslending.com/calculator**

## Key Features

### 1. Mortgage Payment Calculation
- **Inputs:**
  - Home price
  - Down payment (with automatic % calculation)
  - Interest rate (variable)
  - Loan term (15, 20, or 30 years)
  - Property tax rate (% per year)
  - Annual home insurance
  - Monthly HOA fees (optional)

- **Outputs:**
  - Monthly Principal & Interest (P&I)
  - Monthly property taxes
  - Monthly insurance
  - Monthly HOA
  - **Total Monthly Payment**

### 2. Tax Savings Toggle (NEW!)
When enabled, asks for:
- Filing status (Single or Married Filing Jointly)
- Adjusted Gross Income (AGI) or Total W-2 Income

**Calculates:**
- Marginal federal tax bracket (2025 brackets)
- Year 1 mortgage interest deduction
- Annual property tax deduction
- Total itemized deductions vs standard deduction
- **Annual tax savings**
- **Monthly tax savings**
- **Effective monthly payment** (after tax benefit)

### 3. Email PDF Delivery
- Email capture field
- Sends professionally branded PDF report via email
- Uses existing First Access Lending email infrastructure
- PDF includes:
  - Full loan details
  - Monthly payment breakdown
  - Tax savings analysis (if enabled)
  - First Access Lending branding
  - Contact information
  - Professional disclaimer

### 4. Navigation Integration
- Added "Calculator" link to main navigation (desktop + mobile)
- Positioned between "Products" and "About"
- Consistent styling with existing nav

## Technical Implementation

### Files Created/Modified

**New Pages:**
- `src/app/calculator/page.tsx` - Main calculator component (929 lines)

**New API Routes:**
- `src/app/api/calculator-pdf/route.ts` - PDF HTML generation
- `src/app/api/send-email/route.ts` - Email delivery via send-email.sh

**Modified:**
- `src/components/Header.tsx` - Added calculator nav link

### Tax Calculation Logic

**2025 Federal Tax Brackets Included:**
- Single filers: 7 brackets (10% to 37%)
- Married filing jointly: 7 brackets (10% to 37%)
- Standard deduction: $14,600 (single), $29,200 (married)

**Tax Savings Formula:**
```
Year 1 Interest = Sum of first 12 months' interest payments
Annual Property Tax = Monthly property tax × 12
Total Deductions = Year 1 Interest + Annual Property Tax

IF Total Deductions > Standard Deduction:
  Tax Savings = (Total Deductions - Standard Deduction) × Marginal Tax Rate
ELSE:
  Tax Savings = $0 (itemizing doesn't provide benefit)
```

**Marginal Tax Rate Determination:**
- Uses AGI to determine which tax bracket user falls into
- Returns marginal rate (not effective rate)
- Correctly handles bracket thresholds

### Mortgage Calculation Formula
Standard amortization formula:
```
Monthly P&I = P × [r(1+r)^n] / [(1+r)^n - 1]

Where:
P = Principal (loan amount)
r = Monthly interest rate (annual rate / 12)
n = Number of payments (years × 12)
```

## Deployment

### Automatic Deployment (Vercel)
Since the repo is connected to Vercel, the changes will auto-deploy when pushed to main.

**Deployment Status:**
- ✅ Committed to main branch (commit 1be1fb1)
- ✅ Pushed to GitHub
- ⏳ Vercel auto-deploy triggered
- Check: https://vercel.com/dashboard

### Manual Deployment (if needed)
```bash
cd ~/Documents/GitHub/first-access-lending-website
npm run build
vercel --prod
```

## Testing Checklist

Once deployed, verify:

- [ ] Calculator page loads at /calculator
- [ ] All inputs work correctly
- [ ] Monthly payment calculates accurately
- [ ] Tax savings toggle shows/hides tax inputs
- [ ] Tax bracket calculation is correct
- [ ] Email capture field validates email format
- [ ] PDF email sends successfully
- [ ] PDF contains correct calculations and branding
- [ ] Calculator link appears in navigation
- [ ] Mobile responsive design works
- [ ] Disclaimer text is visible

## Example Calculations

### Test Case 1: No Tax Benefit
- Home Price: $300,000
- Down Payment: $60,000 (20%)
- Interest Rate: 6.5%
- Loan Term: 30 years
- Property Tax Rate: 1.2%
- Insurance: $1,200/year
- HOA: $0
- **Result:** ~$1,516/month P&I + $300 taxes + $100 insurance = **$1,916/month**

With Tax Savings:
- Filing: Married
- AGI: $80,000
- Tax Bracket: 12%
- Year 1 Interest: ~$15,480
- Property Tax: $3,600
- Total Deductions: $19,080
- Standard Deduction: $29,200
- **Tax Savings: $0** (standard deduction is better)

### Test Case 2: Tax Benefit
- Home Price: $600,000
- Down Payment: $120,000 (20%)
- Interest Rate: 7%
- Loan Term: 30 years
- Property Tax Rate: 1.5%
- Insurance: $2,400/year
- HOA: $200/month
- **Result:** ~$3,193/month P&I + $750 taxes + $200 insurance + $200 HOA = **$4,343/month**

With Tax Savings:
- Filing: Married
- AGI: $200,000
- Tax Bracket: 24%
- Year 1 Interest: ~$33,360
- Property Tax: $9,000
- Total Deductions: $42,360
- Standard Deduction: $29,200
- Additional Benefit: $13,160
- **Tax Savings: $3,158/year** ($263/month)
- **Effective Payment: $4,080/month** (5.9% reduction)

## Email Infrastructure

Uses existing First Access Lending email system:
- Sends from: ava@fal.firstaccesslending.com
- Reply-to: info@firstaccesslending.com
- Script: `/Users/ava/.openclaw/workspace/send-email.sh`
- Enforcement: Email allowlist, oversight controls

**Important:** Email will only send to allowed recipients (configured in allowlist). For production, may need to add recipient email validation or allowlist expansion.

## Future Enhancements (Optional)

1. **Add Charts:**
   - Amortization schedule visualization
   - Tax savings breakdown chart
   - Payment composition pie chart

2. **Compare Scenarios:**
   - Side-by-side comparison of different down payments
   - Rate comparison (current vs potential future rate)

3. **Additional Tax Considerations:**
   - State tax calculations
   - AMT considerations
   - SALT deduction cap ($10,000 limit)
   - PMI deduction (if applicable)

4. **Save/Share:**
   - Generate shareable link to calculation
   - Save calculation to user account (requires auth)

5. **Integration with CRM:**
   - Capture lead in GoHighLevel
   - Track calculator usage analytics
   - A/B test different calculator layouts

## Notes

- Tax calculations are estimates only - disclaimer included
- 2025 tax brackets used (update annually)
- Standard deduction amounts are for 2025 (update annually)
- Tax law changes may affect calculation accuracy
- Encourages users to consult tax professional
- Calculator does NOT include:
  - State income tax benefits
  - AMT considerations
  - SALT cap limits
  - PMI calculations
  - Closing costs
  - Points/fees

## Support

If email sending fails:
1. Check send-email.sh script is executable
2. Verify email allowlist includes recipient
3. Check Vercel environment variables (if any needed)
4. Review API route logs in Vercel dashboard

For calculation questions:
- Mortgage formula is standard amortization
- Tax brackets from IRS 2025 tax tables
- Standard deduction from IRS 2025 amounts

## Deployment Complete

**Status:** ✅ Pushed to GitHub (commit 1be1fb1)
**Next:** Vercel will auto-deploy to production
**URL:** https://firstaccesslending.com/calculator

---

**Built:** March 15, 2026
**By:** Ava (AI Assistant for First Access Lending)
