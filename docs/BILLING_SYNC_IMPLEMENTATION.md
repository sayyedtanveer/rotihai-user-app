# Billing synchronization implementation proposal

Status: prepared for authorization; not implemented. Replitrotihai remains read-only. Existing modified files in both repositories must be preserved, including mobile-push work in server/routes.ts and shared/schema.ts.

## Confirmed current gaps
See DISTANCE_BILLING_AUDIT.md for source locations and examples: wrong web >=200 fee tier when waiver threshold >200; local web payment amount; zero-fee fallback; incomplete admin breakdown; raw quote distance versus adjusted saved distance. Existing /api/calculate-delivery is delivery-only. No complete checkout quote/idempotent order-creation contract was found in the inspected routes. Both admin tabs use the same orders endpoint but separate caches.

## Contract to implement
Add a single POST /api/checkout/quote because neither existing delivery endpoint can quote products, coupons and wallet together. Existing delivery endpoints remain compatible and reuse the same delivery utility. A shared backend pricing module will be used by quote and existing POST /api/orders, not a mobile-only pricing fork.

Input: chefId, item product IDs/variant IDs/quantities, delivery address and coordinates, couponCode, requested wallet use, and existing scheduling inputs where relevant. Derive customer identity from the session. Never accept client prices or totals as authoritative. Preserve existing promotional quantities, variants and eligibility. Quote must work with the existing guest/auth checkout contracts without disclosing private account data.

Output: quoteId, expiresAt, pricingVersion, input fingerprint, method=haversine_multiplier, rawDistanceKm, billingDistanceKm, delivery slab identifier/name, freeDeliveryEligible, amountForFreeDeliveryPaise, and bill containing subtotalPaise, deliveryFeePaise, platformFeePaise, discountPaise, walletCreditPaise, applicable existing bonus credit, payablePaise. Calculate integer paise internally. Existing database rupee fields must retain their unit; add a versioned JSON billing snapshot instead of silently reinterpreting historical columns. Final response validation/expiry duration must be explicit in the implementation.

Order creation: extend existing POST /api/orders with quoteId and Idempotency-Key. Bind persisted quotes to customer/session and canonical inputs. Revalidate expiry, products, availability, eligibility and settings before effects. Return a structured 409 QUOTE_EXPIRED or PRICE_CHANGED and replacement quote for explicit customer review. Same key + same request returns existing order; same key + different inputs rejects. Use database-backed uniqueness and transactions, not memory-only locks. Persist reviewed pricing snapshot atomically with order. Integrate with current wallet lifecycle/reservations; do not introduce an additional deduction at creation if existing flow deducts at payment confirmation. Prevent concurrent overspending and release any reservation on expiry/cancellation.

## Files and areas requiring authorization in Replitrotihai
- shared/deliveryUtils.ts: reuse delivery rules and return explicit raw/adjusted distance metadata; no policy changes.
- Existing shared/server pricing helpers or one new shared backend pricing module: authoritative products, coupons, fees, credits, paise arithmetic.
- server/routes.ts: quote handler, existing order validation, saved-total payment handoff contracts; preserve mobile-push modifications.
- server/storage.ts and shared/schema.ts plus a new additive migration: durable quote metadata, versioned immutable order billing snapshot, idempotency uniqueness, transactional integration. No historical order rewrite or automatic migration execution.
- client/src/components/CheckoutDialog.tsx and OrderSummaryCard.tsx: consume quote, remove fallback/duplicate arithmetic, review revised prices, saved-order total to payment.
- client/src/components/PaymentQRDialog.tsx: saved amount validation and repeated-initiation guards; preserve UPI/manual confirmation semantics.
- client/src/pages/admin/AdminOrders.tsx and AdminPayments.tsx: one saved bill breakdown, complete fees/deductions, legacy fallback clearly based on stored fields, consistent cache invalidation.
- Existing subscription creation/renewal handlers and views: inspect separately; regular-order slabs must not be imposed on subscription policies. Reuse money/snapshot primitives only where semantics match. Eliminate client price fallbacks where backend supplies an authoritative amount.
- Backend/web tests: isolated fixtures and mocked database/services; no live database access.

## Mobile integration after backend contract exists
Modify existing CheckoutScreen.tsx to request and render quotes; replace independent fee/distance reconstruction. Submit quote ID and a durable per-attempt idempotency key. On 409 show replacement bill for review without creating a second order. Preserve address, schedule, cart and recovery state. PaymentScreen.tsx continues using fresh saved order total and status. Existing OrderScreens.tsx renders the saved breakdown; preserve order tracking/reorder behavior. Extend models/review transport and integration tests; no parallel screens.

## Acceptance tests
Shared fixture scenarios: below100,199,200,201; configurable waiver above200; free zero delivery; distance slabs/boundaries; chef threshold; coupons/promotional quantity limits; wallet eligibility and concurrency; expired/repriced quotes; changed inputs; same-key retry and conflicting retry; order snapshot/receipt/admin reconciliation; payment amount and pending/failed UPI; subscription creation/renewal regression. No actual order/payment submissions. Web and mobile should render identical integer-paise fixture bills. Example subtotal250, waiver500, feeBelow200=7, feeAbove200=4 must consistently use4. A backend zero delivery fee remains zero.

## Rollout limitations
Existing deployed backend does not yet provide this contract. Mobile cannot complete authoritative integration until backend changes are approved and later deployed through a separately authorized release. Preserve legacy compatibility during transition; a legacy request must not silently change a reviewed total. No paid routing, price-policy changes, deployments or live data mutations are included in this authorization scope.
