begin;

delete from loan_officer_avm_analytics_providers;
delete from loan_officer_avm_analytics_runs;

with real_orders as (
  select
    o.*,
    coalesce(o.order_run_id, o.id) as derived_run_id,
    case
      when o.provider = 'housecanary' then 'HouseCanary'
      when o.provider = 'clearcapital' then 'Clear Capital'
      else o.provider
    end as provider_label,
    case
      when jsonb_typeof(o.response_payload->'value') = 'number'
        then (o.response_payload->>'value')::numeric
      when jsonb_typeof(o.response_payload->'estimatedValue') = 'number'
        then (o.response_payload->>'estimatedValue')::numeric
      else null
    end as parsed_value,
    case
      when jsonb_typeof(o.response_payload->'fsd') = 'number'
        then (o.response_payload->>'fsd')::numeric
      when jsonb_typeof(o.response_payload->'forecastStdDev') = 'number'
        then (o.response_payload->>'forecastStdDev')::numeric
      else null
    end as parsed_fsd,
    case
      when o.response_payload->>'reportLink' is not null
       and btrim(o.response_payload->>'reportLink') <> ''
        then true
      else false
    end as has_report_link
  from loan_officer_avm_order_log o
  where not (
    o.request_payload->>'type' = 'housecanary_billing_backfill'
    or coalesce((o.response_payload->>'backfill')::boolean, false) = true
    or o.notes = 'Manual backfill to align HouseCanary cycle count to 28'
    or (o.loan_officer_prefix = 'system' and o.address = 'HouseCanary billing backfill')
  )
),
latest_per_provider as (
  select distinct on (derived_run_id, provider_label)
    derived_run_id,
    id,
    order_run_id,
    loan_officer_prefix,
    loan_officer_email,
    loan_number,
    investor,
    engine,
    program,
    product,
    address_id,
    address,
    city,
    state,
    zipcode,
    run_source,
    provider_label,
    provider_product,
    order_status,
    requested_max_fsd,
    fsd_threshold_status,
    parsed_value,
    parsed_fsd,
    has_report_link,
    response_payload->>'errorMessage' as failure_message,
    ordered_at,
    created_at
  from real_orders
  order by derived_run_id, provider_label, created_at desc, id desc
),
winner_candidates as (
  select
    l.*,
    row_number() over (
      partition by derived_run_id
      order by
        case
          when order_status = 'completed'
           and parsed_value is not null
           and (
             requested_max_fsd is null
             or parsed_fsd is null
             or parsed_fsd <= requested_max_fsd + 0.0001
           )
          then 1 else 2 end,
        case
          when order_status = 'completed' and parsed_value is not null then 1 else 2 end,
        parsed_value desc nulls last,
        created_at desc,
        id desc
    ) as winner_rank
  from latest_per_provider l
),
winners as (
  select * from winner_candidates where winner_rank = 1 and parsed_value is not null
),
run_rollup as (
  select
    r.derived_run_id as run_id,
    min(r.order_run_id::text)::uuid as order_run_id,
    min(r.loan_officer_prefix) as loan_officer_prefix,
    min(r.loan_officer_email) as loan_officer_email,
    min(r.loan_number) as loan_number,
    min(r.investor) as investor,
    min(r.engine) as engine,
    min(r.program) as program,
    min(r.product) as product,
    min(r.address_id) as address_id,
    min(r.address) as address,
    min(r.city) as city,
    min(r.state) as state,
    min(r.zipcode) as zipcode,
    min(r.run_source) as run_source,
    case
      when min(r.run_source) = 'manual' then min(r.provider_label)
      else null
    end as manual_provider_requested,
    false as cache_only,
    false as cache_hit,
    null::boolean as selected_investor_satisfied,
    null::boolean as selected_investor_in_flight,
    count(*)::int as orders_placed_count,
    w.provider_label as winner_provider,
    case when w.provider_label is not null then 'fresh' else null end as winner_source,
    w.provider_product as winner_provider_product,
    w.order_run_id as winner_order_run_id,
    w.order_status as winner_order_status,
    w.parsed_value as winner_value,
    w.parsed_fsd as winner_fsd,
    max(coalesce(r.ordered_at, r.created_at)) as latest_ordered_at,
    bool_or(r.order_status = 'completed') as completed_successfully,
    'Backfilled from historical outbound LO AVM orders.' as response_message,
    min(r.created_at) as created_at,
    max(r.created_at) as updated_at
  from real_orders r
  left join winners w
    on w.derived_run_id = r.derived_run_id
  group by r.derived_run_id, w.provider_label, w.provider_product, w.order_run_id, w.order_status, w.parsed_value, w.parsed_fsd
)
insert into loan_officer_avm_analytics_runs (
  run_id,
  order_run_id,
  loan_officer_prefix,
  loan_officer_email,
  loan_number,
  investor,
  engine,
  program,
  product,
  address_id,
  address,
  city,
  state,
  zipcode,
  run_source,
  manual_provider_requested,
  cache_only,
  cache_hit,
  selected_investor_satisfied,
  selected_investor_in_flight,
  orders_placed_count,
  winner_provider,
  winner_source,
  winner_provider_product,
  winner_order_run_id,
  winner_order_status,
  winner_value,
  winner_fsd,
  latest_ordered_at,
  completed_successfully,
  response_message,
  created_at,
  updated_at
)
select
  run_id,
  order_run_id,
  loan_officer_prefix,
  loan_officer_email,
  loan_number,
  investor,
  engine,
  program,
  product,
  address_id,
  address,
  city,
  state,
  zipcode,
  run_source,
  manual_provider_requested,
  cache_only,
  cache_hit,
  selected_investor_satisfied,
  selected_investor_in_flight,
  orders_placed_count,
  winner_provider,
  winner_source,
  winner_provider_product,
  winner_order_run_id,
  winner_order_status,
  winner_value,
  winner_fsd,
  latest_ordered_at,
  completed_successfully,
  response_message,
  created_at,
  updated_at
from run_rollup;

with real_orders as (
  select
    o.*,
    coalesce(o.order_run_id, o.id) as derived_run_id,
    case
      when o.provider = 'housecanary' then 'HouseCanary'
      when o.provider = 'clearcapital' then 'Clear Capital'
      else o.provider
    end as provider_label,
    case
      when jsonb_typeof(o.response_payload->'value') = 'number'
        then (o.response_payload->>'value')::numeric
      when jsonb_typeof(o.response_payload->'estimatedValue') = 'number'
        then (o.response_payload->>'estimatedValue')::numeric
      else null
    end as parsed_value,
    case
      when jsonb_typeof(o.response_payload->'fsd') = 'number'
        then (o.response_payload->>'fsd')::numeric
      when jsonb_typeof(o.response_payload->'forecastStdDev') = 'number'
        then (o.response_payload->>'forecastStdDev')::numeric
      else null
    end as parsed_fsd,
    case
      when o.response_payload->>'reportLink' is not null
       and btrim(o.response_payload->>'reportLink') <> ''
        then true
      else false
    end as has_report_link
  from loan_officer_avm_order_log o
  where not (
    o.request_payload->>'type' = 'housecanary_billing_backfill'
    or coalesce((o.response_payload->>'backfill')::boolean, false) = true
    or o.notes = 'Manual backfill to align HouseCanary cycle count to 28'
    or (o.loan_officer_prefix = 'system' and o.address = 'HouseCanary billing backfill')
  )
),
latest_per_provider as (
  select distinct on (derived_run_id, provider_label)
    derived_run_id,
    id,
    order_run_id,
    investor,
    provider_label,
    provider_product,
    order_status,
    requested_max_fsd,
    fsd_threshold_status,
    parsed_value,
    parsed_fsd,
    has_report_link,
    response_payload->>'errorMessage' as failure_message,
    created_at
  from real_orders
  order by derived_run_id, provider_label, created_at desc, id desc
),
winner_candidates as (
  select
    l.*,
    row_number() over (
      partition by derived_run_id
      order by
        case
          when order_status = 'completed'
           and parsed_value is not null
           and (
             requested_max_fsd is null
             or parsed_fsd is null
             or parsed_fsd <= requested_max_fsd + 0.0001
           )
          then 1 else 2 end,
        case
          when order_status = 'completed' and parsed_value is not null then 1 else 2 end,
        parsed_value desc nulls last,
        created_at desc,
        id desc
    ) as winner_rank
  from latest_per_provider l
)
insert into loan_officer_avm_analytics_providers (
  run_id,
  provider,
  supported,
  max_fsd_allowed,
  source,
  order_status,
  order_run_id,
  provider_product,
  targeted_investor,
  requested_max_fsd,
  fsd_threshold_status,
  value,
  fsd,
  is_winner,
  has_report_link,
  failure_message,
  created_at
)
select
  derived_run_id as run_id,
  provider_label as provider,
  true as supported,
  requested_max_fsd as max_fsd_allowed,
  'fresh' as source,
  order_status,
  order_run_id,
  provider_product,
  investor as targeted_investor,
  requested_max_fsd,
  fsd_threshold_status,
  parsed_value as value,
  parsed_fsd as fsd,
  (winner_rank = 1 and parsed_value is not null) as is_winner,
  has_report_link,
  failure_message,
  created_at
from winner_candidates;

commit;
