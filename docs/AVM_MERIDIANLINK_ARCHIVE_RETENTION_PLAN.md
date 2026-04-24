# AVM + MeridianLink Retention, Archive, and Purge Plan

**Date:** 2026-04-24  
**Status:** Proposed handoff for implementation  
**Scope:** `avm_cache` and `meridianlink_runs`

## Goal

Keep the app fast and the live Supabase tables bounded, without losing long-term operational history or analytics value.

## Recommended lifecycle

### Hot operational storage in Supabase
- `avm_cache`: keep **90 days** in Supabase
- `meridianlink_runs`: keep **180 days** in Supabase

### Cold historical archive in Azure Blob
Before purge, export rows to Azure Blob for long-term storage.

Recommended archive paths:
- `website/avm_cache/year=YYYY/month=MM/day=DD/avm_cache_YYYYMMDD_HHMMSS.jsonl`
- `website/meridianlink_runs/year=YYYY/month=MM/day=DD/meridianlink_runs_YYYYMMDD_HHMMSS.jsonl`

## Why this design

- Supabase stays lean for live app queries
- Azure Blob becomes the durable historical system for analytics and audit
- AVM reuse still works for 90 days
- MeridianLink reporting and rerun history still works for 180 days
- Long-term history is preserved instead of hard-deleted forever

## Important correction to current repo state

Do **not** apply `supabase/migrations/010_operational_table_retention.sql` as-is if you want the retention windows above.

That migration currently schedules:
- `avm_cache` delete after 30 days
- `meridianlink_runs` delete after 30 days

That was too aggressive for the actual business need.

## Best-practice implementation pattern

Use a **two-step process**:

1. **Archive job** exports eligible rows to Azure Blob and marks them archived in Supabase
2. **Purge job** deletes only rows that were already archived and are past their hot-retention window

This avoids deleting anything before it is safely copied offsite.

---

# 1. Supabase SQL changes

## 1A. Add archive tracking columns

Run this in Supabase SQL editor:

```sql
ALTER TABLE IF EXISTS avm_cache
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

ALTER TABLE IF EXISTS meridianlink_runs
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

CREATE INDEX IF NOT EXISTS idx_avm_cache_archived_at
  ON avm_cache (archived_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_archived_at
  ON meridianlink_runs (archived_at, created_at DESC);
```

## 1B. Remove the too-aggressive 30-day cleanup jobs if they were already created

Run this in Supabase SQL editor:

```sql
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-old-avm-cache'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END
$$;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-old-meridianlink-runs'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END
$$;
```

## 1C. Add purge jobs with the correct windows

These should run **only after** the archive export job exists and is working.

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-archived-avm-cache') THEN
    PERFORM cron.schedule(
      'purge-archived-avm-cache',
      '20 3 * * *',
      $job$
      DELETE FROM avm_cache
      WHERE archived_at IS NOT NULL
        AND created_at < NOW() - INTERVAL '90 days'
      $job$
    );
  END IF;
END
$outer$;

DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-archived-meridianlink-runs') THEN
    PERFORM cron.schedule(
      'purge-archived-meridianlink-runs',
      '35 3 * * *',
      $job$
      DELETE FROM meridianlink_runs
      WHERE archived_at IS NOT NULL
        AND created_at < NOW() - INTERVAL '180 days'
      $job$
    );
  END IF;
END
$outer$;
```

---

# 2. Azure Blob archive design

## Storage target

Use the existing Azure Blob setup.

Recommended:
- **Storage account:** `firstaccessdata`
- **Container:** either reuse `powerbi-data` with a `website/` prefix, or create a cleaner dedicated container like `website-archive`

### Recommendation
If you want the cleanest separation, create a new container:
- `website-archive`

If you want fastest setup, reuse current storage account and container with a prefix:
- `powerbi-data/website/...`

## Blob layout

Recommended structure:

```text
website/
  avm_cache/
    year=2026/
      month=04/
        day=24/
          avm_cache_20260424_031500.jsonl
  meridianlink_runs/
    year=2026/
      month=04/
        day=24/
          meridianlink_runs_20260424_032500.jsonl
```

## File format

### First version
Use **JSONL**.

Why:
- easiest to build quickly
- one record per line
- simple to inspect manually
- easy to reload later if needed

### Future optimization
Move to **Parquet** later if Power BI / analytics volume grows.

---

# 3. Archive job behavior

Create one script, for example:

```text
scripts/archive_operational_tables.py
```

## What the script should do

### Step A. Pull eligible AVM rows
Select rows where:
- `created_at < now() - interval '90 days'`
- `archived_at IS NULL`

### Step B. Pull eligible MeridianLink rows
Select rows where:
- `created_at < now() - interval '180 days'`
- `archived_at IS NULL`

### Step C. Write archive files to Azure Blob
- one JSONL file for AVM rows in this run
- one JSONL file for MeridianLink rows in this run

### Step D. Mark archived rows back in Supabase
Update exported rows with:
- `archived_at = now()`
- `archive_path = '<blob path>'`

## Critical rule
Do **not** purge anything in the same step unless the blob upload succeeded and the archive markers were written back successfully.

---

# 4. Suggested cron order

## Daily archive first
Run archive job first:
- **3:00 AM** archive rows to Azure Blob and mark them archived

## Daily purge second
Run purge jobs after archive finishes:
- **3:20 AM** purge archived AVM rows older than 90 days
- **3:35 AM** purge archived MeridianLink rows older than 180 days

This order gives a clean safety boundary.

---

# 5. Recommended data kept in archive

## AVM archive
Keep:
- `application_id`
- address fields already used by AVM process
- `tier`
- `hc_estimate`
- `hc_value`
- `fsd`
- `new_max_loan`
- `max_ltv`
- `response_payload`
- `created_at`

This preserves historical AVM outcomes and supports trend analysis.

## MeridianLink archive
Keep:
- `run_id`
- `application_id`
- `created_at`
- `mode`
- `provider`
- `request_type`
- `endpoint_host`
- `status_code`
- `status`
- `vendor_order_identifier`
- `has_vendor_order_identifier`
- `response_bytes`
- `error_category`
- `error_message`
- `borrower_file_number`
- `approved_borrower_file_number`
- `success`
- `notes`

### Minimization note
For long-term archive, consider dropping or masking these if not truly needed:
- `borrower_first_name`
- `borrower_last_name`
- `approved_borrower_first_name`
- `approved_borrower_last_name`

My recommendation: keep file numbers and application linkage, but avoid keeping borrower names long-term unless there is a reporting or compliance reason.

---

# 6. Setup checklist

## Supabase
1. Run section **1A** SQL to add archive tracking columns
2. If needed, run section **1B** SQL to unschedule the old 30-day purge jobs
3. Do **not** run section **1C** until the archive script is live and tested

## Azure
1. Decide container:
   - `website-archive` preferred, or
   - existing `powerbi-data` with `website/` prefix
2. Confirm storage account key is available in Keychain:
   - `azure-storage-account-key`
3. Reuse current Azure Blob access pattern already used elsewhere in the environment

## Script
1. Create `scripts/archive_operational_tables.py`
2. Authenticate to:
   - Supabase service role
   - Azure Blob storage
3. Export eligible rows to JSONL
4. Upload JSONL files to Blob
5. Mark archived rows in Supabase
6. Log counts and blob paths
7. Exit non-zero on any partial failure

## Cron
1. Add archive cron first
2. Test it manually once
3. Confirm blob files exist
4. Confirm `archived_at` and `archive_path` are populated
5. Only then enable purge cron jobs

---

# 7. Safe rollout order

## Phase 1
- Add archive columns
- Build archive script
- Run archive script manually
- Verify files in Blob

## Phase 2
- Schedule archive script daily
- Monitor for a few days

## Phase 3
- Enable purge pg_cron jobs
- Purge only rows that are already archived

This is the safest rollout.

---

# 8. What I would do next

Recommended next implementation step:
- build `scripts/archive_operational_tables.py`
- wire it to Azure Blob
- test one manual archive run end-to-end
- then replace the current 30-day retention jobs with the revised purge-after-archive jobs above

That gives you the right long-term data posture without losing operational history or analytics value.
