# AVM Cascade Decision Rules

Last updated: 2026-04-29

## Current agreed version

Goal: use HouseCanary estimate as the cheapest first screen, then decide whether to stop, hard-fail, or buy deeper valuation calls based on how close the supported max loan is to the borrower's target.

This document is intentionally verbose because the target-band logic became easy to misread in conversation and code review. The examples and ordering below are the source-of-truth intent for the current implementation.

## Core inputs

Let:
- `targetLoanAmount` = borrower requested loan amount
- `hcEstimateValue` = HouseCanary estimate result from `/v3/property/estimated_value`
- `hcEstimateMaxLoan` = max supported loan amount derived from the HC estimate using current LTV and balance logic
- `hcRatio = hcEstimateMaxLoan / targetLoanAmount`
- `ccMaxLoan` = max supported loan amount derived from Clear Capital
- `hcVerifiedMaxLoan` = max supported loan amount derived from HouseCanary full AVM after FSD is returned

Strong-confidence / eligibility thresholds:
- HouseCanary full AVM is considered eligible when `fsd < 0.20` and supported max loan is `>= $50,000`
- Clear Capital is considered eligible when `forecastStdDev < 0.20`, confidence is not low, and supported max loan is `>= $50,000`

Hard floor:
- Any provider result under `$50,000` supported max loan is treated as too weak to verify

## High-level flow

### Step 1: Always run HouseCanary estimate first

The first call is always the cheap HouseCanary estimate.

After that estimate returns, compute:
- `hcEstimateMaxLoan`
- `hcRatio`

Then branch by target band.

## Target-band decision rules after HC estimate

### Band A: HouseCanary estimate is close enough
Condition:
- `hcRatio >= 0.80`

Action:
- stay on the HouseCanary path
- run HouseCanary full AVM to get `fsd`, `price_lwr`, and `price_upr`
- do **not** skip directly to Clear Capital just because a second provider exists

Reason:
- the estimate is already close enough to target that HC remains the primary path
- full HC AVM is still needed to get confidence metadata and verified valuation outputs

Example:
- target = `$300,000`
- HC estimate max loan = `$245,000`
- ratio = `81.7%`
- result: continue to HC full AVM

### Band B: Mid-band miss, but still viable
Condition:
- `hcRatio >= 0.25`
- `hcRatio < 0.80`
- `hcEstimateMaxLoan >= $50,000`

Action:
- run **Clear Capital immediately before** HouseCanary full AVM
- this is the critical rule that must not be lost
- do **not** pay for HC full AVM first in this band

Reason:
- this is the "meaningfully short of target but still possibly salvageable" band
- Clear Capital gets first chance to rescue the deal before paying for HC full AVM

Example:
- target = `$300,000`
- HC estimate max loan = `$89,000`
- ratio = `29.7%`
- result: run Clear Capital first

Real-style example discussed in chat:
- target = `$285,000`
- HC estimate max loan = `$89,464`
- `25%` of target = `$71,250`
- `80%` of target = `$228,000`
- because `89,464` is above `$71,250`, below `$228,000`, and above `$50,000`, this is **mid-band**
- result: run Clear Capital first, not HC full AVM first

### Band C: Too weak to bother cascading
Condition:
- `hcRatio < 0.25`
- or `hcEstimateMaxLoan < $50,000`

Action:
- hard fail / exit ramp
- do not spend on Clear Capital
- do not continue to HC full AVM just to get FSD

Reason:
- the estimate is too far off target or too small to justify more paid valuation calls

Example:
- target = `$300,000`
- HC estimate max loan = `$60,000`
- ratio = `20%`
- result: no CC, exit ramp

## Detailed mid-band rescue logic

This is the part that was easy to lose. The sequence matters.

When HC estimate lands in the mid-band, use this order:

1. Run Clear Capital first
2. If Clear Capital is eligible **and** `ccMaxLoan >= hcEstimateMaxLoan`, use Clear Capital immediately
3. If Clear Capital is lower than HC estimate, or Clear Capital is not eligible, then continue to HouseCanary full AVM
4. After HouseCanary full AVM returns:
   - if HC full AVM is eligible, compare HC full AVM vs Clear Capital and use the higher eligible result
   - if HC full AVM is not eligible but Clear Capital is eligible, use Clear Capital
   - if neither provider is eligible, return exit ramp / low-confidence outcome

This means HC full AVM becomes a conditional second-pass only when Clear Capital did **not** already win cleanly.

## Why compare again after HC full AVM?

Because HC estimate is only a first-pass screen.

The higher-of-two comparison must use:
- Clear Capital result
- **HouseCanary full AVM result**, not just HC estimate

That matters especially when both providers are still below 25% of target after deeper evaluation. In that case, the comparison should happen after HC full AVM has had a chance to produce the stronger HC number.

## Practical examples

Assume target loan amount = `$300,000`
- `25%` threshold = `$75,000`
- `80%` threshold = `$240,000`

Examples:
- HC estimate max loan = `$40,000`
  - below `$50,000`
  - result: hard fail, no CC

- HC estimate max loan = `$60,000`
  - above floor, but below `25%` of target
  - result: hard fail, no CC

- HC estimate max loan = `$89,000`
  - above `25%`, below `80%`, above floor
  - result: run Clear Capital first

- HC estimate max loan = `$150,000`
  - same mid-band logic
  - result: run Clear Capital first

- HC estimate max loan = `$235,000`
  - still below `80%`
  - result: run Clear Capital first

- HC estimate max loan = `$245,000`
  - above `80%`
  - result: continue to HC full AVM, no automatic CC-first shortcut

## Current implementation intent in plain English

- HC estimate close to target (`>= 80%`) → stay on HC and get FSD
- HC estimate in the mid-band (`25%` to `80%`, with `>= $50k` support) → try CC before HC full AVM
- HC estimate too weak (`< 25%` or `< $50k`) → stop and exit ramp
- In mid-band cases where CC does not clearly win, run HC full AVM and then compare the stronger verified path

## Why this rule exists

- avoids paying for Clear Capital on deals that are already close enough on HC
- avoids paying for any second opinion on obvious no-deal properties
- gives borderline deals a rescue path
- preserves HC full AVM only where it can still change the outcome
- forces the final higher-of-two comparison to happen on better data than HC estimate alone

## Files to check when debugging

- `src/app/api/verify-value/route.ts`
- `docs/api/avm-cascade-decision-rules.md`
- `supabase/migrations/014_avm_provider_run_logs.sql`

## Durable warnings

- Do not casually move HC full AVM earlier in the mid-band path. That was a real bug.
- Do not compare Clear Capital only against HC estimate when the flow has already paid for HC full AVM. Use the full AVM result in the final higher-of-two comparison.
- Do not treat a successful Clear Capital API response as automatically verified. Confidence and `$50k` floor rules still apply.
- `avm_cache` is a result cache, not the durable per-attempt provider audit log.

## Future revision questions

- Should investor-specific overlays use normalized provider confidence directly, or still rely on raw provider-specific fields?
- Should some investors tolerate a weaker FSD / forecastStdDev threshold than `0.20`?
- Should the same target-band logic eventually incorporate investor-specific max-loan caps instead of only raw AVM support?
