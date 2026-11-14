# Customer UI visual review

Open [the screen gallery](../review/index.html) for Android captures and web comparisons.

The existing gallery includes Home, Explore, sectioned kitchen menus, Combo Deals selection, inactive kitchens in category results, product and variant details, missing-image products, cart availability, checkout and bill, orders and timeline, subscriptions, account/profile/address/wallet/referrals, notifications/privacy, recovery, onboarding and loading/empty/offline states.

Actual Android interaction checks exercised the section picker, Combo Deals selection, Android Back dismissing the picker, local quantity updates, category results retaining an inactive chef, and scrolling through the checkout bill. Logs: ../review/native-interactions.txt.

## Review method

- Real app screens run in Android Expo Go using the isolated development review transport.
- Public catalog snapshots retain real kitchen/category/product/section data and authentic available photos.
- Account, order and payment details are local samples.
- Web comparisons render the deployed UI at a mobile viewport with sample API interception.
- No live writes, OTPs, orders or payments are performed.
- Screen groups and full-resolution captures are listed in ../review/screenshots/manifest.json.
- Missing product images intentionally have no photo substitute.

## Validation

39 local regression tests pass, including menu grouping, inactive category visibility, cart availability, fresh checkout eligibility, payment persistence-before-launch, launcher failure recovery, token-bound private caching, offline mutation rejection and review transport write blocking.

TypeScript passes. Android and iOS production Hermes exports pass in dist-journey-review. Exported bundles were checked for the review account/order markers; those markers are absent. Native payment query configuration introspection passes (../review/payment-native-config.json). A JavaScript/Hermes export is not a signed native release build.

The gallery contains 52 Android captures covering all 43 registered screens/states, with no missing captures. Home, phone entry, guest cart/address/checkout, payment, recovery, checkout and splash were refreshed for the current implementation. The headless emulator was rendered at half resolution with matching density after a System UI startup stall; layout dimensions are preserved. Screenshots carry sample-data labels. Installed GPay and iOS native visuals remain unverified. Emulator map tiles were unavailable; manual/GPS address flows and map-loading/unavailable feedback remain available.

## UX decisions

- Home emphasizes delivery area, food categories and kitchens. Search lives in Explore.
- Menus expose food-type and combo sections without forcing a long flat scroll.
- Closed kitchens stay discoverable; availability is explicit before adding.
- Inter hierarchy, restrained orange/gold accents, compact cards and consistent spacing follow the web brand while adapting for touch.
- Pending payment resumes the same order. A return from a UPI app is never described as payment success.

The corrected guest flow routes basket → address → checkout without a login page. It reuses the saved startup phone, keeps private wallet/profile queries disabled for guests, and transfers the guest address and checkout draft after verification.

Guest interaction verification: basket → address was observed and captured in GuestCartToAddress.png. The final address-save tap-through was not fully certified because Android UiTestAutomationBridge repeatedly returned a null accessibility root. See ../review/guest-checkout-interactions.txt. Guest checkout state screenshots and the address/draft migration regression test pass. No OTP, order or payment action was pressed.

## Latest implementation validation

The saved-number checkout handoff now recovers contact from storage/context and goes directly to the existing OTP screen when protected submission needs verification. Address and checkout review remain open to guests. TypeScript and 58 tests pass. Current Android/iOS Hermes exports pass with review fixtures excluded. Android x86_64 debug APK compilation passed after the local Windows CMake path fix. New native screenshot acceptance is being refreshed separately.
