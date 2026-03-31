# Future Work - Quote App

## Stage 3: Post-Submission Features

### Consumer Debt Integration
- **Credit pull integration** - After soft pull, read consumer debts from credit report
- **Debt payoff selection** - Present list of debts to borrower, let them choose which to pay off with loan proceeds
- **Payment impact** - Show how paying off selected debts changes their DTI and available amount
- **Mortgage account assignment** - List out their mortgage/tradeline accounts from credit report and have them assign each to the properties listed in the REO (Other Properties) section
  - This connects credit liabilities to the property addresses for accurate CLTV/DTI calculations
  - Enables automatic REO schedule population for 1003
  - Borrower confirms which mortgage belongs to which property (credit report doesn't always have clean address matching)

### AVM Integration
- HouseCanary vs CoreLogic vs Quantarium (vendor selection pending)
- Auto-populate property value from AVM, show confidence score
- Allow override with stated value

### Credit API
- Birchwood credit API (docs requested, awaiting response)
- Soft pull at Stage 2 submission
- Hard pull only after borrower consent

### Title API
- ValuTrust staging creds (pending)
- Title search automation

### Auth & Session
- Supabase + Upstash + Twilio OTP flow
- Server-side session storage (replace localStorage)
- Save/resume application across devices

### Submission Pipeline
- API route to create Encompass loan from Stage 2 data
- Map form fields to 1003 schema
- n8n workflow for post-submission automation

## Testing Cleanup (Before Launch)

### Re-enable Security/Privacy Controls
- **localStorage clearing** - Re-enable localStorage clearing on submit (stage2/page.tsx lines 491-492)
  - Currently disabled for faster testing iterations
  - Must be re-enabled to prevent resubmission and protect user data
  - Location: `src/app/quote/stage2/page.tsx`
