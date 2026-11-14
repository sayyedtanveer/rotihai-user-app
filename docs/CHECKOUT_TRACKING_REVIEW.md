# Customer checkout and tracking review — 15 November 2026

Scope: rotihai-user only. Replitrotihai and RotiHaiMobileApp were read-only references.

## Corrected checkbox requirement
The user's latest correction supersedes the pasted Terms requirement: no Terms checkbox on checkout. The existing payment declaration checkbox is unchecked on every payment-screen mount/route restoration, never restored from a saved payment. Complete payment is disabled until the customer checks it. Normal order payment has no repeated bill or transaction-reference field. Subscription reference reporting retains its separate existing backend contract.

## Customer recognition
Existing POST /api/user/check-phone returns only exists. Entry captures optional name plus mobile, looks up existence, and asks new customers without a name for their name. Returning customers can proceed using mobile alone. Contact data is local and explicitly unverified; no lookup tokens, private profile data, addresses or order history are consumed. A returning customer whose name is not locally known enters it at checkout. Existing OTP/session code remains for private account access.

No new backend endpoint or rate-limit implementation was added. The existing check-phone route itself has no dedicated limiter in its inspected definition; this change does not claim new server-side rate limiting.

## Payment and tracking
Normal orders use the existing web POST /api/orders/:id/payment-confirmed customer-declaration contract. The app ignores credentials in the response, reads the same order again, and moves to existing OrderDetails only after backend-recorded status. Launching/returning from UPI never sets paid. A busy lock suppresses simultaneous taps; a fresh paid order suppresses another confirmation submission. Backend idempotency under distributed concurrent requests is not newly guaranteed.

The existing tracking screen now uses a warm status card, kitchen card, gold progress timeline, product quantity rows, delivery information, itemized bill, payment state and Home action. No estimated delivery time is fabricated.

The existing SavedPaymentCard now displays the active-order banner at the top of Home. Authenticated customers use GET /api/orders/active. Guests use only the exact receipt-bound order from their saved checkout. Refresh on Home focus/app resume plus polling. Completed, cancelled, rejected, expired, future and unknown orders are hidden; preorder day and unpaid expiry follow web rules where supplied. Subscription checkout recovery remains available.

## Modified implementation files
- src/application/user/auth/entryRules.ts
- src/core/storage/provisionalContact.ts
- src/core/providers/CustomerProvider.tsx
- src/presentation/user/navigation/UserAppNavigator.tsx
- src/presentation/user/screens/OnboardingScreens.tsx
- src/presentation/user/screens/CheckoutScreen.tsx
- src/presentation/user/screens/PaymentScreen.tsx
- src/presentation/user/components/CompactOrderPayment.tsx
- src/application/user/payments/paymentRules.ts
- src/application/user/orders/orderRules.ts
- src/presentation/user/screens/OrderScreens.tsx
- src/presentation/user/components/OrderProgress.tsx
- src/presentation/user/components/SavedPaymentCard.tsx
- src/presentation/user/screens/DiscoveryScreen.tsx
- src/review/transport.ts
- tests/journey-payment.test.cjs
- review/interact-native.cjs

## Validation
TypeScript passed. 68 regression tests passed, including minimal recognition, contact persistence, guest receipt scoping, active-order eligibility, checkbox gating, failed confirmation, fresh status validation and suppression of a repeat confirmation after paid.
Android native read-only review captures are in review/screenshots/native. These use a sample account and reject payment/order mutations. No live payment, order, SMS or account creation was executed. Full live end-to-end payment verification is therefore not claimed.

Native interaction check: payment initially unchecked/disabled; selecting checkbox enables Complete payment; read-only confirmation rejection retains payment screen; reopening resets checkbox. Fresh tracking screenshot inspected after fixing native JSX whitespace warning.

## Follow-up: fixed-bottom banner and startup
The active-order banner now sits outside Home scrolling content, immediately above bottom tabs (below the cart strip when present), matching the web status colours/messages and Pay Now/Track actions. Account displays locally entered name and masked saved mobile without claiming verified login. Valid session restoration remains unchanged. Screenshot-review mode bypassed startup in the test app; the owned Metro server was restarted without that mode. TypeScript and 69 tests passed.

## Explicit MVP change — phone-only server login
User explicitly changed the previous contact-only requirement on 15 November. Mobile now uses existing POST /api/user/login-or-create and freshly reads GET /api/user/profile with the issued token before persisting the session in SecureStore. Matching ID/phone responses are checked; the server profile replaces locally entered data. Saved contact without a token is exchanged with the backend during startup; valid saved sessions use the existing profile restoration. OTP code remains available. Backend files are unchanged.
This is intentionally phone-only authentication: database existence and response matching do not verify number ownership. Anyone who knows a customer phone number could obtain their account under the existing backend contract. This change is not represented as secure identity verification. No real customer login was performed by the test suite.
The banner now includes the web-style expanding/fading green activity dot, with reduced-motion and foreground/focus handling.

## Logout and pulse follow-up
Explicit logout now removes the access token, saved contact, guest receipt, guest delivery address and customer query cache. Navigation returns to mobile entry. The active indicator is shown for every eligible active-order status; its ring expands/fades on a native-driver loop, and pauses while backgrounded, unfocused or reduced motion is enabled. Regression coverage verifies persistent logout cleanup.

Final logout verification: TypeScript passed; all 72 tests passed, including persistent token/contact/guest receipt/address/cache removal. Local logout no longer waits for push deregistration. Pulse implementation is present for every eligible active-order state; final device motion capture remains unverified.
