# AVM Cascade Decision Rules

Last updated: 2026-04-13

## Current agreed version

Goal: use HouseCanary first, only pay for Clear Capital when the HouseCanary result is meaningfully short of the borrower's target but not obviously dead.

## Step 1: Run HouseCanary

Run the existing HouseCanary flow first:
1. Property Estimate
2. Full AVM when needed by the existing route logic

## Step 2: Compare HouseCanary max loan to borrower target

Let:
- `targetLoanAmount` = borrower requested loan amount
- `hcMaxLoan` = HouseCanary-supported max loan amount based on the current quote logic
- `hcRatio = hcMaxLoan / targetLoanAmount`

## Decision rules

### A. Accept HouseCanary and stop
Use HouseCanary only when:
- `hcRatio >= 0.80`

Example:
- target = $100,000
- HC max loan = $80,000
- Result: keep HouseCanary, do not run Clear Capital

### B. Cascade to Clear Capital
Run Clear Capital when:
- `hcRatio < 0.80`
- and `hcRatio >= 0.25`

Example:
- target = $100,000
- HC max loan = $70,000
- Result: run Clear Capital as second opinion

### C. Hard fail, no Clear Capital call
Do not run Clear Capital when either is true:
- `hcRatio < 0.25`
- or `hcMaxLoan < 25000`

Example:
- target = $100,000
- HC max loan = $10,000
- Result: reject without paying for Clear Capital

## Confidence overlay

This loan-to-target rule is the current primary cascade rule.

A separate confidence rule may still be layered in later, for example:
- weak HouseCanary confidence / high FSD triggers Clear Capital even if the ratio is otherwise acceptable

That is not the current default decision rule unless added explicitly.

## Current implementation intent

Version 1 should use this simple logic:
- `hcRatio >= 0.80` → use HC
- `hcRatio >= 0.25` and `hcRatio < 0.80` and `hcMaxLoan >= 25000` → run CC
- `hcRatio < 0.25` or `hcMaxLoan < 25000` → stop

## Why this rule exists

- avoids paying for Clear Capital on deals that are already close enough
- gives borderline misses a second opinion
- avoids wasting Clear Capital calls on obvious no-deal properties

## Open questions for future revision

- should weak HouseCanary FSD override the ratio rule?
- if Clear Capital and HouseCanary disagree, which provider wins?
- should we use lower-of-two, higher-confidence provider, or a capped reconciliation rule?
