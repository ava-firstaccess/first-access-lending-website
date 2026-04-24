# Clear Capital AVM API Deep Analysis

Source reviewed on 2026-04-13:
- Docs page: <https://api.clearcapital.com/api/avm-api#overview>
- OpenAPI spec: `https://api.clearcapital.com/apiDocs/avm-api/avm-api.yaml`

## Executive summary

Clear Capital exposes a REST AVM API with an API-key header, not username/password auth.

For our web app, the clean fit is:
- keep HouseCanary as the first-pass AVM
- call Clear Capital as a fallback or second opinion on low-confidence HouseCanary results
- store the Clear Capital API key server-side only
- never expose the API key in frontend code

The API supports both lightweight value-only lookups and richer full AVMs with confidence/FSD-style metrics, value ranges, provider metadata, optional details, optional saved results, and PDF retrieval.

## Base URL and auth

### Base URL
```text
https://api.clearcapital.com/avm
```

### Auth
The spec uses an API key security scheme:
- header name: `x-api-key`
- auth type: `apiKey`
- location: header

This is different from MeridianLink / SmartAPI.

## Endpoints

### 1. `GET /avm`
Full AVM by address.

Best fit for our cascade when we want a full underwriting-oriented result.

#### Required / key inputs
- `address` (required)
- `city` + `state` OR `zip`
- `trackingIds` optional
- `includeDetails` optional
- `isCascade` optional
- `userSelectedOrder` optional
- `buildDateMinimum` optional, Clear Capital only
- `retroAvmEffectiveDate` optional
- `maxFsdReturned` optional, Clear Capital only, default documented as `0.3`
- `dataSourceType` optional, only when not using cascade and requesting details
- `saveResult` optional
- `includePdf` optional
- `signResponse` optional

#### Important response characteristics
The full AVM response can include:
- `value`
- `valueHigh`
- `valueLow`
- `confidence`
- `confidenceDescription`
- `fsd`
- `providerKey`
- `providerModel`
- `providerName`
- `effectiveDate`
- `buildDate`
- Clear Capital-specific error-quality metrics:
  - probability within 5%
  - probability within 10%
  - probability within 20%
  - mean absolute predicted error
- optional PDF link when requested
- optional comparables, listing events, and property characteristics when `includeDetails=true`

### 2. `GET /avm-lite`
Value-only lookup.

This is the cheapest / fastest conceptual fit if we ever want a very lightweight secondary check, but it does **not** return the richer confidence fields used for decisioning.

Returns:
- AVM value
- provider metadata
- no FSD / confidence / range depth like full AVM

### 3. `GET /avm/{avmId}`
Retrieve a previously saved AVM.

Use only if we set `saveResult=true` on the original request and want later retrieval.

### 4. `GET /avm/{avmId}/pdf`
Retrieve PDF by previously generated AVM id.

Useful if we later want a downloadable valuation artifact.

### 5. `GET /interactive-avm`
Interactive AVM.

This endpoint allows subject-property adjustments in the request:
- `gla`
- `lotSize`
- `bedroomCount`
- `bathFullCount`
- `bathHalfCount`
- `yearBuilt`
- `condition`
- `retroAvmEffectiveDate`
- `maxFsdReturned`

This is likely not our first integration target, but it could be valuable later if we want to refine value using borrower-provided subject characteristics.

## Error handling and operational behavior

Documented status patterns:
- `400` invalid input
- `401` missing/invalid API key
- `403` forbidden / subscription restriction
- `404` AVM not found, address not matched, or not enough confidence/data
- `429` rate limiting
- `500` internal server error

The API also returns throttling metadata, including:
- retry-after style seconds to wait
- throttling summary headers/metadata
- request/response identifier

Implementation implication:
- our integration should explicitly handle `404` as a normal valuation miss, not a crash
- handle `429` with retry/backoff
- log Clear Capital response/request ids for debugging

## Address and matching notes

The spec strongly suggests:
- `zip` is preferred for best match quality
- `city/state` can be used when zip is unavailable
- standardized address quality matters

Implementation implication:
- use our normalized address path before calling Clear Capital
- if we already have parsed address fields, pass them cleanly

## Data worth capturing in our app

For the AVM cascade, the most useful fields to persist are:
- provider used
- returned value
- value high / low
- confidence
- confidence description
- fsd
- effective date
- build date
- provider model
- response/request id
- PDF link if available

If details are enabled, also consider saving:
- subject characteristics
- comparable summary
- listing event summary

## Recommended fit in our current AVM cascade

Current repo direction already uses HouseCanary first.

Recommended layering:
1. HouseCanary estimate first-pass
2. HouseCanary full AVM
3. If HouseCanary confidence is weak, call Clear Capital `GET /avm`
4. Return both provider results and select a final valuation according to a rule

### Suggested initial decision rule
Start simple and auditable:
- if HouseCanary is strong, keep HouseCanary
- if HouseCanary is weak or unavailable, use Clear Capital full AVM
- store both payload summaries when both are present

### Suggested thresholding
Our repo currently references HouseCanary FSD-style gating logic. A practical first version is:
- HouseCanary acceptable → no Clear Capital call
- HouseCanary low-confidence / missing result → call Clear Capital
- if Clear Capital returns a valid AVM, use it as fallback

## Best endpoint for first implementation

### Recommended first endpoint
`GET /avm`

Reason:
- richer underwriting signal than `avm-lite`
- includes confidence/range/provider metadata
- best fit for a fallback decision engine

### Not recommended as first target
- `interactive-avm`: useful later, but more moving parts
- `avm-lite`: too thin if we need a reliable fallback decision

## Security requirements for our website

Must be server-side only:
- Clear Capital API key in server env only
- no client-side exposure
- no browser-direct call to Clear Capital

Recommended env vars:
```bash
CLEAR_CAPITAL_API_KEY=
CLEAR_CAPITAL_BASE_URL=https://api.clearcapital.com/avm
CLEAR_CAPITAL_ENABLED=true
```

## Proposed implementation shape in the website repo

Suggested server helper:
- `src/lib/clear-capital.ts`

Suggested route integration point:
- extend `src/app/api/verify-value/route.ts`

Suggested helper responsibilities:
- build query params from normalized address
- call `GET /avm`
- parse value/confidence/fsd/provider fields
- normalize response into our internal AVM shape
- throw structured errors for `401/403/404/429/500`

## Example request shape for our app

```ts
GET /avm?address=123%20Main%20St&city=Sacramento&state=CA&zip=95814&includeDetails=false&saveResult=false
x-api-key: <server-side secret>
```

## Integration risks / watchouts

1. `404` does not always mean code failure
- can mean address mismatch or insufficient confidence/data

2. `includeDetails=true` likely increases payload size and cost/latency
- use only when we really want deeper detail

3. Clear Capital supports its own cascade and user-selected provider order
- we should **not** mix their internal cascade logic with our own external provider cascade until we intentionally decide to

4. `maxFsdReturned` is Clear Capital-specific
- useful if we want to constrain low-confidence returns
- but use carefully so we do not turn a fallback into a silent miss factory

## Recommended next build step

Implement a narrow fallback helper first:
- full AVM only
- address in, normalized fallback result out
- no PDF, no saved result, no details on version 1

Then wire it into `/api/verify-value` only when HouseCanary confidence is below threshold or HC fails.

## Bottom line

Clear Capital is a good fallback fit for our AVM cascade.

Best first integration:
- `GET /avm`
- server-side only
- fallback after weak/missing HouseCanary result
- normalize and store value + confidence/range/provider metadata
