# Website Security Implementations and Audit Status

**Project:** `first-access-lending-website`  
**Original audit date:** 2026-04-24  
**Updated through:** 2026-05-01  
**Purpose:** Comprehensive handoff of website security controls currently in place, including both the original 2026-04-24 hardening pass and the follow-up production/security cleanup completed through 2026-04-27.

---

# Executive summary

The website now has a materially stronger security baseline than it had before the 2026-04-24 review, and the follow-up hardening through 2026-04-27 closed several of the remaining obvious gaps.

The most important controls now in place are:
- preview-site gating on Vercel-hosted environments
- loan-officer host gating for pricer and AVM
- OTP-based application authentication
- server-side authenticated application lookups
- trusted-browser / origin checks on sensitive routes
- hashed OTP storage
- hashed application session tokens at rest
- short-lived application sessions with expiry enforcement
- sanitized persistence of application form data in Supabase
- removal of unauthenticated testing bypasses from paid/sensitive routes
- rate limiting on OTP, AVM, soft credit, and submission flows
- reduced raw provider error leakage in HouseCanary, MeridianLink relay, SMS webhook, GHL, Resend, and supporting helper layers
- reduced raw exception/error-object logging across hardened API surfaces
- hot-storage minimization for `meridianlink_runs`, including removal of borrower names and raw provider error text
- operational retention planning for AVM and MeridianLink logs, with follow-up architecture documented for archive-before-purge

Important production status as of 2026-04-27:
- `supabase/migrations/009_session_token_hash.sql` has been applied in live Supabase
- `supabase/migrations/011_minimize_meridianlink_runs_hot_storage.sql` has been applied in live Supabase
- `supabase/migrations/010_operational_table_retention.sql` is still intentionally not the final retention policy and should not be treated as production truth

The main remaining substantive security/workflow item after this update is:
- MeridianLink XML-processing / debug-path redesign, so the next XML workstream can support operational parsing and testing without re-expanding raw upstream exposure in browser/API responses

---

# 1. Security controls that were already in place before this audit

## 1.1 Vercel preview/site-access gate

**Files:**
- `middleware.ts`
- `src/lib/site-access.ts`
- `src/app/api/site-access-auth/route.ts`

**What it does:**
- blocks access to Vercel project hosts unless a site-access cookie is present
- allows only a small set of preview-gate paths when the cookie is missing
- returns `404` for blocked API access on preview environments instead of exposing the APIs
- uses `httpOnly` cookie storage for the preview-site unlock cookie

**Notes:**
- this is useful for limiting accidental public exposure of preview deployments
- token implementation is simple, cookie value equals configured password, so this is more of a controlled preview gate than a high-assurance auth system

## 1.2 Loan Officer portal gating for pricer and AVM

**Files:**
- `middleware.ts`
- `src/lib/lo-portal-auth.ts`
- `src/app/login/page.tsx`
- `src/app/pricer/page.tsx`
- `src/app/avm/page.tsx`
- `src/app/api/lo-auth/bootstrap-session/route.ts`
- `src/app/api/pricer-stage1-pricing/route.ts`
- `src/app/api/lo-avm/order/route.ts`

**What it does:**
- constrains the loan-officer surface to `lo.firstaccesslending.com`
- allows only approved loan-officer paths on that host
- blocks unrelated API discovery on the LO host with `404`
- requires loan-officer session auth before `/pricer`, `/avm`, and related APIs can be used
- supports trusted-browser bootstrap for smoother re-entry
- keeps pricer and AVM functionality behind the same LO portal boundary

**Notes:**
- the old standalone `pricer.firstaccesslending.com` password wall has been retired
- the active security boundary is now the LO portal host plus route-level session enforcement

## 1.3 OTP application auth flow

**Files:**
- `src/app/api/auth/send-otp/route.ts`
- `src/app/api/auth/verify-otp/route.ts`
- `src/lib/otp.ts`
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/007_application_session_expiry.sql`
- `supabase/migrations/008_auth_rate_limits.sql`

**What it does:**
- issues OTPs by phone
- verifies OTPs before creating or resuming an application session
- sets `session_token` in an `httpOnly` cookie
- stores OTP rows in Supabase
- limits OTP lifetime to 5 minutes
- tracks OTP attempts and invalidates codes on expiry or max-attempt condition

## 1.4 Supabase-backed rate limit infrastructure

**Files:**
- `src/lib/rate-limit.ts`
- `supabase/migrations/008_auth_rate_limits.sql`

**What it does:**
- durable rate limiting across app instances using `auth_rate_limits`
- database function `consume_auth_rate_limit(...)`
- originally used for OTP send/verify

## 1.5 Application-session model

**Files:**
- `src/lib/application-session.ts`
- `supabase/migrations/007_application_session_expiry.sql`

**What it does:**
- keeps application access behind a server-side session lookup
- expires sessions after a short TTL
- clears expired sessions from `applications`
- returns a standardized `401` response and clears stale cookie when session is invalid

## 1.6 Supabase RLS and service-role-only patterns

**Files:**
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/003_analytics_and_anonymous_tracking.sql`
- `supabase/migrations/004_meridianlink_runs.sql`
- `supabase/migrations/005_avm_cache_application_id.sql`
- `supabase/migrations/006_backfill_meridianlink_runs_columns.sql`
- `supabase/migrations/008_auth_rate_limits.sql`

**What it does:**
- enables RLS on core tables
- provides service-role full access policies for app server operations

**Notes:**
- these are not end-user query surfaces, so the app is relying on server-side service-role access instead of client-side direct DB access

---

# 2. Security hardening completed during the 2026-04-24 audit

The audit was intentionally done one step at a time. Each step was reviewed, patched, build-verified, and pushed before moving to the next one.

## 2.1 Provider result exposure tightening

**Commit:** `f983e3c`  
**Message:** `Reduce provider result exposure`

**Primary files changed:**
- `src/lib/meridianlink-credit.ts`
- `src/app/api/credit/softpull/route.ts`
- `scripts/meridianlink-proxy-server.mjs`

**What was fixed:**
- removed raw upstream MeridianLink body slices from thrown app-side errors
- removed unnecessary borrower/address echo from softpull success responses to the browser
- prevented relay 500s from returning stack traces
- narrowed XML preview exposure so it is no longer broadly available just because `NODE_ENV !== production`

**Why it mattered:**
- upstream provider responses can contain internal details or sensitive operational information
- stack traces and raw bodies create unnecessary disclosure risk

## 2.2 Application persistence minimization in Supabase

**Commit:** `435a649`  
**Message:** `Minimize persisted application data`

**Primary files changed:**
- `src/lib/application-data.ts`
- `src/app/api/application/route.ts`
- `src/app/api/auth/prefill/route.ts`
- `src/app/api/track/route.ts`
- `src/app/api/submit/route.ts`

**What was fixed:**
- created centralized sanitization helper for in-progress persisted application data
- removed sensitive fields from `applications.form_data` across all relevant write paths, not just final submit

**Fields now stripped before persistence:**
- `Borrower - SSN`
- `Borrower - Date of Birth`
- `Co-Borrower - SSN`
- `Co-Borrower - Date of Birth`

**Why it mattered:**
- these fields were previously being stripped only at final submit, but could still be retained earlier in the workflow through other write paths

## 2.3 Session token hashing at rest

**Commit:** `3c9955b`  
**Message:** `Hash session tokens at rest`

**Primary files changed:**
- `src/lib/application-session.ts`
- `src/app/api/auth/verify-otp/route.ts`
- `src/app/api/track/route.ts`
- `src/app/api/verify-value/route.ts`
- `src/app/api/submit/route.ts`
- `src/app/api/auth/prefill/route.ts`
- `supabase/migrations/009_session_token_hash.sql`

**What was fixed:**
- new application sessions are stored using `session_token_hash` instead of plaintext `session_token`
- hash uses HMAC-SHA256 with `APPLICATION_SESSION_SECRET` or service-role fallback
- read paths were updated to look up by hashed token
- compatibility fallback migrates old plaintext-session rows forward on read

**Why it mattered:**
- plaintext session tokens at rest are a meaningful avoidable risk if the DB is ever queried, exported, or mishandled

**Production dependency:**
- requires live Supabase SQL for `session_token_hash`
- migration file: `supabase/migrations/009_session_token_hash.sql`

## 2.4 Removal of remaining unauthenticated testing bypasses

**Commit:** `e1f0a8f`  
**Message:** `Require auth for verify value and submit`

**Primary files changed:**
- `src/app/api/verify-value/route.ts`
- `src/app/api/submit/route.ts`

**What was fixed:**
- `POST /api/verify-value` now requires:
  - trusted browser request
  - valid authenticated application session
- `POST /api/submit` now requires:
  - trusted browser request
  - valid authenticated application session
- removed fallback path that could create submitted applications without real auth

**Why it mattered:**
- these were not hypothetical issues, they were live testing bypasses
- `submit` could create fallback submitted app rows without a valid user session

## 2.5 Raw error and logging detail reduction outside MeridianLink

**Commit:** `e60b8c5`  
**Message:** `Reduce error detail in AVM and submission flows`

**Primary files changed:**
- `src/app/api/verify-value/route.ts`
- `src/app/api/auth/send-otp/route.ts`
- `src/app/api/submit/route.ts`

**What was fixed:**
- `verify-value` stopped logging full request payload details like address/loan context
- `verify-value` no longer throws raw HouseCanary response bodies
- `verify-value` now returns generic `Verification failed` on server errors
- `send-otp` stopped logging raw SMS webhook bodies
- `submit` / GHL flow stopped logging or returning raw upstream API bodies on failure

**Why it mattered:**
- provider responses and request payloads should not become a secondary leak surface through logs or generic exception handling

## 2.6 Rate limiting added to paid and sensitive flows

**Commit:** `1f5c977`  
**Message:** `Add rate limits to AVM and credit flows`

**Primary files changed:**
- `src/app/api/verify-value/route.ts`
- `src/app/api/credit/softpull/route.ts`
- `src/app/api/submit/route.ts`

**What was fixed:**
- `verify-value` now has per-IP and per-session throttling
- `softpull` now has per-IP and per-session throttling
- `submit` now has per-IP and per-session throttling
- all return `429` with `Retry-After`

**Why it mattered:**
- these routes are paid, high-impact, or both
- auth alone is not enough protection against abuse, loops, accidental hammering, or semi-automated misuse

## 2.7 Operational retention gap identified and temporarily patched

**Commit:** `c2424cb`  
**Message:** `Add retention cleanup for operational tables`

**Primary file changed:**
- `supabase/migrations/010_operational_table_retention.sql`

**What it did:**
- added pg_cron cleanup jobs for:
  - `avm_cache`
  - `meridianlink_runs`

**Important correction:**
- this migration currently uses a 30-day window for both tables
- that is **too aggressive** for the actual business requirement that emerged later
- do **not** treat this as the final architecture without revising it

## 2.8 Archive + purge architecture documented

**Commit:** `43cd3c1`  
**Message:** `Add archive and retention handoff plan`

**Doc created:**
- `docs/AVM_MERIDIANLINK_ARCHIVE_RETENTION_PLAN.md`

**What it documents:**
- recommended hot retention in Supabase:
  - `avm_cache`: 90 days
  - `meridianlink_runs`: 180 days
- archive-before-purge design to Azure Blob
- SQL to add `archived_at` and `archive_path`
- SQL to unschedule the too-aggressive 30-day cleanup jobs
- SQL to add correct purge-after-archive jobs
- rollout order for archive first, purge second

## 2.9 Follow-up future-work item recorded

**Commit:** `c27c943`  
**Message:** `Add data retention architecture follow-up`

**File updated:**
- `FUTURE_WORK.md`

**What it added:**
- formal follow-up item to review and establish a comprehensive data retention and analytics architecture across live DB, archive, and reporting layers

## 2.10 Follow-up hardening completed on 2026-04-27

The next work resumed after the original 2026-04-24 checkpoint and focused on three areas:
- minimizing MeridianLink hot storage
- reducing remaining route/helper error leakage
- documenting the next MeridianLink XML workstream explicitly instead of losing it in ad hoc notes

### 2.10.1 MeridianLink hot-storage minimization

**Commit:** `883e58c`  
**Message:** `Minimize MeridianLink hot storage`

**Primary files changed:**
- `src/app/api/credit/softpull/route.ts`
- `supabase/migrations/004_meridianlink_runs.sql`
- `supabase/migrations/006_backfill_meridianlink_runs_columns.sql`
- `supabase/migrations/011_minimize_meridianlink_runs_hot_storage.sql`
- `FUTURE_WORK.md`
- `docs/SECURITY_IMPLEMENTATIONS_AND_AUDIT_STATUS_2026-04-24.md`

**What was fixed:**
- stopped writing borrower first/last names into `meridianlink_runs`
- stopped writing raw `error_message` into `meridianlink_runs`
- kept only operationally necessary fields in hot storage, such as application linkage, status, vendor identifiers, file numbers, timing, response size, and coarse error category
- added live migration `011_minimize_meridianlink_runs_hot_storage.sql`

**Production status:**
- `011_minimize_meridianlink_runs_hot_storage.sql` was applied in live Supabase on 2026-04-27

### 2.10.2 Route-level error/logging cleanup completed after the original audit

**Commits:**
- `dd8eff1` — `Reduce API error detail in auth and credit routes`
- `22c49d8` — `Reduce remaining noisy API logs`
- `1c33c27` — `Normalize remaining API error responses`

**Primary route files changed:**
- `src/app/api/auth/prefill/route.ts`
- `src/app/api/auth/verify-otp/route.ts`
- `src/app/api/credit/softpull/route.ts`
- `src/app/api/coming-soon/route.ts`
- `src/app/api/track/route.ts`
- `src/app/api/send-calculator-email/route.ts`
- `src/app/api/send-email/route.ts`

**What was fixed:**
- removed raw GHL response-body logging in `auth/prefill` and `coming-soon`
- removed broad caught-error object logging in `verify-otp`, `coming-soon`, `track`, and email routes
- stopped returning raw caught exception text back to the browser in `credit/softpull`, `track`, and email routes
- removed exposed provider response details and diagnostic metadata from browser responses in the Resend/email path
- reduced remaining MeridianLink operational warning logs to generic status-only messages

### 2.10.3 Helper/provider-layer hardening

**Commit:** `f4cfc8b`  
**Message:** `Harden provider helper error handling`

**Primary files changed:**
- `src/lib/meridianlink-credit.ts`
- `src/lib/rate-limit.ts`

**What was fixed:**
- stopped throwing MeridianLink provider category/message text back up the stack from helper code
- replaced that with a generic `MeridianLink provider error.` exception
- stopped logging the full Supabase rate-limit RPC error object in `rate-limit.ts`

### 2.10.4 MeridianLink XML processing explicitly earmarked

**File updated:**
- `FUTURE_WORK.md`

**What was added:**
- explicit follow-up to redesign MeridianLink XML processing/debug flow so future operational parsing or test needs do not re-expose raw upstream XML in normal browser/API responses

---

# 3. Detailed security controls currently in place today

This section combines pre-existing and newly hardened controls into the current effective state.

## 3.1 Environment and host gating

### Preview-site password gate
- Vercel project hosts are hidden behind the preview access gate
- blocked preview API access returns `404`
- preview unlock uses `httpOnly` cookie

### Loan Officer host isolation
- `lo.firstaccesslending.com` is path-constrained in middleware
- non-LO API discovery on that host is blocked
- the pricer and AVM routes are only intended to run behind the LO portal host

## 3.2 Authentication and session controls

### OTP challenge flow
- phone-based OTP challenge required to enter authenticated application flow
- OTPs expire after 5 minutes
- OTPs are invalidated when replaced
- OTP attempts are capped

### OTP storage
- OTP codes are hashed with HMAC-SHA256 in `src/lib/otp.ts`
- legacy plaintext fallback exists only to validate already-issued short-lived legacy codes

### Application session controls
- application sessions are stored server-side in Supabase
- browser receives only an `httpOnly` cookie
- cookie is `secure` in production and `sameSite=lax`
- session TTL is 30 minutes
- expired sessions are invalidated in DB and cookie is cleared

### Session token at-rest protection
- new sessions are stored as HMAC hash in `session_token_hash`
- old plaintext-session rows can be migrated forward on read

## 3.3 Request trust and origin controls

### Trusted browser enforcement
Sensitive routes now use `requireTrustedBrowserRequest(...)`, which:
- blocks `sec-fetch-site: cross-site`
- validates request `Origin` against allowed hosts
- rejects invalid or untrusted origins with `403`

### Currently used on hardened routes
- `PATCH /api/application`
- `POST /api/credit/softpull`
- `POST /api/verify-value`
- `POST /api/submit`
- `GET /api/auth/prefill` writeback path indirectly through authenticated route logic

## 3.4 Data minimization in Supabase

### Application form persistence
`applications.form_data` now strips:
- borrower SSN
- borrower DOB
- co-borrower SSN
- co-borrower DOB

This is enforced through shared helper logic instead of ad hoc route-specific deletion.

### Application linkage
- operational logs link back to `applications.id` instead of relying on weaker ad hoc identifiers
- AVM cache and MeridianLink runs can now be correlated to the application UUID

## 3.5 Route-level authorization on sensitive endpoints

### Now gated behind authenticated session
- `/api/application` authenticated application read/write
- `/api/verify-value`
- `/api/credit/softpull`
- `/api/submit`
- `/api/auth/prefill` authenticated data hydration path

### Removed insecure testing behavior
- no more unauthenticated fallback submit path creating fake/test-style submitted apps
- no more unauthenticated AVM verification path for testing

## 3.6 Rate limiting

### Supabase-backed limiter
All current throttling uses the shared `consume_auth_rate_limit(...)` infrastructure.

### OTP routes
- `send-otp`: per-phone and per-IP
- `verify-otp`: per-phone and per-IP

### Newly added sensitive-route limits
- `verify-value`: per-IP and per-session/application
- `softpull`: per-IP and per-session/application
- `submit`: per-IP and per-session/application

## 3.7 Provider and upstream error handling

### MeridianLink
- app-side raw upstream body exposure reduced
- relay 500s no longer expose stack traces
- helper-layer provider exception text is now normalized instead of bubbling provider category/message detail back up the stack
- XML response preview remains constrained to explicit debug condition outside production and is now an intentional follow-up item for redesign, not an ignored loose end

### HouseCanary
- no raw upstream response body in thrown errors
- browser gets generic failure message on server error

### GHL
- no raw failed webhook response body logging in the hardened send/submit paths
- prefill and coming-soon no longer log raw GHL response bodies
- GHL submission path no longer bubbles raw upstream body back through browser 500 response

### Resend / email-related paths
- browser responses no longer return raw provider details or exception text on failure
- server logging no longer emits raw provider-body diagnostics in the hardened routes

## 3.8 Logging controls

### Improved
- fewer full request payload logs on paid/sensitive flows
- fewer raw provider-body logs
- fewer raw DB/provider exception objects written to logs
- several route surfaces now use generic browser-facing error responses instead of reflecting caught exception text

### Current posture
- the main obvious high-risk route/helper logging issues identified during the 2026-04-27 pass were cleaned up
- future sweeps may still find style inconsistencies, but the largest raw-error and raw-upstream-body exposures in the audited surfaces were reduced

## 3.9 Operational retention posture

### Existing retention already present
- `applications`: scheduled cleanup older than 30 days
- `otp_codes`: scheduled cleanup older than 24 hours
- `auth_rate_limits`: stale bucket cleanup after 7 days

### Current state for AVM / MeridianLink operations
- interim 30-day cleanup migration exists in repo but should not be treated as final
- proper archive-before-purge plan is documented separately

---

# 4. Production dependencies and follow-up actions

## 4.1 SQL status in live Supabase

### Applied in production
- `supabase/migrations/009_session_token_hash.sql`
- `supabase/migrations/011_minimize_meridianlink_runs_hot_storage.sql`

### Still intentionally not final policy
- `supabase/migrations/010_operational_table_retention.sql` is not the final business-correct retention design
- use the revised archive + purge plan in:
  - `docs/AVM_MERIDIANLINK_ARCHIVE_RETENTION_PLAN.md`

## 4.2 Archive architecture still needs implementation

The archive plan is documented, but not yet implemented in code.

Still needed:
- add archive tracking columns in Supabase
- build `scripts/archive_operational_tables.py`
- export AVM and MeridianLink operational records to Azure Blob
- only purge after archive success

---

# 5. Current audit progression and where work stands now

The security review and follow-up hardening progressed in this order:

1. provider result handling and logging
2. Supabase persistence and minimization
3. session-token storage hardening
4. remaining testing-bypass / unauthenticated routes
5. sensitive server logs and third-party error handling
6. rate limiting and abuse resistance
7. operational retention for AVM and MeridianLink tables
8. MeridianLink hot-storage minimization
9. route-level error/log normalization across auth, credit, tracking, and email paths
10. helper/provider-layer exception/log normalization

## MeridianLink hot-storage decision now implemented

This step is no longer pending, it is done:
- borrower name fields are not needed in `meridianlink_runs`
- borrower names were removed from hot storage
- raw `error_message` was removed from hot storage

Live-table decision:
- keep operational identifiers like `application_id`, `borrower_file_number`, `approved_borrower_file_number`, status, timing, and coarse error category
- do not keep borrower first/last names in the live operational log table
- do not keep raw MeridianLink error text in the live operational log table

Follow-up kept for future work:
- if testing still needs richer failure diagnostics or borrower-name correlation, build a separate controlled debug/archive path instead of restoring those fields to `meridianlink_runs`
- the next XML-processing workstream should handle parsing/debug needs without restoring broad raw XML exposure in browser/API responses

---

# 6. Current known limitations / honest gaps

## 6.1 Preview/site-access cookie is simple
- `fal_site_access` currently stores the configured site password value directly as the cookie token
- that is acceptable as a simple preview gate, but it is not a strong auth design
- if this gate becomes long-lived or higher-risk, it should be signed like the pricer cookie

## 6.2 XML debug/preview path still needs a deliberate redesign
- the MeridianLink XML-preview behavior is now explicitly earmarked for the next workstream
- it is already constrained compared with the original state, but it still deserves a purpose-built design instead of lingering as a debug accommodation

## 6.3 `meridianlink_runs` hot-storage minimization was tightened
- borrower first/last name fields and raw `error_message` were removed from the live operational table design
- if richer testing diagnostics are still needed, they should live in a separate controlled debug/archive path rather than hot storage

## 6.4 Archive plan is documented, not yet implemented
- long-term retention strategy is now designed, but not yet operationalized

## 6.5 Pricer security is still password-based, not user-identity based
- FUTURE_WORK already captures move to authenticated login + 2FA

---

# 7. Recommended next actions

## Immediate
1. Keep `docs/AVM_MERIDIANLINK_ARCHIVE_RETENTION_PLAN.md` as source of truth for retention redesign
2. Do not deploy the current 30-day `010_operational_table_retention.sql` as final policy without revising it to archive-before-purge
3. If production verification matters for a specific hardening push, sanity-check that Vercel actually deployed the latest commit because auto-deploy missed a trigger during the 2026-04-27 session

## Next substantive workstream
4. Redesign MeridianLink XML processing/debug flow so XML parsing and operational testing can continue without normal browser/API responses carrying raw upstream XML or broadly reusable debug exposure

## After that
5. Build archive script and Azure Blob export path
6. Revisit preview-site gate token design if that preview wall remains in place long term
7. Optionally do a documentation/consistency sweep so future security work starts from the current hardened baseline instead of the older 2026-04-24 checkpoint text

---

# 8. Reference commits from this audit sequence

## 2026-04-24 sequence
- `f983e3c` — `Reduce provider result exposure`
- `435a649` — `Minimize persisted application data`
- `3c9955b` — `Hash session tokens at rest`
- `e1f0a8f` — `Require auth for verify value and submit`
- `e60b8c5` — `Reduce error detail in AVM and submission flows`
- `1f5c977` — `Add rate limits to AVM and credit flows`
- `c2424cb` — `Add retention cleanup for operational tables`
- `43cd3c1` — `Add archive and retention handoff plan`
- `c27c943` — `Add data retention architecture follow-up`

## 2026-04-27 follow-up sequence
- `883e58c` — `Minimize MeridianLink hot storage`
- `dd8eff1` — `Reduce API error detail in auth and credit routes`
- `22c49d8` — `Reduce remaining noisy API logs`
- `f4cfc8b` — `Harden provider helper error handling`
- `1c33c27` — `Normalize remaining API error responses`

---

This document is meant to let work resume quickly without re-tracing the whole audit from scratch.
