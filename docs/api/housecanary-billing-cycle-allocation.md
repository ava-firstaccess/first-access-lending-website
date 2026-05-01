# HouseCanary billing-cycle allocation

## Goal

When a HouseCanary order is placed from the LO AVM workflow:

1. Use **Property Explorer** for the first 40 HouseCanary orders in the billing cycle
2. After that, use **Agile Insights** for the rest of the cycle
3. Track whether the chosen product still falls inside its own monthly free tier

## Current billing-cycle seed

Known cycles captured from billing statements / user confirmation:

- `2026-02-26` to `2026-03-26`
- `2026-03-27` to `2026-04-26`
- `2026-04-27` to `2026-05-27`

Future cycles continue from the latest known cycle using:

- next start = previous end + 1 day
- next end = next start + 1 calendar month

That means the next projected cycle after `2026-04-27` to `2026-05-27` is:

- `2026-05-28` to `2026-06-28`

Yes, it is weird. We are preserving the billing reality instead of pretending it is a neat month boundary.

## Routing rule

Within a billing cycle:

- Property Explorer orders `1-40` → `property_explorer`
- Order `41+` → `agile_insights`

Free-tier tracking:

- Property Explorer free tier: first `40` Property Explorer orders
- Agile Insights free tier: first `40` Agile Insights orders

So:

- orders `1-40` are Property Explorer and free
- orders `41-80` are Agile Insights and still free
- orders `81+` are Agile Insights and paid, but still cheaper than continuing with Property Explorer

## Code

Helper file:

- `src/lib/housecanary-billing.ts`

Main exports:

- `getHouseCanaryBillingCycle(date)`
- `chooseHouseCanaryOrderProduct({ propertyExplorerOrders, agileInsightsOrders }, date)`

## Persistence

`loan_officer_avm_orders` now has HouseCanary allocation fields:

- `housecanary_billing_cycle_start`
- `housecanary_billing_cycle_end`
- `housecanary_order_product`
- `housecanary_product_sequence_number`
- `housecanary_overall_sequence_number`
- `housecanary_free_tier_applied`

## Intended wiring

When we wire real HouseCanary outbound ordering:

1. determine the billing cycle for `ordered_at`
2. count existing LO AVM HouseCanary orders in that cycle by product
3. call `chooseHouseCanaryOrderProduct(...)`
4. submit:
   - Property Explorer if selected product = `property_explorer`
   - Agile Insights if selected product = `agile_insights`
5. persist the cycle metadata onto `loan_officer_avm_orders`
