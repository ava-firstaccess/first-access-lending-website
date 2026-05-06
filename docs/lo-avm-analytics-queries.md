# LO AVM analytics queries

Use `loan_officer_avm_run_results` for run-level metrics and `loan_officer_avm_run_providers` for provider-level win/snapshot metrics.

## Manual orders by LO

```sql
select
  loan_officer_prefix,
  loan_officer_email,
  count(*) as manual_runs
from loan_officer_avm_run_results
where run_source = 'manual'
group by 1, 2
order by 3 desc;
```

## Winner mix: cascade vs manual

```sql
select
  run_source,
  count(*) as winning_runs,
  round(100.0 * count(*) / sum(count(*)) over (), 2) as pct_of_winning_runs
from loan_officer_avm_run_results
where winner_provider is not null
group by 1
order by 2 desc;
```

## Provider win rate overall

```sql
select
  winner_provider,
  count(*) as wins,
  round(100.0 * count(*) / sum(count(*)) over (), 2) as win_pct
from loan_officer_avm_run_results
where winner_provider is not null
group by 1
order by 2 desc;
```

## Provider win rate by LO

```sql
select
  loan_officer_prefix,
  winner_provider,
  count(*) as wins,
  round(100.0 * count(*) / sum(count(*)) over (partition by loan_officer_prefix), 2) as win_pct_for_lo
from loan_officer_avm_run_results
where winner_provider is not null
group by 1, 2
order by 1, 3 desc;
```

## Provider participation vs wins

```sql
select
  p.provider,
  count(*) as provider_rows_seen,
  count(*) filter (where p.is_winner) as provider_wins,
  round(100.0 * count(*) filter (where p.is_winner) / nullif(count(*), 0), 2) as win_rate_when_present
from loan_officer_avm_run_providers p
group by 1
order by 4 desc nulls last, 2 desc;
```

## Manual provider usage by LO

```sql
select
  loan_officer_prefix,
  manual_provider_requested,
  count(*) as manual_runs
from loan_officer_avm_run_results
where run_source = 'manual'
group by 1, 2
order by 1, 3 desc;
```

## Cache-only / cache-hit mix

```sql
select
  cache_only,
  cache_hit,
  count(*) as runs
from loan_officer_avm_run_results
group by 1, 2
order by 3 desc;
```

## Synthetic rows intentionally excluded from backfill

The backfill script excludes the fake HouseCanary counter rows that were inserted only to align cycle usage:

- `request_payload.type = 'housecanary_billing_backfill'`
- `response_payload.backfill = true`
- `notes = 'Manual backfill to align HouseCanary cycle count to 28'`
- `loan_officer_prefix = 'system' and address = 'HouseCanary billing backfill'`
