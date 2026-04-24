# Clear Capital API Test Plan

Last updated: 2026-04-13

## Purpose

Document the correct environment separation, Keychain labels, endpoints, and next test steps for Clear Capital so we can pause this thread safely and return to it without confusion.

## API families in scope

There are three separate Clear Capital API families we now have credentials for:

1. **AVM API**
2. **Property Analytics API (PAA)**
3. **Property Valuation API** (human-based orders, later)

## Keychain labels

### Production
- `clearcapital-avm-api-key`
- `clearcapital-paa-api-key`
- `clearcapital-property-valuation-api-key`

### Integration / test
- `clearcapital-avm-integ-api-key`
- `clearcapital-paa-integ-api-key`
- `clearcapital-property-valuation-integ-api-key`

## Environment separation

### Production hosts
- AVM / related prod family: `https://api.clearcapital.com/...`
- PAA prod family: `https://api.clearcapital.com/property-analytics-api/...`
- Property Valuation prod family: `https://api.clearcapital.com/property-valuation-api/...`

### Integration hosts
- AVM integration: `https://api.integ.clearcapital.com/avm/avm`
- PAA integration: `https://api.integ.clearcapital.com/property-analytics-api/orders`
- Property Valuation integration host still to be confirmed before testing if needed

## Confirmed integration examples

### AVM integration cURL
```bash
curl -X GET "https://api.integ.clearcapital.com/avm/avm?address=14333%20Davos%20Dr&city=Truckee&state=CA&zip=96161&trackingIds=testTrackingId&includeDetails=true&isCascade=false&saveResult=false&includePdf=false" \
  -H "accept: application/json" \
  -H "x-api-key: <clearcapital-avm-integ-api-key>"
```

### PAA integration cURL
```bash
curl -X POST "https://api.integ.clearcapital.com/property-analytics-api/orders" \
  -H "accept: application/json" \
  -H "x-api-key: <clearcapital-paa-integ-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "123 Main St",
    "city": "City",
    "state": "CA",
    "zip": "99999",
    "signResponse": true,
    "trackingIds": 12345678,
    "clearAvm": {
      "include": true,
      "request": {
        "maxFSD": 0.3,
        "exactEffectiveDate": false
      }
    }
  }'
```

## Recommended test order

### First test
Use **AVM integration** first.

Reason:
- simplest request shape
- direct value result
- easiest auth validation
- lowest ambiguity compared to broader property-analytics orders

### Second test
Use **PAA integration** with `clearAvm.include = true`.

Reason:
- validates the order-based workflow we may use later
- still keeps scope limited to ClearAVM first

## Recommended testing rules

- use integration hosts with integration keys
- do not mix prod keys with integration hosts
- do not mix integration keys with prod hosts
- start with AVM before PAA
- do not introduce PDF/report features on the first successful test
- log exact request/response payloads for the first green run

## Recommended next implementation steps

1. Build Postman import files for:
   - AVM integration
   - PAA integration
2. Store no API keys inside the collection files
3. Use environment variables only
4. Run one successful AVM integration smoke test
5. Run one successful PAA integration smoke test
6. Only after that, wire the server-side website helper

## Notes for website integration later

- API keys must remain server-side only
- no frontend/browser direct calls to Clear Capital
- AVM fallback path should use the AVM API first
- PAA can be used later if we want order-based value workflows
- Property Valuation API is a separate later thread for human valuation orders

## Current status

Clear Capital is now documented well enough to pause safely.

Current active work should remain on:
- **Button rate-sheet intake and rate engine**

Not current active work:
- wiring Clear Capital into the website today
- running more Clear Capital tests before we intentionally switch back to that thread
