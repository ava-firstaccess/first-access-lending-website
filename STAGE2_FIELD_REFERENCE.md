# Stage 2 Field Reference

Complete mapping of all form fields in Stage 2, organized by section.

---

## Section 1: Borrower Information

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Borrower - First Name | Text | Yes | No |
| Borrower - Last Name | Text | Yes | No |
| Borrower - Phone | Tel | Yes | No |
| Borrower - Email | Email | Yes | No |
| Borrower - Date of Birth | Date | Yes | No |
| Borrower - SSN | SSN | Yes | No |
| Borrower - Citizenship Status | Dropdown | Yes | No |
| Borrower - Has Co-Borrower | Radio (Y/N) | Yes | No |

**Options:**
- Citizenship: US Citizen, Permanent Resident, Non-Permanent Resident

---

## Section 2: Co-Borrower (Conditional)

**Visibility:** Only shows if "Borrower - Has Co-Borrower" = Yes

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Co-Borrower - First Name | Text | Yes | Yes (Rule 2) |
| Co-Borrower - Last Name | Text | Yes | Yes (Rule 2) |
| Co-Borrower - Phone | Tel | Yes | Yes (Rule 2) |
| Co-Borrower - Email | Email | Yes | Yes (Rule 2) |
| Co-Borrower - Employment Status | Dropdown | Yes | Yes (Rule 2) |

**Options:**
- Employment Status: Employed, Self-Employed, Retired, Not Employed

---

## Section 3: Current Residence

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Borrower - Housing Ownership Type | Dropdown | Yes | No |
| Borrower - Current Address Line 1 | Text | Yes | No |
| Borrower - Current Address City | Text | Yes | No |
| Borrower - Current Address State | Dropdown | Yes | No |
| Borrower - Current Address Zip | Text | Yes | No |
| Borrower - Years in Current Home | Number | Yes | No |
| Borrower - Months in Current Home | Number | Yes | No |

**Options:**
- Housing Type: Own, Rent, Living Rent Free
- State: CA, NY, TX, FL (TODO: add all 50 states)

**Validation:**
- Months: 0-11
- Years: 0-99

---

## Section 4: Subject Property

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Present Address Same as Subject Property | Radio (Y/N) | Yes | No |
| Subject Property - Occupancy | Dropdown | Yes | No |
| Subject Property - Units | Number | Yes | No |
| Subject Property - Structure Type | Dropdown | Yes | No |
| Stated Property Value | Currency | Yes | No |
| Listed For Sale (Last 6 Months) | Radio (Y/N) | Yes | No |

**Options:**
- Occupancy: Primary Residence, Second Home, Investment Property
- Structure: Single Family, Condo, Townhouse, Multi-Family
- Units: 1-4

---

## Section 5: Title & Vesting

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Title - Current Title Held As | Dropdown | Yes | No |
| Title - Will Be Held As | Dropdown | Yes | No |

**Options:**
- Sole Ownership
- Joint Tenants
- Tenants in Common
- Community Property

---

## Section 6: Current Loan Details

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Current Loan - Free & Clear | Radio (Y/N) | Yes | No |
| Current Loan - First Mortgage Balance | Currency | No | Yes (Rule 52) |
| Current Loan - Monthly Payment | Currency | No | Yes (Rule 52) |
| Current Loan - Type | Dropdown | No | Yes (Rule 52) |
| Current Loan - Term (Months) | Number | No | Yes (Rule 52) |
| Current Loan - Interest Rate (%) | Number | No | Yes (Rule 52) |
| Current Loan - Rate Type | Dropdown | No | Yes (Rule 52) |
| Current Loan - Mortgage Insurance Present | Radio (Y/N) | No | Yes (Rule 52) |
| Current Loan - Escrowed | Radio (Y/N) | No | Yes (Rule 52) |
| Current Loan - Pay HOA | Radio (Y/N) | No | Yes (Rule 52) |
| Current Loan - HOA Dues | Currency | No | Yes (Rule 9, 53) |
| Second Mortgage - Present | Radio (Y/N) | No | Yes (Rule 52) |

**Options:**
- Loan Type: Conventional, FHA, VA, USDA
- Rate Type: Fixed, ARM

**Conditional Logic:**
- All fields except "Free & Clear" hide when "Free & Clear" = Yes (Rule 52)
- "HOA Dues" shows only when "Pay HOA" = Yes (Rule 9)

---

## Section 7: Second Mortgage (Conditional)

**Visibility:** Only shows if "Second Mortgage - Present" = Yes

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Second Mortgage - Balance | Currency | Yes | Yes (Rule 3) |
| Second Mortgage - Monthly Payment | Currency | Yes | Yes (Rule 3) |
| Second Mortgage - Type | Dropdown | Yes | Yes (Rule 3) |
| Second Mortgage - Interest Rate (%) | Number | Yes | Yes (Rule 3) |

**Options:**
- Type: HELOC, Home Equity Loan (Closed-End)

---

## Section 8: Other Properties

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Owns Other Properties | Radio (Y/N) | Yes | No |
| Number of Other Properties | Number | No | Yes* |
| Other Properties - Notes | Textarea | No | Yes* |

**Conditional Logic:**
- "Number of Other Properties" and "Notes" only show when "Owns Other Properties" = Yes
- Rules 12-16 control visibility of additional property address fields (not fully implemented)

---

## Section 9: Employment & Income

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Borrower - Employment Status | Dropdown | Yes | No |
| Borrower - Base Monthly Income | Currency | No | No |

**Options:**
- Employment Status: Employed, Self-Employed, Retired, Not Employed

**Note:** Additional employment fields (employer name, years, etc.) are defined in Rules 17-27 but not yet implemented in the UI.

---

## Section 10: Assets

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Assets - Account Type | Dropdown | Yes | No |
| Assets - Checking/Savings Total | Currency | Yes | No |
| Assets - Retirement Total | Currency | Yes | No |
| Assets - Cash Left Over | Currency | No | No |

**Options:**
- Account Type: Checking, Savings, Both Checking & Savings

---

## Section 11: Declarations

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Dec - Judgments / Federal Debt / Delinquent | Radio (Y/N) | Yes | No |
| Dec - Bankruptcy / Short Sale / Foreclosure | Radio (Y/N) | Yes | No |
| Dec - Ownership Interest Last 3 Years | Radio (Y/N) | Yes | No |
| Dec - Primary Residence Last 3 Years | Radio (Y/N) | Yes | No |
| Dec - Family/Business Relationship | Radio (Y/N) | Yes | No |

**Conditional Logic:**
- Rules 40-42 define additional detail fields when "Yes" is selected (not fully implemented)

---

## Section 12: Demographics (Optional)

| Field Name | Type | Required | Conditional |
|------------|------|----------|-------------|
| Dem - Borrower Ethnicity | Dropdown | No | No |
| Dem - Borrower Sex | Dropdown | No | No |
| Dem - Borrower Race | Dropdown | No | No |

**Options:**
- Ethnicity: Hispanic or Latino, Not Hispanic or Latino, I do not wish to provide
- Sex: Male, Female, I do not wish to provide
- Race: American Indian or Alaska Native, Asian, Black or African American, Native Hawaiian or Other Pacific Islander, White, I do not wish to provide

**Note:** Co-borrower demographics fields are defined in the rules but not yet implemented in the UI.

---

## Visibility Rules Summary

| Rule # | Trigger Field | Action | Target Fields | Count |
|--------|---------------|--------|---------------|-------|
| 1 | Borrower - Has Co-Borrower = No/Empty | Hide | Co-Borrower Demographics | 3 |
| 2 | Borrower - Has Co-Borrower = Yes | Show | Co-Borrower Info | 11 |
| 3 | Second Mortgage - Present = Yes | Show | Second Mortgage Details | 4 |
| 4 | Second Mortgage - Present = No/Empty | Hide | Second Mortgage Details | 4 |
| 5 | Housing Type = Rent | Hide | Current Loan Fields | 13 |
| 6-7 | MI Present = Yes | Show | MI Amount | 1 |
| 8 | Escrowed = No | Show | Annual Taxes/HOI | 2 |
| 9 | Pay HOA = Yes | Show | HOA Dues | 1 |
| 52 | Free & Clear = Yes | Hide | All Loan Fields | 8 |
| ... | (60 rules total) | | | |

**Full Rules:** See `src/data/dynamic_form_rules.json`

---

## Data Flow

1. **Import:** Stage 1 data loaded via URL search params
2. **State:** All form data stored in React state
3. **Persistence:** Auto-saved to localStorage every 500ms
4. **Visibility:** Conditional engine evaluates rules on every state change
5. **Validation:** Section completion checked before allowing checkmark
6. **Submit:** Form data logged to console (API integration pending)

---

## Field Naming Convention

All field names follow the pattern from the visibility rules JSON:
- `[Entity] - [Field Name]`
- Examples: `Borrower - First Name`, `Current Loan - Type`, `Dec - Bankruptcy`

This ensures exact matching with the 60 visibility rules.

---

**Total Fields:** 80+ fields across 12 sections  
**Conditional Fields:** ~40 fields with show/hide logic  
**Required Fields:** ~30 fields marked as required  
**Optional Fields:** ~50 fields (demographics, additional details)
