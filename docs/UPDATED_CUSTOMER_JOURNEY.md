# Updated customer journey — implementation and verification

Editable project: C:\Users\sayye\source\repos\rotihai-user.
Replitrotihai and RotiHaiMobileApp are reference-only. No backend or reference-project changes were made in this implementation pass.

## Implemented behavior

- First launch uses the existing splash and PhoneScreen. The first phone entry saves a provisional local contact and opens Home without sending OTP. Returning sessions or saved provisional contact skip this entry. A phone number alone never grants account access.
- Existing OTP send/verify and protected navigation remain. Address entry and checkout review open directly from the basket. Only order submission and private account operations require an authenticated backend session.
- Home has no search field. Explore retains search. Delivery area is resolved from Home; catalog discovery uses the existing radius service.
- Web palette and bundled Inter fonts connect the Home, category, kitchen, product, cart, checkout, orders, subscription, address and account screens.
- Menus use the backend section, sectionOrder and sortOrder values. Food types and combo sections appear in chips and a menu picker. Inactive kitchens remain visible in their categories, with ordering disabled.
- Missing or failed dish images use a clean text layout. No replacement food photos were generated. Public images cache by exact URL; URL changes cannot briefly display a different product's cached photo.
- Menu Add now uses the already loaded product and local basket. Its earlier dependency on both a fresh product fetch and an optional offer fetch could reject a local Add action. Fresh product, offer, stock, schedule and financial checks remain at checkout.
- Local basket persistence is retained. Checkout fields persist per authenticated owner and basket. Order creation keeps the basket, saves the returned order reference and opens the existing Payment screen.
- Saved order/payment references survive restart and appear on Home, Saved checkout and checkout. A pending or ambiguous attempt is reconciled before another order/payment attempt. Cancelled/expired/rejected orders release this local block without clearing the basket.
- Payment handoff persists before launching. GPay availability is checked; unavailable devices can use a compatible UPI app or QR. App return triggers a fresh backend status read. No launcher response, app return or typed transaction reference marks payment paid.
- Only a backend-recorded payment clears the original, unchanged basket. A basket changed after submission is preserved.
- Public catalog snapshots and exact-source images support offline browsing. Private profile/order/subscription snapshots use chunked SecureStore and the exact authenticated token binding. Offline reads cannot cross accounts; HTTP 401 never falls back to a cached profile. Order/payment mutations and fresh financial reads reject offline operation.

## Existing web behavior used as reference

Read-only source tracing:

- client/src/components/CheckoutDialog.tsx: creates a pending order before opening payment.
- client/src/components/PaymentQRDialog.tsx and client/src/lib/upi-payment.ts: use configured merchant UPI details, QR, GPay links and manual amount entry. The configured personal-account URI deliberately contains payee and currency only. The mobile app preserves that protocol and prominently displays the backend amount.
- client/src/utils/productGrouping.ts: real menu section names and ordering.
- Existing category, chef-radius, product, delivery-slot and cart-setting contracts are reused.

Android GPay uses the web dialog's tez://pay path. iOS uses gpay://upi/pay. Native URL-query declarations are included in plugins/withPaymentQueries.cjs and app.json. Installed-app behavior requires a native rebuild and physical device verification; Expo Go cannot certify these declarations.

## Backend dependencies and deliberate limits

The reference backend is not edited.

- Guest order placement without OTP needs a secure backend identity/order contract. The mobile app reuses the number captured at startup and asks for the preserved OTP flow only when the user chooses Verify & place order. The guest address, basket and checkout draft transfer to the verified owner.
- A complete server quote and durable idempotency key for order creation are still missing. The app prevents repeat taps, retains ambiguous attempts, and requires reconciliation. These client safeguards cannot provide server-wide exactly-once creation across devices.
- The legacy payment-confirmed endpoint can mark paid from a user declaration. The mobile app does not call it as evidence of payment. Manual reports remain locally saved and awaiting confirmation, with an explicit support handoff.
- Bank/provider verification and reliable reconciliation require a trusted backend confirmation source. A backend “paid” label is shown as “Payment recorded by RotiHai”; it is not independently certified bank settlement.
- There is no verified customer refresh-token contract in the reference implementation.
- Physical Android/iOS GPay success, cancellation, debit-with-no-return and restart acceptance remain device checks. No production OTP, order, subscription, wallet debit or payment was created for validation.

## Review evidence

See ../review/index.html for the Android screenshot gallery and deployed-web comparisons. Screens run real React Native components with read-only public catalog snapshots and local sample accounts/orders; the review transport rejects all account/order/payment mutations. Deployed web comparison captures use intercepted sample API responses. This is visual/interaction evidence, not a live financial end-to-end certification.

See UI_VISUAL_REVIEW.md for screenshot scope and current validation results.
