# Credit Soft Pull Sandbox Smoke Test

Last updated: 2026-04-20

## Where we left off

The soft credit check API is still intentionally sandbox-only.

Current server route:
- `POST /api/credit/softpull`
- `GET /api/credit/softpull`

Current status:
- production mode is blocked
- real Birchwood integration is not wired yet
- sandbox provider remains `mock`
- approved test borrower guard is enforced before any response is returned
- the quote UI now calls the API instead of using a frontend timeout/mock

## Important limitation

This is **not** a real credit pull yet.

It returns a normalized mock response shaped like the real integration should look:
- representative score
- liabilities
- mortgage tradelines
- summary totals

That means we can safely finish:
- UI wiring
- route contract
- error handling
- Postman smoke tests
- later Birchwood adapter swap-in

## Approved test borrowers

Use one of these only:

1. `Test Borrower` + SSN last 4 `0000`
2. `Credit Tester` + SSN last 4 `1234`
3. `Sandbox User` + SSN last 4 `9999`

## Local smoke test

### GET metadata check

```bash
curl http://localhost:3000/api/credit/softpull
```

Expected:
- `success: true`
- `sandboxOnly: true`
- provider shown as `mock` unless env overrides it

### POST happy path

```bash
curl -X POST http://localhost:3000/api/credit/softpull \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sandbox",
    "borrower": {
      "firstName": "Test",
      "lastName": "Borrower",
      "dob": "1990-01-01",
      "ssn": "111-11-0000"
    }
  }'
```

Expected:
- `success: true`
- `scores.representative`
- `mortgages[]`
- `liabilities[]`
- `summary.mortgageCount`

### POST with co-borrower

```bash
curl -X POST http://localhost:3000/api/credit/softpull \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sandbox",
    "borrower": {
      "firstName": "Test",
      "lastName": "Borrower",
      "dob": "1990-01-01",
      "ssn": "111-11-0000"
    },
    "coborrower": {
      "firstName": "Jane",
      "lastName": "Borrower",
      "dob": "1991-02-02",
      "ssn": "222-22-2222"
    }
  }'
```

Expected:
- still allowed because only the primary borrower is currently approval-gated
- returns `coborrower` object
- one tradeline may be marked `joint`

### POST blocked borrower

```bash
curl -X POST http://localhost:3000/api/credit/softpull \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sandbox",
    "borrower": {
      "firstName": "Real",
      "lastName": "Consumer",
      "ssn": "111-22-3333"
    }
  }'
```

Expected:
- HTTP `400`
- error about approved test identity only

## Postman

Collection file:
- `docs/api/postman/credit-softpull-sandbox.postman_collection.json`

Suggested Postman variable:
- `baseUrl = http://localhost:3000`

## MeridianLink prod test mode

A locked prod-test path now exists for the approved MeridianLink test borrower only.

Request mode:
- `production-test`

Required provider setting:
- `CREDIT_API_PROVIDER=meridianlink`

Approved prod test borrower:
- `Bill Testcase`
- SSN `000000015`

Current behavior:
- only the exact approved prod test borrower is allowed
- anything else is rejected before the provider call
- the route submits the approved test-order XML to MeridianLink and returns the vendor order id when present

Important deployment note:
- local Mac testing can fall back to Keychain labels `birchwood-credit-username` and `birchwood-credit-password`
- deployed/Vercel testing should use env vars instead: `BIRCHWOOD_CREDIT_USERNAME`, `BIRCHWOOD_CREDIT_PASSWORD`, `BIRCHWOOD_CREDIT_BASE_URL`, `BIRCHWOOD_CREDIT_INTERFACE`, `BIRCHWOOD_CREDIT_CLIENT_IDENTIFIER`, `BIRCHWOOD_CREDIT_CLIENT_IDENTIFIER_HEADER`
- MeridianLink also expects the separate client identifier value, currently defaulted to `B0`


## Mac proxy route

To force the app through the Mac as the MeridianLink egress point:

1. Run the proxy server on the Mac
   - `npm run meridianlink:proxy`
2. Point the app or local shell at the proxy URL
   - `MERIDIANLINK_PROXY_URL=https://45-76-228-174.sslip.io/meridianlink/prod-test`
3. Keep the normal approved prod-test payload and allowlist in place

This proxy path is the one to port to the VPS later, by changing only the proxy host URL.

### Prod test curl example

```bash
curl -X POST http://localhost:3000/api/credit/softpull \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "production-test",
    "borrower": {
      "firstName": "Bill",
      "lastName": "Testcase",
      "ssn": "000000015"
    }
  }'
```

## Next real integration step

1. run the first approved MeridianLink prod test pull
2. inspect the real MISMO response fields returned by Birchwood/MeridianLink
3. normalize score, liabilities, and mortgage tradelines into the same route contract used by the mock sandbox flow
4. keep the production-test allowlist in place until Zach explicitly wants broader non-test borrower support
