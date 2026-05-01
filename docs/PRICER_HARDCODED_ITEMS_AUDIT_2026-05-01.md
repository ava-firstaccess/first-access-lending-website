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

## 5. Arc Home, completed in this pass

Files:
- `src/lib/rates/arc-home.ts`
- `src/lib/rates/arc-home-ratesheet.json`
- `scripts/refresh-ratesheet-data.mjs`

What moved off hardcode:
- supported lock periods are now carried in workbook-backed JSON
- supported product list now comes from workbook-backed JSON
- CLTV max is now derived from workbook-backed CLTV bucket labels
- CLTV bucket boundaries used for matrix indexing are now interpreted from workbook-backed CLTV labels instead of a fixed code-side boundary array
- FICO bucket matching now resolves from workbook-backed FICO row labels instead of a fixed code-side score ladder
- loan-amount bucket matching now resolves from workbook-backed loan-amount row labels instead of a fixed code-side amount ladder
- DTI label matching now resolves from workbook-backed DTI row labels instead of a fixed code-side label
- max available now derives from workbook-backed CLTV and workbook-backed top loan-amount bucket instead of fixed `80%` and `500000` constants
- term-years for payment math now derive from the product label instead of a hardcoded term map
- monthly payment and max-available math now use shared helpers instead of Arc-local formula code where possible

What is still hardcoded:
- lock-period column name map (`15 Day`, `30 Day`, `45 Day`, `60 Day`, `75 Day`, `90 Day`) still lives in code even though supported lock periods now come from JSON
- occupancy normalization (`Primary`, `Second Home`, `Investment`)
- property-type normalization (`Single Family`, `2-4 Units`, `PUD`, `Condo`)
- borrower target-price schedule from `getTargetPurchasePriceForLoanAmount()`
- target-price clamping behavior and quote-selection strategy
- the 45-day benchmark assumption used for lock-period display adjustment
- Arc Home-specific eligibility messaging and orchestration

What this means:
- Arc Home is now more workbook-driven for bucket interpretation and range limits
- the remaining code-side pieces are mostly normalization and engine behavior, not the main pricing matrices themselves

## 6. Verus, completed in this pass

Files:
- `src/lib/rates/verus.ts`
- `src/lib/rates/verus-ratesheet.json`
- `scripts/refresh-ratesheet-data.mjs`

What moved off hardcode:
- CES standard-doc FICO/CLTV matrix
- CES alt-doc FICO/CLTV matrix
- CES DTI matrix
- CES loan amount matrix
- CES occupancy matrix
- CES property-type matrix
- CES state matrix
- CES lock adjustments
- HELOC standard-doc FICO/CLTV matrix
- HELOC alt-doc FICO/CLTV matrix
- HELOC draw-term matrix
- HELOC DTI matrix
- HELOC loan amount matrix
- HELOC occupancy matrix
- HELOC property-type matrix
- HELOC state matrix
- HELOC lock adjustments
- FICO row labels now come from workbook-backed JSON
- CLTV column labels/bands now come from workbook-backed JSON
- state bucket membership now comes from the workbook-backed state row label instead of a code-side set
- HELOC max-price clamp now uses workbook-backed guide max instead of a separate hardcoded fallback constant
- HELOC interest-only and CES amortizing payment math now use shared helpers instead of Verus-local formula code
- max-available math now uses the shared helper instead of Verus-local formula code

What is still hardcoded:
- product normalization and term mapping
- occupancy normalization (`Primary` / `Second Home` / `Investment`)
- property-type interpretation (`Condo`, `2-4 Unit`)
- borrower target-price schedule from `getTargetPurchasePriceForLoanAmount()`
- quote-picking / target-solver behavior
- general parsing logic that interprets workbook labels into buckets
- Verus-supported draw-period choices exposed by the app (`2`, `3`, `5` years)

What this means:
- Verus pricing content is now materially more workbook-driven
- the remaining code-side pieces are mostly orchestration, normalization, or generic formula behavior rather than embedded LLPA tables

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
