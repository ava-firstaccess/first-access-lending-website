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

### MeridianLink Proxy Handoff to VPS
- Keep the app calling the proxy, not MeridianLink directly.
- The VPS relay is now live and approved Bill prod-test works through it.
- Replace the temporary `sslip.io` hostname with a real company domain/subdomain.
- Point DNS for that hostname at the VPS public IP.
- Issue a real TLS certificate for the hostname and remove the temporary pinned cert.
- Keep the proxy on HTTPS 443 with the same auth/header contract.
- Keep MeridianLink IP whitelist tied to the VPS public IP, not Vercel.
- Leave the Mac relay only as a fallback/test path, not production.

### Title API
- ValuTrust staging creds (pending)
- Title search automation

### Auth & Session
- Migrate OTP/auth throttling from Supabase-backed rate limiting to Redis (prefer Upstash Redis) if auth traffic, abuse volume, latency, or DB write load grows enough that the current RPC/database approach becomes noisy or expensive.
- Supabase + Upstash + Twilio OTP flow
- Server-side session storage (replace localStorage)
- Save/resume application across devices
- Add a hard password wall to `/pricer` before any pricer UI or API data is exposed
- When `/pricer` moves to `getaccess.firstaccesslending.com` (name pending), update all host/domain-specific security rules and routing to include the new hostname. At minimum, review middleware host gating, authenticated-origin allowlists, any pricer-only allowed path lists, env/docs that mention `pricer.firstaccesslending.com`, and any share links or canonical URLs.
- Put `/pricer` behind authenticated user login
- Require 2FA for `/pricer` access
- Remove public exposure of investor names from `/pricer` and its API responses
- Public quote endpoints and results pages should return/display rate-only data, not investor or program names. Keep investor selection server-side only.
- If the current Supabase-backed OTP rate limiting becomes too heavy or too chatty, move rate limiting to **Upstash Redis** as the preferred dedicated managed rate-limit layer for `send-otp` and `verify-otp` across all app instances.

### Submission Pipeline
- API route to create Encompass loan from Stage 2 data
- Map form fields to 1003 schema
- n8n workflow for post-submission automation

## Duplicate Management (Comprehensive System)

**Current State (MVP):**
- Always creates new opportunity on each submission
- Marks previous opportunity as duplicate (moves to "Duplicate" stage in same pipeline)
- Adds note with new opportunity ID and date
- Simple, prevents data loss, preserves source tracking

**Needed for Production:**

### Contact-Level Deduplication
- **Phone normalization** - Standardize format before search (+1 prefix, area code handling)
  - Strip all non-digits, handle international formats
  - Convert to E.164 format for consistent storage
  - Search variations: with/without +1, with/without country code
- **Email fuzzy matching** - Handle typos, case variations, plus addressing
  - Lowercase comparison
  - Strip gmail dots (john.doe@gmail.com = johndoe@gmail.com)
  - Handle plus addressing (user+tag@domain.com → user@domain.com)
- **Multi-field matching** - Combine signals for confidence score
  - Phone + email = 100% match
  - Phone + name = high confidence
  - Email + address = high confidence
  - Name only = low confidence (manual review)

### Opportunity-Level Deduplication
- **Submission timing** - Flag rapid resubmissions (< 24 hours apart)
  - Could be testing, browser back button, legitimate update
  - Show diff of changed fields
  - "Resume existing" vs "Start fresh" decision tree
- **Data comparison** - Detect meaningful changes vs noise
  - Track which fields changed between submissions
  - Highlight property value/loan amount changes (material updates)
  - Ignore timestamp/session metadata
- **Merge strategy** - When to update vs create new
  - If < 1 hour: likely duplicate tab, merge
  - If 1-24 hours: likely testing/refinement, ask user
  - If > 24 hours: likely new intent, create new (mark old as duplicate)
  - If different product type: always create new

### Manual Review Tools
- **Duplicate dashboard** - Admin UI to review flagged duplicates
  - Side-by-side comparison
  - Merge action (choose winning record, migrate notes/tasks)
  - Split action (false positive, unmark as duplicate)
- **Auto-merge rules** - Configurable thresholds
  - Phone + email + same product + < 1 hour = auto-merge
  - Everything else = flag for review

### Pipeline-Specific Rules
- **"Coming Soon" pipeline** - Currently has no Duplicate stage
  - Add Duplicate stage to all pipelines
  - Or define fallback behavior (leave in current stage, add tag)
- **Source preservation** - When marking as duplicate, preserve:
  - Original pipeline (don't move to Get Access)
  - Original assigned user
  - Original source tags (Bankrate, direct, etc.)
  - Only change stage within existing pipeline

### Technical Implementation
- **Duplicate detection API endpoint** - Check before submit
  - Returns: confidence score, matched contacts, suggested action
  - Client can show "Resume existing application?" prompt
- **Supabase dedup table** - Track all submission attempts
  - Link multiple submissions to same "lead cluster"
  - Audit trail: who submitted when, what changed
- **Background job** - Nightly scan for undetected duplicates
  - Find contacts with multiple open opportunities
  - Flag for manual review
  - ML scoring based on field similarity

### Data Quality
- **Phone validation** - Verify format before creating contact
  - Twilio Lookup API (verify number is real)
  - Prevent fake numbers (555-555-5555)
- **Email validation** - Check deliverability
  - Syntax check (RFC 5322)
  - MX record verification
  - Disposable email detection (no tempmail.com)
- **Address standardization** - USPS validation
  - Geocode to lat/long for proximity matching
  - Detect PO boxes (flag for manual review)

### Reporting & Analytics
- **Duplicate rate tracking** - Monitor over time
  - By source (Bankrate vs direct)
  - By time of day (late night = testing?)
  - By user agent (mobile vs desktop)
- **Conversion impact** - How duplicates affect funnel
  - Do people who resubmit convert better?
  - How long between submissions?
  - What fields change most often?

## Compliance

### Cookie Warning / Privacy Banner
- Add cookie consent banner (GDPR/CCPA compliance)
- Audit current cookie usage (analytics, session, tracking)
- Implement opt-in/opt-out controls
- Privacy policy link in banner
- Check state-specific requirements (California CCPA, Virginia VCDPA, etc.)

## Testing Cleanup (Before Launch)

### Re-enable Security/Privacy Controls
- **localStorage clearing** - Re-enable localStorage clearing on submit (stage2/page.tsx lines 491-492)
  - Currently disabled for faster testing iterations
  - Must be re-enabled to prevent resubmission and protect user data
  - Location: `src/app/quote/stage2/page.tsx`

### API Cleanup
- **GHL User-Agent header** - Change from `n8n` to `FirstAccessLending-WebApp/1.0`
  - Currently using "n8n" to bypass Cloudflare filtering (temporary workaround)
  - Should use custom branded User-Agent for production
  - Location: `src/app/api/submit/route.ts` line 318
  - Alternative: `Mozilla/5.0 (compatible; FirstAccessLending/1.0)`

- **GHL Conversations scope** - Add note when marking opportunities as duplicates
  - Currently only moves old opportunity to Duplicate stage
  - Need to add API scope: `conversations.write` or `conversations.message.write`
  - Will enable automatic note: "Marked as duplicate - new submission on {date}. New opportunity: {id}"
  - Code ready (commented out in `markAsDuplicate` function)
  - Location: `src/app/api/submit/route.ts` line ~575
