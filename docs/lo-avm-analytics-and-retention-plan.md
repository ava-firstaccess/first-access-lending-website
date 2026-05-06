# LO AVM analytics and retention plan

## Status

- **Analytics schema/code:** built and committed
- **Production schema apply:** still needs to be run in Supabase SQL editor
- **Backfill:** ready to run immediately after schema apply
- **Raw-data retention/purge:** planned here, not built yet

Commit with the analytics implementation:
- `fb5eb9c` - `Add LO AVM run analytics and backfill`

---

## Goal

Support real long-term LO AVM analytics without keeping bulky raw provider/cache payloads in hot storage forever.

We want to answer questions like:
- Which LO manually orders AVMs the most?
- What percentage of AVM winners are manual vs cascade?
- Which provider wins at what rate overall, by investor, and by LO?
- When a provider loses, how far off was it from the winner?
- How often do cache-only and cache-hit flows avoid new vendor orders?

---

## Recommended architecture

### Keep long-term in Supabase

These are the durable analytics fact tables:

#### 1. `loan_officer_avm_run_results`
One row per user-triggered LO AVM run.

Stores:
- who ran it
- run source (`manual` or `cascade`)
- whether it was cache-only
- whether it hit cache and avoided new orders
- investor / product context
- winner provider
- winner value / FSD
- run-level outcome summary

#### 2. `loan_officer_avm_run_providers`
One row per provider snapshot within a run.

Stores:
- provider in the run
- fresh vs cache
- order status
- provider product
- value / FSD
- threshold status
- whether that provider was the winner
- failure message when relevant

### Keep shorter-term in Supabase, then archive to Azure Blob

These are operational/raw tables, not ideal for indefinite hot retention:

#### 3. `loan_officer_avm_orders`
Purpose:
- actual outbound vendor order audit log
- request/response payloads
- billing-cycle allocation
- raw provider-side details

#### 4. `avm_cache`
Purpose:
- live 90-day style reuse behavior
- operational cache source
- recent debugging / reconstruction only

---

## Why this split

### Supabase is a good long-term home for analytics

Because the analytics tables are:
- structured
- compact
- queryable
- well-suited for dashboards, SQL, and Power BI

### Supabase is not the best long-term home for raw cache/order blobs

Because `loan_officer_avm_orders` and `avm_cache` contain or may contain:
- full addresses
- loan numbers
- LO emails
- bulky provider response JSON
- temporary signed URLs
- vendor-specific raw response details that are useful for operations, not everyday analytics

So the right pattern is:
- **Supabase for normalized analytics facts**
- **Azure Blob for cold operational/raw archive**

---

## Production analytics tables

### `loan_officer_avm_run_results`

Grain:
- one row per LO AVM run

Examples of what it supports:
- manual vs cascade run volume
- winner share by run source
- LO-level usage trends
- cache-only and cache-hit behavior

### `loan_officer_avm_run_providers`

Grain:
- one row per provider inside a run

Examples of what it supports:
- provider win rate
- provider participation rate
- losing-provider delta-to-winner analysis
- provider performance by LO / investor / threshold

---

## Source of truth vs summary views

The analytics base should **not** be one row per address + LO.

Reason:
- one address can have many runs over time
- investor can change
- manual vs cascade can change
- winners can change
- values/FSDs can change
- retries/cache-only flows matter historically

So the correct source of truth is:
- one row per run
- one row per provider within that run

If desired, we can later create a **summary view** grouped by address + LO for friendlier browsing, but that should be a derived view, not the base fact model.

---

## Backfill plan

### Current implementation

Backfill script:
- `scripts/backfill-lo-avm-run-analytics.mjs`

NPM command:
- `npm run avm:backfill-analytics`

Dry run supported:
- `node scripts/backfill-lo-avm-run-analytics.mjs --dry-run`

### What the backfill does

- reads historical `loan_officer_avm_orders`
- groups rows by `order_run_id`
- builds one run-level analytics row per grouped run
- builds provider-level analytics rows for the providers present in that run
- derives winner using the same winner-selection logic currently used by the app

### Synthetic rows excluded from backfill

The backfill intentionally excludes the fake HouseCanary cycle-counter rows that were inserted only to align billing counts.

Exclusion rules:
- `request_payload.type = 'housecanary_billing_backfill'`
- `response_payload.backfill = true`
- `notes = 'Manual backfill to align HouseCanary cycle count to 28'`
- `loan_officer_prefix = 'system' AND address = 'HouseCanary billing backfill'`

### Dry-run result observed during implementation

Dry run found:
- `ordersSeen: 38`
- `syntheticOrdersSkipped: 23`
- `runResultsInserted: 15`
- `providerRowsInserted: 15`

---

## Production apply steps

### Step 1. Apply schema in Supabase SQL editor

Apply:
- `supabase/migrations/024_lo_avm_run_analytics.sql`

### Step 2. Run backfill from repo root

```bash
npm run avm:backfill-analytics
```

### Step 3. Verify row counts

```sql
select count(*) from loan_officer_avm_run_results;
select count(*) from loan_officer_avm_run_providers;
```

### Step 4. Verify synthetic rows were excluded

You should not see the fake backfill records represented as user runs.

Sanity check by LO volume:

```sql
select
  loan_officer_prefix,
  count(*) as runs
from loan_officer_avm_run_results
group by 1
order by 2 desc;
```

The synthetic `system` billing-counter rows should not appear as real analytics runs.

---

## Live-write behavior

The app now attempts to persist analytics for:
- cache-only runs (`Pull Cache`)
- cache-hit/no-new-order runs
- fresh vendor-order runs

Important behavior:
- analytics persistence is **best effort**
- analytics failure should **not** break live AVM ordering
- if analytics tables are missing or a write fails, the operational flow still returns to the user

---

## Immediate analytics queries

See:
- `docs/lo-avm-analytics-queries.md`

Examples already prepared there:
- manual orders by LO
- winner mix: cascade vs manual
- provider win rate overall
- provider win rate by LO
- provider participation vs wins
- manual provider usage by LO
- cache-only / cache-hit mix

---

## Future retention and purge plan

## Retention decisions

### Keep long-term in Supabase

Keep indefinitely for now:
- `loan_officer_avm_run_results`
- `loan_officer_avm_run_providers`

Reason:
- compact enough for long-term analytics
- this is the main system of record for reporting
- avoids needing to reconstruct business analytics from raw JSON later

### Keep hot in Supabase for 120 days, then archive to Azure Blob

After **120 days**:
- `loan_officer_avm_orders`
- `avm_cache`

should be:
1. archived to Azure Blob
2. marked as archived in Supabase
3. purged from Supabase only after successful archive

---

## Planned archive design

### Azure Blob purpose

Azure Blob should store cold history for:
- audit
- reconstruction
- forensic debugging
- long-range raw-history preservation

It should **not** replace live analytics querying.

### Recommended archive paths

```text
website/loan_officer_avm_orders/year=YYYY/month=MM/day=DD/loan_officer_avm_orders_YYYYMMDD_HHMMSS.jsonl
website/avm_cache/year=YYYY/month=MM/day=DD/avm_cache_YYYYMMDD_HHMMSS.jsonl
```

Format for now:
- JSONL

Potential later optimization:
- Parquet if reporting volume grows

---

## Planned purge workflow

### Step A. Add archive tracking columns

Future migration should add to both raw tables:
- `archived_at TIMESTAMPTZ`
- `archive_path TEXT`

### Step B. Daily archive job

Archive job should:
1. select rows older than 120 days where `archived_at IS NULL`
2. write them to Azure Blob
3. if upload succeeds, update those rows with:
   - `archived_at = now()`
   - `archive_path = '<blob path>'`

### Step C. Daily purge job

Purge job should:
- delete only rows where `archived_at IS NOT NULL`
- and older than 120-day hot-retention window

### Critical rule

Never purge in the same logical step unless:
- archive upload succeeded
- archive markers were successfully written back

---

## Security posture

### Main risk today

The raw operational tables contain more sensitive content than the analytics tables:
- full address
- loan number
- LO email
- raw request/response JSON
- provider-side payloads
- temporary signed URLs in some response payloads

### Security recommendation

The 120-day archive/purge plan should target **raw** tables, not the normalized analytics facts.

That gives the best balance:
- long-term analytics remains easy in Supabase
- raw sensitive payload exposure stays time-bounded

---

## Recommendation summary

### Keep long-term in Supabase
- `loan_officer_avm_run_results`
- `loan_officer_avm_run_providers`

### Archive then purge after 120 days
- `loan_officer_avm_orders`
- `avm_cache`

### Build next
1. production schema apply
2. backfill run
3. verification queries
4. future archive tracking columns for raw tables
5. archive job to Azure Blob
6. purge job after archive confirmation

---

## Open follow-up work

### Immediate
- Apply analytics schema in production
- Run backfill in production
- Validate counts and first analytics queries

### Next phase
- Build 120-day raw-table archive/purge pipeline
- Decide whether archive container should live under existing Azure storage or a dedicated `website-archive` container
- Add verification/reporting queries for:
  - losing-provider delta to winner
  - win rate by investor
  - win rate by LO
  - manual vs cascade winner performance
  - cache avoidance metrics
