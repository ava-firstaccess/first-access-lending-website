# Mortgage Calculator Update - March 16, 2026

## New Features

### 1. State Income Tax Calculation
- **State Selector:** Dropdown with all 50 states + DC
- **State Tax Rates:** Simplified marginal rates for each state
- **No Income Tax States:** Clearly labeled (AK, FL, NV, NH, SD, TN, TX, WA, WY)
- **Estimated Rate Display:** Shows marginal state tax rate when state is selected

### 2. SALT Cap Implementation
- **$10,000 Federal Limit:** State & Local Tax (SALT) deduction capped at $10,000
- **Combined Calculation:** State income tax + property tax, capped at $10k
- **Accurate Tax Savings:** Reflects real-world federal tax law

### 3. PMI Calculation & Deductibility
- **Automatic PMI:** Triggered when down payment < 20%
- **Rate:** 0.5% annually (standard estimate)
- **Deductibility Rules:**
  - Deductible if AGI < $100,000
  - Not deductible if AGI ≥ $100,000
  - Shows in breakdown only when applicable

### 4. Expandable Deduction Breakdown
**Click to expand "Total Itemized Deductions"** to see:
- Mortgage Interest (Year 1)
- State Income Tax Paid
- Property Taxes (Annual)
- **SALT Deduction (capped)** - Shows combined state/local tax up to $10k cap
- PMI (if applicable)
- Helpful notes about SALT cap and PMI deductibility

### 5. Enhanced PDF Report
- Includes all new fields in email PDF
- Deduction breakdown section with clear formatting
- Updated disclaimer covering state tax estimates and SALT cap
- Professional styling with itemized breakdown table

## Tax Calculation Logic

### Total Deductions Formula
```
State Income Tax = AGI × State Tax Rate
SALT Deduction = MIN($10,000, State Income Tax + Annual Property Tax)
PMI Deduction = IF(AGI < $100k AND has PMI, Annual PMI, $0)
Total Itemized Deductions = Mortgage Interest + SALT Deduction + PMI Deduction
```

### Tax Savings Formula
```
IF Total Itemized > Standard Deduction:
  Tax Savings = (Total Itemized - Standard Deduction) × Federal Marginal Rate
ELSE:
  Tax Savings = $0
```

## State Tax Rates (2025 Estimates)

Rates are simplified marginal rates for typical income levels:

**Highest Rates:**
- California: 9.3%
- New York: 10.9%
- New Jersey: 10.75%
- Hawaii: 11%
- Minnesota: 9.85%

**No Income Tax:**
- Alaska, Florida, Nevada, New Hampshire, South Dakota, Tennessee, Texas, Washington, Wyoming

## Example Scenario

**Loan Details:**
- Home Price: $600,000
- Down Payment: $90,000 (15% - triggers PMI)
- Interest Rate: 7%
- Loan Term: 30 years
- Property Tax Rate: 1.5%

**Tax Info:**
- State: California
- Filing: Married
- AGI: $180,000

**Results:**
- Monthly Payment: ~$4,600 (including PMI)
- Mortgage Interest (Year 1): ~$35,280
- State Income Tax Paid: ~$16,740
- Property Tax: $9,000
- **SALT Deduction:** $10,000 (capped, even though state+property = $25,740)
- PMI: Not deductible (AGI > $100k)
- **Total Deductions:** $45,280
- **Tax Savings:** ~$3,860/year ($322/month)
- **Effective Payment:** ~$4,278/month

## Technical Implementation

### Files Modified
1. `src/app/calculator/page.tsx` - Main calculator component
   - Added state selector
   - Added state tax calculation
   - Added PMI logic
   - Added expandable breakdown UI
   - Updated all calculations

2. `src/app/api/calculator-pdf/route.ts` - PDF generation
   - Added new fields to PDF
   - Deduction breakdown table
   - Enhanced disclaimer

### New State Variables
- `state` - Selected state code (CA, NY, etc.)
- `showDeductionBreakdown` - Toggle for expandable section
- `stateIncomeTaxPaid` - Calculated state tax
- `saltDeduction` - SALT cap calculation
- `year1PMI` - Annual PMI for deduction

### Constants Added
- `STATE_TAX_RATES` - Object mapping state codes to marginal rates
- `US_STATES` - Array of state codes and names for dropdown

## Testing Checklist

Test scenarios to verify:

- [ ] State selector shows all 50 states + DC
- [ ] No-income-tax states labeled correctly
- [ ] SALT cap enforces $10,000 limit
- [ ] PMI appears when down payment < 20%
- [ ] PMI deductible only when AGI < $100k
- [ ] Deduction breakdown expands/collapses
- [ ] PDF includes all new fields
- [ ] High-income state (CA, NY) vs low/no-income state (TX, FL)
- [ ] Edge case: State + property tax exactly $10,000
- [ ] Edge case: AGI exactly $100,000

## Future Enhancements (Optional)

1. **Progressive State Tax Brackets**
   - Currently uses single marginal rate per state
   - Could implement full bracket calculations like federal

2. **AMT Consideration**
   - Alternative Minimum Tax can limit deductions
   - Would require more complex calculation

3. **Itemized Deduction Phase-outs**
   - High-income limits on some deductions
   - Pease limitation (currently suspended but may return)

4. **Other Itemized Deductions**
   - Charitable contributions
   - Medical expenses (if > 7.5% AGI)
   - Other deductible items

## Deployment

**Committed:** d56ba30  
**Branch:** main  
**Ready to Deploy:** Yes (push to GitHub triggers Vercel auto-deploy)

**Test URL (local):** http://localhost:3000/calculator  
**Production URL:** https://firstaccesslending.com/calculator

---

**Updated:** March 16, 2026  
**By:** Ava (AI Assistant)
