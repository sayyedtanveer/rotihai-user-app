# Customer mobile coverage and verification

Date: 2026-11-14

## Implemented native screens

- Launch, phone/OTP sign-in, new-customer name, secure session restore.
- Location permission, GPS capture, manual backend geocoding, draggable map pin, structured address confirmation and profile persistence.
- Home banners, categories, nearby kitchens, kitchen menus, dish search, vegetarian/offer filters, variants and instructions.
- Persistent customer baskets separated by chef/category, quantity changes, stock checks and fulfillment-mode conflict prevention.
- Checkout address, schedule, coupon verification, wallet credit, backend delivery quote, order submission.
- UPI QR and app launch, payment confirmation, pay-later order access and cancellation.
- Order list, active filtering, detail/status polling, delivery contact and map links.
- Subscription browsing, purchase, payment, schedule, pause/resume, skip delivery, renewal and delivery-time change.
- Custom daily roti plan request, request status and approved-plan payment.
- Profile edits, existing web password change, wallet history, referral generation/sharing/application/earnings.
- Foreground customer notifications over WebSocket, notification history, opt-in Expo push registration.
- Existing web privacy text, live policy link, support and sign-out.

## Architecture

React Navigation stack and bottom tabs; TanStack Query for authenticated server data; AsyncStorage for customer-specific carts and notices; SecureStore for the access token. Existing core/application/presentation layers retained. APIs target the existing backend.

The implementation is a first native port. It is not yet verified end-to-end against live services and does not establish complete behavioral or visual parity with every web branch.

## Known parity gaps requiring follow-up

1. Referral bonus use at checkout is deliberately unavailable. The web backend drops bonusUsedAtCheckout during sanitization while later expecting it; its separate bonus claim is not atomic with order creation. Wallet use works separately. Resolve this in the backend before enabling bonus deduction.
2. Saved web checkouts can now restore current products/offers into the mobile basket. Linked orders route to their existing details. Unpaid orders resume across devices. The legacy payment-close/cancel-and-save mutation is still not ported: its backend confirm/cancel routes lack ownership and safe payment-state checks. Native pay-later preserves the existing order.
3. Checkout now refreshes product/variant stock, offers and quantity caps, coupons, wallet limits and platform fees. Slots show passed/cutoff status in Asia/Kolkata; preorder times come from the existing web settings. Category-specific limits and complete visual parity still require a contract/device pass.
4. Native push requires an Expo project ID plus Android/iOS push credentials and a development/native build. The backend adapter submits push tickets and handles immediate invalid-device errors; durable retries and receipt processing remain needed for production reliability.
5. Notification taps now check the authenticated customer order list before opening order details, including cold-start responses. Backend out-for-delivery pushes include orderId/userId. Device delivery/tap testing is still pending.
6. Android store builds need Google Maps configuration. iOS maps, UPI app availability, keyboard/safe-area behavior and accessibility require device QA.
7. Onboarding now includes a draggable map pin and the same structured address fields required by checkout. Its original coordinator remains before entering React Navigation.
8. Production auth expiry/refresh-token rotation and the existing web phone-only auth bypass remain backend concerns.
9. All sensitive customer mutations need live-server authorization/ownership verification before release. Existing public order endpoints were reused without changing their authorization.
10. Complete native visual parity, empty/error states across real API responses, and offline/relaunch recovery require emulator/device E2E tests.

## Validation

- Mobile TypeScript passed after navigation, maps, notification packages and all screens were connected.
- Expo 58 aligned to React Native 0.88.1, React 19.3.0 and supported native packages. Expo compatibility check, TypeScript and all 19 tests pass. Fresh Android Hermes export passes (1178 modules). Android prebuild regenerated the native project for Expo 58; local SDK path restored. No APK/device run is verified; Gradle dependencies and Android SDK 37/build-tools 37.0.0/NDK 27.1.12297006 are required.
- npm test: 19 persisted regression tests passed for baskets, restoration with mocked API contracts, fresh offers, stock, quantities, fees, IST cutoffs, pause dates, GPS address persistence and non-JSON/empty API responses. These are not live E2E tests.
- Existing OTP service/route tests passed earlier (8 tests) and are rerun after integration.
- Backend build passed including the native push adapter.
- No live SMS, payment, order, subscription or push was sent during verification.

## Required configuration

Dummy HTTPS origins remain in .env. Provide real EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_WEB_BASE_URL.
Backend Twilio configuration is documented in ../Replitrotihai/.env.otp.example.
Set Expo extra.eas.projectId and platform push credentials before enabling notifications.
No real credentials were generated or copied.

## Backend changes this phase

server/customerMobilePush.ts adds authenticated customer push registration/removal using the existing push_subscriptions table, and Expo push submission.
server/routes.ts registers these endpoints.
server/pushService.ts routes customer notifications to native devices while preserving browser push.
No schema migration is introduced.

## Next verification sequence

Run onboarding on a physical device; confirm pin/address survives restart; browse available and unavailable kitchens; add variants to multiple baskets; test mixed-mode rejection; validate coupons and wallet limits; place a test order; submit and verify payment; track status and cancel eligible orders; buy and manage a subscription; submit a custom plan and pay after approval; verify referral/wallet updates and notification delivery. Use a test backend and test payment flow for these checks.


## Additional payment and subscription fixes

Payment reads the individual subscription schedule (including unpaid custom plans), suppresses actions on cancelled/rejected/expired records, refreshes status before confirmation and displays payment as recorded rather than independently verified. Pause dates reject impossible or past dates; purchase/request submission uses an immediate lock against repeated taps. All live order/payment/subscription actions remain untested while dummy API origins and Twilio credentials are configured.
