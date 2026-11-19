# Distance and billing audit

Source review; no live customer records, orders or payments were inspected or changed. Web project remains read-only.

## Distance
server/routes.ts:4732 calculate-delivery uses chef database coordinates and delivery-address coordinates. shared/deliveryUtils.ts calculates rounded Haversine distance, multiplies by the admin road multiplier (default 1.5; disabled = 1), rounds to two decimals, and matches active delivery slabs. Free delivery threshold is the maximum of the slab minimum and chef threshold. Order creation recomputes charges and stores adjusted distance (routes.ts:2351-2395). The quote response returns raw distance; mobile reconstructs the estimate from separately fetched payment settings. This can drift if settings change between requests. It is not a measured road route. Geocoding accuracy also limits distance accuracy; mobile rejects pincode-only geocodes, but this does not guarantee rooftop accuracy.

## Confirmed code discrepancies
1. Web CheckoutDialog.tsx:1284-1285 uses platformFeeBelow200 for every subtotal >=100 below the waiver threshold. Server routes.ts:2432-2433 uses platformFeeAbove200 for >=200. Example: subtotal 250, waiver 500, below200 fee 7, above200 fee 4 => web preview 3 higher before other charges.
2. Web CheckoutDialog.tsx:3273 passes amount: total (local preview) to payment after order creation, rather than orderResponse.data.total. PaymentQRDialog.tsx:69 uses paymentData.amount. Thus a preview/server mismatch can reach the payment amount.
3. Web CheckoutDialog.tsx:1213 treats a valid zero delivery fee as absent, falling back to cart.deliveryFee or 20. Its actual fee additionally depends on cart.minOrderAmount (1147-1157), rather than exclusively on the fresh quote. This is another conditional discrepancy path.
4. AdminOrders and AdminPayments both fetch /api/admin/orders and display order.total. Payment tab secondary breakdown only lists subtotal plus delivery (AdminPayments.tsx:555-557); it omits platform fees and deductions, so the displayed arithmetic can appear incorrect even when the headline totals agree. Separate query keys can temporarily show different snapshots.

## Mobile
Checkout calculates a preview and refreshes delivery, fees and wallet before submission. Backend recomputes the saved total. CheckoutScreen.tsx:161-165 uses created order.total for payment; PaymentScreen.tsx:27,64-67 reads and validates the fresh backend total. No guarantee of exact preview/saved parity exists because quote and creation are separate operations without a complete immutable quote contract.

## Recommended sequence
Use one server quote covering distance, fee slab, convenience fee, discounts, credits and final payable amount; return raw and pricing distance, method, settings version and expiry. Creation should validate that quote and ask for review if it changes. Payment, receipt and both admin views should use the same saved bill snapshot. Use integer paise consistently. Never silently charge more than the reviewed quote. Route-distance pricing requires an actual road-routing service and verified kitchen/address coordinates; avoid applying the heuristic multiplier again to a road-route distance. Keep payout distinct from customer delivery charges. Calibrate current estimate against representative local routes and slab boundaries before calling it fair or accurate.

No code changes were made by this audit. Existing automated tests do not prove historical live database totals match; reconciliation needs authorized read-only data for the same order IDs.
