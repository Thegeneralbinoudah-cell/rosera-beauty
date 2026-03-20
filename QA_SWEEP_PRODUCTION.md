# ROSERA Production QA Sweep (15-Minute Runbook)

Use this checklist before every production release.

## 0) Test Accounts

- Customer account (normal user)
- Admin account
- Owner or supervisor account

## 1) System Sanity (2 min)

- Open `/admin`
- Confirm dashboard cards load (no blank widgets)
- Confirm "System Health" cards are visible:
  - Orders without shipment
  - Shipments without tracking
  - SLA breached
  - Near SLA breach (24h)
- Confirm no console errors in browser devtools

Pass criteria:
- Dashboard renders all KPI blocks and no runtime errors appear.

## 2) Product + Provider Ops (3 min)

- Go to `/admin/products`
  - Create one real product (`is_demo=false` implicit)
  - Edit price and save
- Go to `/admin/providers`
  - Create one provider
  - Link product with SKU, stock, and cost
  - Verify row appears in "روابط المنتجات مع المزوّدين"

Pass criteria:
- Product creation/edit succeeds.
- Provider link is saved and visible with SKU/stock/cost.

## 3) Bulk Import Path (2 min)

- In `/admin/providers`, open CSV bulk import section
- Paste 2 valid rows using the documented header
- Run import
- Confirm summary shows successful rows > 0

Pass criteria:
- Import completes and link rows are inserted/updated.

## 4) Shipping Ops (3 min)

- Go to `/admin/shipping`
- Create shipping partner (if none exists)
- Select an order, set tracking number, set status `ready` then `in_transit`
- Confirm tracking URL works (if provided)
- Confirm status transition guard behavior:
  - Allowed transitions succeed
  - Invalid transitions are blocked

Pass criteria:
- Shipment can be created/updated for an order.
- Transition guard prevents invalid jumps.

## 5) Customer Tracking Experience (2 min)

- Sign in as customer
- Open `/orders`
- Confirm order shows:
  - shipment status
  - tracking number
  - tracking link (when present)
  - timeline events

Pass criteria:
- Customer can see shipment and timeline clearly for their own orders only.

## 6) Trust & Ops Monitoring (2 min)

- Open `/admin/trust-ops`
- Add one event (`ops_note`) for an order
- Set risk score + risk flags for same order
- Confirm event appears in feed
- Confirm near-breach section updates when data matches conditions

Pass criteria:
- Event and risk updates save successfully and render immediately.

## 7) Security & Policy Spot Check (1 min)

- Customer should not access admin routes
- Non-admin should not mutate provider/shipment ops
- Admin can access and mutate trust/shipping/provider/product data

Pass criteria:
- RLS/route protection behavior is correct by role.

## 8) Release Gate Commands

Run from project root:

```bash
npm run build
```

Optional DB migration check:

```bash
npx supabase db push
```

Pass criteria:
- Build finishes without errors.
- Migrations apply cleanly (if any pending).

---

## Quick Result Template

Copy and fill for each release:

- Build: PASS / FAIL
- Admin dashboard sanity: PASS / FAIL
- Product + provider ops: PASS / FAIL
- Bulk import: PASS / FAIL
- Shipping ops: PASS / FAIL
- Customer tracking: PASS / FAIL
- Trust & ops: PASS / FAIL
- Security spot check: PASS / FAIL
- Final release decision: GO / NO-GO
