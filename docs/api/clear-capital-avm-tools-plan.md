# Clear Capital AVM Tools Plan

Updated: 2026-05-06

## Split we need to preserve

There are two different Clear Capital API families involved here:

1. **Order PDF**
   - API family: **Property Analytics API**
   - Host: `https://api.clearcapital.com/property-analytics-api`
   - Existing credential family: `CLEARCAPITAL_PAA_API_KEY`
   - Relevant endpoints:
     - `POST /orders`
     - `GET /orders/{orderId}`
     - `GET /orders/{orderId}/pdf`

2. **Order PCI**
   - API family: **Property Valuation API**
   - Host: `https://api.clearcapital.com/property-valuation-api`
   - Separate credential family from PAA
   - Relevant endpoints:
     - `GET /products`
     - `POST /orders`
     - `GET /orders/{orderId}`
   - PCI product codes exposed in the docs include:
     - `PCI_EXTERIOR`
     - `PCI_INTERIOR`
     - `PCI_EXTERIOR_AVM`
     - `AUTOMATED_PCR`
     - `POST_DISASTER_INSPECTION`

## Postman files added

- `docs/api/postman/clear-capital-paa-order-pdf.postman_collection.json`
- `docs/api/postman/clear-capital-property-valuation-pci.postman_collection.json`

## Intended website behavior

### 1. Order PDF
Processor clicks **Order PDF** in AVM Tools:
- create Property Analytics order with `clearAvm.include = true`
- request `GET /orders/{orderId}/pdf?returnUrl=true`
- show signed PDF download link in UI
- email the link or PDF delivery summary like the current HC flow

### 2. Order PCI
Processor clicks **Order PCI** in AVM Tools:
- create Property Valuation order using PCI product code
- likely asynchronous lifecycle, not the same instant PDF flow as PAA
- UI should show accepted order state and resulting order id first
- once we confirm deliverable behavior, we can add document/retrieval handling

## Notes

- PCI is **not** a Property Analytics credential flow.
- We should not reuse `CLEARCAPITAL_PAA_API_KEY` for PCI.
- Before wiring PCI into the app, we should confirm:
  - exact product default (`PCI_EXTERIOR` vs `PCI_INTERIOR` vs `PCI_EXTERIOR_AVM`)
  - whether `x-tenant-id` is required for this account
  - how completed PCI deliverables are retrieved in practice for this subscription

## Outstanding real-world verification

- The webhook subscription is now live and the webhook receiver has SNS signature verification, auto-confirm protection, and volume alerting.
- We still need to validate the full lifecycle with the **first real PCI order** placed through this workflow.
- On that first real PCI request, verify all of the following:
  - Clear Capital event delivery actually reaches `/api/clear-capital/pci-webhook`
  - the order appears correctly in `clear_capital_pci_orders`
  - the LP `/processor` table updates with the real status progression
  - status alert emails send correctly to `CLEARCAPITAL_PCI_ALERT_EMAIL`
  - any real deliverable/export links returned on completion behave as expected for this subscription
- Future-work reference: see `FUTURE_WORK.md` under **AVM Integration**.
