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

## Next real integration step

When Birchwood sandbox docs and credentials are confirmed:

1. keep the sandbox-only guard
2. add a provider adapter in `src/lib/credit-birchwood.ts`
3. keep this response contract stable
4. swap the `mock` branch in `src/app/api/credit/softpull/route.ts`
5. log one real sandbox smoke-test payload and response
