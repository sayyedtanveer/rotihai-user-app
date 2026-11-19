# RotiHai billing synchronization — local implementation

## Scope and status
Implemented locally in Replitrotihai (web/backend) and rotihai-user (mobile). Migration is an SQL script for the user to run manually; it must not be auto-executed. No migrations applied, no deployment, no live customer records accessed, and no real payment initiated. Existing push modifications in routes/schema/websocket/dist-server were preserved; generated dist-server/index.js was not rebuilt or overwritten by this work. No paid routing introduced. Integration requires migration + backend release before updated checkout clients are released.

## Confirmed root causes and corrections
- Web >=200 fee tier and zero-delivery fallback: removed the local checkout bill calculation effect; quote uses current admin tiers and preserves zero.
- Web payment handoff used local total: uses orderResponse.data.total; PaymentQRDialog uses saved orderData.total.
- Quote endpoint previously absent: one shared backend service now calculates products/variants, percentage promotions, distance, slab, chef threshold, convenience fee, coupon, wallet, bonus and payable.
- Order storage.createOrder omitted platformFee: corrected. Main order creation now uses the reviewed snapshot, including selling prices after legacy variant/cost enrichment.
- Missing waiver-threshold schema field: restored with existing default200 and IF NOT EXISTS migration.
- Admin payment breakdown omitted fees/credits: one SavedOrderBill renderer is used in admin orders/payments and customer receipt pages.
- Wallet confirmation had hardcoded50 and a cap based on net payable, and raw SQL rows were treated as camelCase: corrected; reviewed deduction is preserved and user row locked. Paid/confirmed retries do not deduct twice.
- Referral claim previously happened before order creation and its transaction called wallet helpers outside that transaction: quoted/reserved bonus now consumed at payment with existing eligibility and ledger helper using the same transaction. Direct legacy claim helper is also transactional.
- Whole-rupee storage could lose paise: calculations use integer paise; existing rupee columns use decimal storage through the prepared migration, preserving historical values.

## API contract
POST /api/checkout/quote accepts chefId, items [{id,variantId?,quantity,specialInstructions?}], customerLatitude/customerLongitude, address, addressPincode, couponCode?, useWallet?, useBonus?. Identity comes from Bearer token; unverified guest lookup never grants wallet/bonus eligibility. Client prices/totals are ignored. Response: quoteId, expiresAt (5 minutes), pricingVersion, inputHash, version1, bill (all fields integer paise), distance {method:haversine_multiplier,rawDistanceKm,billingDistanceKm,multiplier,estimated:true}, delivery {slab,freeDeliveryEligible,amountForFreeDeliveryPaise}, item snapshots and fee explanation. Response is no-store. Haversine, multiplier, active slab matching and free-delivery MAX(slab minimum, chef threshold) reuse existing delivery utility.

POST /api/orders accepts existing payload plus quoteId and Idempotency-Key (or idempotencyKey body). Reviewed input/expiry/current bill are validated. PRICE_CHANGED / QUOTE_INPUT_CHANGED / QUOTE_EXPIRED / WALLET_CHANGED / BONUS_CHANGED / COUPON_CHANGED use409; replacement quotes are returned where calculated at request validation. Clients require review/retry, never silently submit a larger price. Durable quote rows, order unique keys, transaction advisory lock and unique quote consumption prevent duplicate creation for upgraded clients. Replays return saved order without repeating order-created background effects. Conflicting reuse rejects.

Legacy no-quote requests remain accepted only when their submitted payable matches a new authoritative quote. A mismatch returns409 rather than silently changing the price. Existing checkoutId is reused as a legacy request key when available. Clients without any stable key cannot have full retry guarantees without upgrading. Legacy pending-checkout conversion also uses shared quote validation and a durable checkout-derived key; it remains pending for manual confirmation rather than treating a click as proof of settlement.

Quote/order persistence and wallet lifecycle: a quoted order reserves eligible wallet/bonus through its unexpired pending snapshot. Competing submissions serialize the user balance check; confirmation deducts in the existing payment transaction. Cancellation/expiry excludes a pending reservation without double-refunding because no credit was deducted yet. Database trigger protects reviewed monetary fields/snapshot and prevents resetting recorded quoted payments to pending. Quote totals do not include driver payout; payout remains separate.

Alternate existing GPay verification paths use the persisted total for quoted orders, require exact paise and run wallet confirmation before confirmed status. Legacy tolerance remains for historical orders. No new gateway or bank verification capability was added; existing manual-confirmation semantics remain.

## Subscription scope
Regular-order delivery slabs were not applied to subscriptions. Existing creation/renewal backend stores finalAmount from the plan policy. Web payment handoffs now use saved finalAmount instead of advertised plan.price, preserving0. Existing mobile subscription create/renewal and uncertain-request recovery tests remain in the regression suite. Legacy subscriptions missing a saved payable amount fail closed on the updated web handoff; they are not repriced from current catalog prices.

## Modified/new files — web/backend
- server/billing.ts (new): quote service, HTTP handler, durable validation/insert.
- shared/billing.ts (new): paise primitives, bill rows, saved subscription amount.
- shared/schema.ts: quote table, order snapshot/idempotency fields, waiver field, decimal monetary storage; prior push fields retained.
- migrations/20261115_billing_quotes.sql (new): schema and immutable-bill trigger, not executed.
- server/routes.ts: register quote handler, existing order validation/insert, pending-checkout compatibility, coupon background bypass for snapshotted orders; push route registration retained.
- server/storage.ts: platform fee persistence, transaction/row locks, wallet/bonus ledger fixes.
- server/adminRoutes.ts: atomic paid/confirmed handling and recorded-payment reset guard.
- server/routes/gpay-verification.ts and server/services/gpayVerificationService.ts: saved amount and wallet consistency.
- client/src/components/CheckoutDialog.tsx, OrderSummaryCard.tsx, PaymentQRDialog.tsx: quote rendering/review, zero fees, quoted items/distance, saved payment amount, session-persistent retry key.
- client/src/components/SavedOrderBill.tsx (new), client/src/pages/admin/AdminOrders.tsx, AdminPayments.tsx, MyOrders.tsx, OrderTracking.tsx: common saved breakdown/historical fallback.
- client/src/components/SubscriptionDrawer.tsx: saved subscription payment amount.
- tests/billing-sync.test.cjs, billing-wallet.test.cjs, billing-web.test.cjs, billing-payment.test.cjs (new): isolated fixtures and real HTTP/renderer/storage-method tests.

## Modified/new files — mobile
- src/presentation/user/screens/CheckoutScreen.tsx: shared quote response, quoted item prices, review changed bill, idempotency key, existing recovery preserved.
- src/application/user/cart/billingQuote.ts (new): response integrity and review checks, not a pricing engine.
- src/core/api/customerApi.ts: structured price-change error metadata.
- src/core/api/models.ts: saved billing snapshot type.
- src/presentation/user/screens/OrderScreens.tsx: saved bill and estimated distance, historical fallback.
- src/review/transport.ts: read-only quote fixture; order/payment mutations remain blocked.
- tests/customer-flows.test.cjs: quote integrity and price/distance-change review tests.
- docs/BILLING_SYNC_IMPLEMENTATION_REPORT.md (this file).
PaymentScreen.tsx required no regular-order pricing rewrite: it already reads/rechecks saved order.total. Existing navigation, UPI return/retry guards and manual confirmation remain.

## Before/after examples (fixtures, not live settings)
- Subtotal250, waiver500, below200 fee7, above200 fee4, delivery20: old web could show277 and saved backend274; now quote/snapshot/payable274.
- Free-delivery backend0 stays0, never a fallback20.
- Subtotal200 + delivery20 + convenience4 - coupon10 - wallet50 =164. Quote fields use20000+2000+400-1000-5000=16400paise.
- Product99 at10percent off, quantity3: rounded selling price89rupees per unit, quote26700paise and stored subtotal267rupees. Percentage-off products follow the existing web catalog whole-rupee unit rounding.
- Raw distance2km with multiplier1.5 uses estimated billing distance3km everywhere in the quoted bill, not claimed actual routing distance.

## Validation and practical limits
Backend/web isolated suite: 29 passed. Evidence: Replitrotihai/docs/billing-validation/backend-tests.txt. Covers boundary tiers, zero/free delivery, distance slabs/multiplier, percentage discounts/unit rounding and paise storage, coupons, wallet/bonus reservation, real wallet/bonus methods and rollback, expiry/repricing, input changes, idempotent/concurrent submission, real HTTP quote parity, saved receipt rendering, historical fallback, subscription saved amount, underpayment and pending/failed UPI fixtures.
Mobile: TypeScript and86 tests pass; includes existing payment/UPI recovery and subscription creation/renewal checks plus quote integrity/review tests. Actual SQL locking and migration execution are not proven by mock transaction fixtures. No psql/postgres/initdb executable was available on PATH. Per the user’s explicit instruction, all database migration execution is manual and no SQL script was executed. Full browser/device end-to-end against the migrated backend remains a staging acceptance check; no live order was used.
Repository web/backend tsc has pre-existing AdminProducts errors (non-exported Radio and missing variants type). Standard default target also reports existing Map iteration errors; ES2022 check isolates the AdminProducts issues. Backend bundles successfully to a temporary verification artifact; production dist-server was not changed. Modified web screens parse successfully.

## Migration/release instructions — not executed
1. Review migration and existing uncommitted work; back up the database through normal operations.
2. Rehearse on disposable/staging PostgreSQL with synthetic data. Verify decimal conversions retain stored values, immutable trigger, unique keys, concurrent SQL row/advisory locks, coupon limits and wallet ledger balances. Test all listed journeys in actual web/mobile builds.
3. Migration alters types on orders, users, wallet_transactions and payment_verification_log as well as adding tables/columns. Type conversion can lock/rewrite storage; estimate duration in staging. Existing numeric amounts are unchanged. Do not blindly cast back to integer after fractional orders exist.
4. After separate production approval, apply migrations/20261115_billing_quotes.sql using the normal migration runner (psql with ON_ERROR_STOP or equivalent), then deploy backend before quote-consuming clients. No migration runner was executed here.
5. Deploy web/mobile only after endpoint readiness and staging acceptance. Keep legacy payload compatibility during the transition. Fix unrelated AdminProducts build/type blockers before release as needed.
6. Plan normal retention cleanup of expired, unused quote rows; snapshots live on orders. The quote ID is a capability for guest checkout and must not be logged/shared publicly. Existing edge/API throttling should cover the new quote path before public launch.

No production approval is requested by this local implementation. No claim is made that live historical discrepancies are reconciled: historical amounts were never inspected or changed.
