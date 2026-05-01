# Pricer Hardcoded Items Audit

Date: 2026-05-01
Scope: current `/pricer` pricing stack in `first-access-lending-website`

## Plain-English summary

Most investor pricing grids and LLPA matrices are now workbook-backed through generated JSON files.

That said, `/pricer` still has a meaningful set of code-side logic that is **not** sourced from investor JSON. Some of this is appropriate and probably should stay in code. Some of it is simply metadata / orchestration that has not been moved into JSON yet.

This document is a human-readable list of the current non-JSON hardcoded items I found.

## 1. AVM rule matrix is hardcoded in code

File:
- `src/lib/rates/investor-confidence-rules.ts`

What is hardcoded:
- investor-to-provider support matrix
- minimum confidence thresholds
- derived max FSD thresholds
- supported vs unsupported AVM provider combinations
- explanatory notes like `Vista*`

What this means:
- AVM eligibility logic does **not** update from workbook / ratesheet JSON today
- if investor AVM rules change, this file must be edited

## 2. BestX orchestration rules are hardcoded in code

File:
- `src/lib/stage1-pricing/server.ts`

What is hardcoded:
- doc-type mapping between the UI contract and each investor engine
- which investors are allowed / blocked for HELOC vs CES in BestX mode
- which products are available for each investor by term
- lock-period padding assumptions for BestX mode
  - example: BestX lock days are padded by 30 days before being sent to several investor engines
- investor-specific restrictions such as:
  - OSB only allowing padded 45/60 day lock pricing
  - Verus HELOC only allowing 3 or 5 year draws
  - NewRez alt-doc blocked in current Home Equity workbook integration
  - Deephaven product/doc-type support gating
- requested-rate ladder generation used to search for borrower-facing outcomes

What this means:
- even if JSON pricing updates, these cross-investor routing / support decisions do **not** update automatically
- this file is the main source of truth for how the app decides which investor engines can participate in BestX mode

## 3. State points-and-fees caps are hardcoded in the UI

File:
- `src/components/Stage1PricingPage.tsx`

What is hardcoded:
- state caps currently defined only for:
  - Florida = 4%
  - Maryland = 4%
- CES uses a hardcoded 3% cap, reduced further if a lower state cap exists
- HELOC uses the state cap only when one is hardcoded in this file

What this means:
- this alerting is not JSON-backed today
- if state points-and-fees rules expand, this file must be updated

## 4. Button still has intentional code-side logic even though pricing rows are JSON-backed

Files:
- `src/lib/rates/button.ts`
- `src/lib/rates/button-ratesheet.json`

JSON-backed today:
- note-rate price ladder
- CLTV matrix
- DTI table
- occupancy / unit / cash-out adjustments
- maturity / draw adjustments
- balance LLPAs, including the high-balance rows we just fixed

Still hardcoded in code:
- target margin schedule used by `getTargetPurchasePriceForLoanAmount()`
- lock extension math
  - baseline 30 days
  - `-0.125` per extra 15-day increment
- fallback max purchase price constant (`105`) when guide max is not present
- FICO bucket labels / CLTV bucket boundaries used to index workbook data
- product normalization and doc-type interpretation
- payment formulas
- max-available / max-LTV calculation logic

What this means:
- Button pricing matrices update from JSON
- Button orchestration, formulas, bucket interpretation, and fallback behavior still live in code

## 5. Arc Home is mostly JSON-backed for pricing, but still has hardcoded structure / formulas

File:
- `src/lib/rates/arc-home.ts`

What is hardcoded:
- lock-period column map
- list of supported products
- term-to-years mapping
- CLTV bucket boundaries used to index workbook values
- payment / amortization formulas
- target-price clamping and quote-selection behavior

What this means:
- Arc Home matrix values mostly come from JSON
- product metadata, formula behavior, and lookup interpretation still live in code

## 6. Verus contains the biggest remaining hardcoded pricing tables

File:
- `src/lib/rates/verus.ts`

What is hardcoded:
- CES loan amount matrix
- CES DTI matrix
- CES standard doc pricing matrix
- CES alt-doc pricing matrix
- CES occupancy matrix
- CES property-type matrix
- CES state matrix
- CES lock adjustments
- HELOC standard doc pricing matrix
- HELOC alt-doc pricing matrix
- HELOC draw-term matrix
- HELOC DTI matrix
- HELOC loan amount matrix
- HELOC occupancy matrix
- HELOC property-type matrix
- HELOC state matrix
- HELOC lock adjustments
- HELOC max buy price fallback
- special state bucket list: `CT, IL, NJ, NY`

What this means:
- Verus is **not** fully workbook/JSON-driven today
- this is the largest remaining pricing engine where major LLPA content is still embedded directly in code

## 7. NewRez has a few intentional hardcoded business rules

File:
- `src/lib/rates/newrez.ts`

What is hardcoded:
- default end-seconds fallback (`BE45`)
- hard block to 1-unit properties only
- lock-period whitelist (15 / 30 / 45 / 60)
- code-side statement that alt-doc is not supported in the current Home Equity workbook integration
- guide max fallback default if JSON is missing

What this means:
- NewRez pricing data is largely workbook-backed
- some business restrictions and fallbacks still live in code on purpose

## 8. OSB has code-side rate-display and payment logic

File:
- `src/lib/rates/osb.ts`

What is hardcoded:
- HELOC displayed rate = Prime + workbook margin logic
- reverse conversion from displayed rate back to workbook margin
- payment formulas
  - HELOC interest-only approximation
  - CES amortization by term
- target-price clamping behavior using workbook constraints
- helper logic to interpret credit-score labels / CLTV labels / documentation adjustments

What this means:
- OSB workbook data is used heavily
- but rate presentation logic and loan math are still code-side

## 9. Deephaven has code-side support and lock logic

File:
- `src/lib/rates/deephaven.ts`

What is hardcoded:
- doc-type support routing across Deephaven programs
- lock-period requirement messaging / gating
- quote-picking / target solver behavior
- max-available aggregation across programs
- workbook-selection logic by program and product

What this means:
- Deephaven pricing values come from workbook-backed data where available
- but support logic and orchestration remain in code

## 10. UI / session defaults are hardcoded

Files:
- `src/lib/stage1-pricing/types.ts`
- `src/components/Stage1PricingPage.tsx`

What is hardcoded:
- default input values for the tester / pricer form
- localStorage / sessionStorage keys
- default tolerance behavior
- borrower-facing points rounding behavior
- some display labeling / wording

What this means:
- not a pricing-matrix problem
- but these are still fixed in code rather than data-driven

## What is now correctly JSON-backed from the Button fix

After today’s cleanup, the following Button piece is now on the correct path:

- Button high-balance loan amount LLPAs now come from `button-ratesheet.json`
- generator now pulls the correct balance row labels from the workbook
- verifier script now validates against the current `latest_button.xlsx` snapshot

## Most important takeaway

If your goal is:

- "when the investor workbook changes, pricing should update naturally through JSON"

then the biggest remaining gap I see is:

### Verus
Verus still has a large amount of pricing content embedded directly in `verus.ts` instead of being sourced from workbook-generated JSON.

That is the highest-value area for future cleanup if you want stronger workbook-to-JSON-to-pricer consistency.

## Recommended priority order for future cleanup

1. **Verus**
   - move hardcoded matrices out of `verus.ts` into workbook-generated JSON
2. **AVM rule matrix**
   - move investor/provider/FSD thresholds into a data file if you want easier maintenance
3. **Stage1 BestX orchestration metadata**
   - doc-type mappings, lock constraints, investor availability matrix
4. **State points-and-fees cap map**
   - move to a dedicated config/data file if this expands

## Bottom line

Today’s accidental hardcoding around Button loan amount LLPAs has been corrected.

The remaining non-JSON items are mostly:
- orchestration rules
- business restrictions
- formulas
- fallback defaults
- and, in Verus specifically, still-hardcoded pricing matrices
