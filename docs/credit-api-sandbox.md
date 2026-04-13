# Credit API Sandbox Guardrails

## Current status

A test-only endpoint now exists at:

- `POST /api/credit/softpull`
- `GET /api/credit/softpull`

This route is intentionally sandbox-only.

## Safety rules

- `CREDIT_API_MODE` defaults to `sandbox`
- Production mode is blocked by default in the route
- Only approved test borrowers are allowed
- Real consumer pulls are rejected
- Default provider is `mock` until Birchwood sandbox docs/credentials are confirmed

## Environment variables

```bash
CREDIT_API_MODE=sandbox
CREDIT_API_PROVIDER=mock
```

## Approved test borrowers

Configured in `src/lib/credit.ts`.

Current test identities:
- Test Borrower, SSN last 4 `0000`
- Credit Tester, SSN last 4 `1234`
- Sandbox User, SSN last 4 `9999`

## Example request

```json
{
  "mode": "sandbox",
  "borrower": {
    "firstName": "Test",
    "lastName": "Borrower",
    "ssnLast4": "0000"
  }
}
```

## Next step

Once Birchwood sandbox documentation and non-billable credentials are verified, replace the mock branch in `src/app/api/credit/softpull/route.ts` with the real sandbox provider call, keeping the sandbox-only guards in place.
