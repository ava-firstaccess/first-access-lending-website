# Button Rate Engine Gap Analysis

Last updated: 2026-04-13

## Goal

Replace the placeholder stage 1 rate quote logic with a real Button-backed pricing engine using the Button rate sheet workbook as the starting source of truth.

## Current quote app state

The current stage 1 quote results page still uses a placeholder `calcQuote(...)` function.

What exists already:
- stage 1 intake flow
- stage 1 results page
- product selection and loan sizing scaffolding
- quote sidebar / builder UI

What does not exist yet:
- real Button pricing ingestion
- real Button LLPA calculation engine
- daily Button rate sheet normalization
- investor-backed note rate / margin / adjustment output

## Button workbook we are using

Source file:
- `first-access-lending/getaccess/ratesheets/2026-04-13 - fully delegated - external rate sheet - Intraday.xlsx`

The workbook includes a `Pricing` tab that behaves like an input sheet and a `Work` tab that appears to hold LLPA / pricing logic.

## Stage 1 fields currently collected in the web app

Current `Stage1Data` fields:
- product
- propertyAddress
- propertyState
- propertyValue
- loanBalance
- creditScore
- propertyType (`Primary`, `Investment`, `2nd Home`)
- occupancy (`Owner-Occupied`, `Rental`)
- cashOut
- cashOutAmount
- structureType (`SFR`, `Condo`, `Townhouse`, `Multi-Family`, `PUD`)
- numberOfUnits
- unitNumber

## Button workbook inputs we can already map from stage 1

Strong direct matches:
- FICO
- estimated property value
- current balance
- desired new cash / resulting new loan context
- occupancy / use intent
- property / structure type
- unit count
- cash out vs no cash out intent
- state

Likely mappable with current quote math:
- CLTV / LTV style result
- loan amount / new money amount

## Inputs the Button pricing logic appears to want beyond current stage 1

These are the likely missing or partially missing pricing factors for accurate LLPA / rate selection:
- DTI
- doc type / income documentation type
  - full doc
  - bank statement
  - DSCR
  - etc.
- self-employed flag
- bank statement months
- exact occupancy bucket if Button distinguishes more finely than our current stage 1
- possibly delegated / channel assumptions if they matter to pricing branch selection
- possibly lock period / term / draw / IO configuration depending on final product output we want
- potentially lien / unpaid balance edge-case handling if Button sheet differentiates them

## Best version 1 implementation approach

### Recommendation
Drive a simplified Button engine from stage 1 with explicit defaults for the missing fields.

Version 1 defaults could be:
- doc type = full doc
- DTI = default conservative bucket or omit if not required for first-pass pricing
- self-employed = false
- bank statement months = N/A
- delegated channel = fixed to the workbook version in use

This gets real rate-sheet pricing into stage 1 faster without pretending we have every downstream LLPA input.

## What we should discuss before coding the final engine

### 1. Product scope
What exactly do we want Button to price first?
- HELOC only?
- CES / closed-end second?
- both?

### 2. Output shown on stage 1
What do we want the user to see from Button first?
- note rate only
- APR
- max loan
- payment example
- points / price adjustment
- lender name and product name

### 3. Default assumptions for missing LLPA fields
My recommendation for version 1:
- assume full doc
- assume not self-employed
- do not vary bank statement logic yet
- do not vary by DTI until stage 2 or later unless Button pricing absolutely requires it

### 4. Whether stage 1 should be pricing-accurate or directionally accurate
If stage 1 is a consumer-facing teaser quote, we can tolerate some defaults.
If stage 1 is intended to be close to lock-desk pricing, we need more intake fields earlier.

## Recommended next build order

1. Extract a normalized Button input model from the workbook
2. Build a `ButtonPricingInput` mapper from `Stage1Data`
3. Hard-code version 1 assumptions for missing LLPA fields
4. Replace placeholder stage 1 quote calculation with Button-backed output
5. Log all assumptions in the output for internal review
6. Add missing LLPA fields later only where they materially change price

## My recommendation

Start with a version 1 Button engine using stage 1 data plus a few explicit defaults.

The biggest likely missing data points for true LLPA accuracy are:
- DTI
- doc type
- self-employed / bank statement path

Those are the first items I would discuss before we call the output production-accurate.
