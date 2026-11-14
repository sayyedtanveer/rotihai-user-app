# Customer app implementation and verification

Updated 14 November 2026. Only C:\Users\sayye\source\repos\rotihai-user is edited. The web/admin and partner projects remain read-only references.

## Current result

The existing customer app now carries the startup number through basket, address and checkout. Protected submission resolves the number from customer context, navigation state, or saved contact, in that order. It opens the existing OTP screen directly. A valid session skips this verification. Saving an address does not request login. OTP completion migrates the guest basket, address, checkout fields and subscription slot to the verified owner and returns to the original destination. The review build now also routes verification to OTP rather than the number-entry screen.

The web CheckoutDialog reuses its phone through a phone-only login-or-create endpoint. That endpoint also issues existing-account tokens without ownership verification. Mobile preserves the master prompt's OTP requirement for protected operations; it does not use a saved phone number as proof of identity.

## Web and admin audit

The [parity matrix](WEB_MOBILE_PARITY.md) records the customer features, source files, implementation and remaining acceptance requirements. The source inventory covers 35 admin pages and 11 customer pages in review/source-audit. Admin screens remain outside the customer app.

Actual admin-controlled banner title, subtitle, button text, gradient, action, activation and display order now drive Home. Plan promotion and the grouped plan catalogue use actual plan names, prices, frequency, category and section ordering. The web's static subscription advertising copy is distinguished from CMS data; no fabricated savings or ratings are shown.

Categories, chef availability, menu sections, inventory, variants, offers, slots, roti windows, delivery calculation, cart thresholds, coupon verification, referral rules, wallet limits, merchant details and custom-roti pricing use their existing endpoints. Fresh data is required at financial submission. Public queries refresh on reconnect, focus and their configured intervals; a cached fallback is visibly labelled.

## Screens and UX

- Existing compact Home hero, real admin promotion carousel, plan promotion, category browsing and product discovery.
- All matching inactive kitchens remain visible when a category is selected. Ordering actions reflect availability.
- Existing menu groups use actual section names and ordering, with food-type chips and a Browse menu sheet.
- One product-to-cart conversion is shared by Home, menu, product and saved-basket restoration.
- Basket keeps separate kitchen/category groups, editable quantities and notes. Refresh prices & availability revalidates the current menu and serviceability without silently replacing concurrent basket edits.
- Checkout displays the saved delivery contact and address. Optional delivery instructions/email and coupon entry are grouped; applied coupons can be removed. Zero-value credit lines do not clutter the bill.
- Account/profile groups link existing screens. Referrals support real earnings, reward rules, code copy/share and history. Unknown wallet balances are not displayed as zero.
- Plans show their real contents, sections, price, frequency and delivery days. Existing subscription screens support actual schedules/history, pause/resume, skip, time changes and applicable renewal. Custom plan requests show backend prices and approval states.
- Order progress includes the backend's accepted-by-chef and accepted-by-delivery states and treats completed as delivered.
- Bundled Inter typography, central color roles, improved contrast, consistent 48dp controls, responsive headers and reduced-motion handling connect the screens.
- Missing or failed product photos collapse to text. No product images were invented.

## Reuse and new-file justification

No second Home, Cart, Checkout, Login, OTP, API service or authentication provider was created. Changes extend existing navigation, providers, screens, persistence and payment handoff.

New pure rule files isolate contracts that need independent tests: catalog/contentRules, cart/couponRules, subscriptions/subscriptionRules and orders/orderRules. The new useReducedMotion hook reads the native accessibility setting. These contain no competing state stores or API clients.

A recoverable source ZIP, SHA-256, parent Git status and 57 original Android source/configuration files are in review/baselines/20261114-184653. The customer folder is untracked inside the shared parent repository; no unrelated files were staged or committed.

## Cart failure and recovery

The original Add action waited for product and optional offer fetches before a local basket update. Optional network failure could therefore prevent adding a known available product. Add now uses the loaded product and the existing CartProvider. Checkout still revalidates fresh price, stock, variant, promotion, availability, delivery and scheduling. Explicit basket refresh lets a customer recover from admin changes without removing and re-adding everything.

## Coupons, referrals and profile

Coupon verification uses one helper and the authenticated server eligibility result. It preserves expiry, minimum-order and usage-limit errors and the exact returned discount; it does not expose the privileged admin coupon catalogue.

Referral earnings read the actual totalEarnings field, preserving zero values and showing only reward limits returned by the server. Share text never invents a reward. Profile/address remain in the existing owner model. The optional newsletter action uses the real subscribe endpoint and is never auto-submitted during review.

## Payment and duplicate protection

The configured web UPI protocol is preserved: payee and currency only, with the amount shown separately. Pending references are persisted before external-app handoff. App return/reconnect checks the backend; return values and typed references never mark payment paid. Only backend-recorded payment clears the original unchanged basket.

Order payment reports remain local with an explicit support action because the legacy order payment-confirmed endpoint can directly mark an order paid. Subscription reference reporting uses its distinct backend endpoint, which stores the reference for admin review without setting isPaid. A fresh existing-reference check prevents overwrite from a stale screen.

Ambiguous order, subscription, custom request and renewal attempts are persisted and reconciled before allowing another attempt. This is client protection; it cannot substitute for server-wide idempotency.

## Offline behavior

Public menu/plan/banner snapshots last at most seven days and exact-source image caching never substitutes unrelated photos. Private profile/order/subscription snapshots are stored in chunked SecureStore and bound to the authenticated token. A provisional number cannot read private history. HTTP 401 never falls back to cached identity.

Cached responses are labelled, reconnect refreshes reads, and financial/mutation requests require connectivity and fresh data. There is no automatic queue that submits orders or payment reports on reconnect.

## Verification and acceptance

TypeScript and 58 automated tests pass after the saved-number fix and checkout polish. Tests cover guest address/checkout routing, contact recovery after navigation-state loss, OTP return destinations, owner-isolated migration/cache, actual admin banner and plan rules, coupon replies/errors, stock/variants/promotions, serviceability, custom pricing, ambiguous creation and payment persistence.

Current Android and iOS Hermes production exports passed (dist-admin-parity); review-account fixture markers are absent. The first native debug build reached generated C++ compilation and hit the Windows 260-character path limit. The corrected persisted CMake threshold (240) resolved it. Android x86_64 debug APK build passed: android/app/build/outputs/apk/debug/app-debug.apk (68,018,522 bytes). This is a Metro-dependent debug APK, not a signed production release. Refreshed screenshot review is in progress. Existing review/index.html contains earlier running-app captures and web comparisons; capture timestamps are in review/screenshots/manifest.json. Screenshots use actual catalog snapshots and explicitly labelled local customer/order data, with mutation rejection. They do not certify live checkout or bank settlement.

## Remaining backend/device dependencies

1. Signed checkout quotes and durable server idempotency are absent. Existing server order pricing trusts some client values.
2. Immediate referral-bonus deduction is not atomic with order pricing. It stays disabled rather than creating a false discount.
3. Disabling all referral campaigns causes the backend to create a default active campaign. This requires an admin/backend correction.
4. Non-monthly renewal uses a hardcoded 30-day backend calculation. Mobile directs these customers to review a new plan; exact early renewal requires backend repair.
5. Guest creation without OTP requires a backend contract that does not expose an existing customer's account from a phone number alone.
6. There is no refresh-token endpoint consumed by this app, no multiple-address API and no customer subscription-cancel route. Placeholder web footer destinations are not fabricated.
7. Physical GPay/UPI return behavior, real push, GPS permissions and iOS native builds/screenshots require appropriate devices. Windows can export iOS JavaScript but cannot certify an iOS native binary.
8. An isolated staging admin/account environment is needed to exercise real admin edits, coupon use, wallet debits, subscriptions and order/payment acceptance safely. Production data was not changed.

Detailed endpoint contracts: [API_CONTRACT_REVIEW.md](API_CONTRACT_REVIEW.md). Exact changed/new customer source inventory: review/source-audit/mobile-changed-files.json. Native prebuild changes preserve existing Gradle options; expected changes include the approved brand icons/splash/name, payment-app queries, wrapper timeout and Windows CMake path setting.
