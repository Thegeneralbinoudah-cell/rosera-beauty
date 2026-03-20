# ROSERA Team QA Checklist (Non-Technical)

Use this checklist before release.  
Mark each item as done.

## Test Info

- [ ] Date:
- [ ] Tester name:
- [ ] Environment (staging/production):
- [ ] App version / commit:

## A) Login and Basic Navigation

- [ ] Customer can log in
- [ ] Admin can log in
- [ ] Owner/supervisor can log in
- [ ] Main pages open without white screen
- [ ] No obvious UI breakage

## B) Store and Products

- [ ] Store page loads products
- [ ] Product details page opens
- [ ] Add to cart works
- [ ] Checkout page opens normally

## C) Admin Product + Provider

- [ ] Admin can create a product in `/admin/products`
- [ ] Admin can edit product price/details
- [ ] Admin can add provider in `/admin/providers`
- [ ] Admin can link product to provider (SKU/stock/cost)

## D) Shipping Operations

- [ ] Admin shipping page `/admin/shipping` opens
- [ ] Shipping partner can be created
- [ ] Shipment can be created for an order
- [ ] Tracking number is saved
- [ ] Shipment status can be updated step-by-step

## E) Customer Order Tracking

- [ ] Customer can open `/orders`
- [ ] Tracking number is visible for shipped order
- [ ] Tracking link opens
- [ ] Timeline updates are visible

## F) Trust and Operations

- [ ] `/admin/trust-ops` opens
- [ ] Admin can add event note to an order
- [ ] Admin can update risk score and risk flags
- [ ] Near-SLA and SLA cards show values

## G) Security (Role Checks)

- [ ] Customer cannot access admin pages
- [ ] Non-admin cannot edit shipping/provider operations
- [ ] Admin can access all admin operation pages

## H) Final Gate

- [ ] Build passed (`npm run build`)
- [ ] No blocking issue found
- [ ] Release decision: GO / NO-GO

## Issues Found

- [ ] No issues found
- [ ] Issues found (write below)

Issue log:

1. 
2. 
3. 
