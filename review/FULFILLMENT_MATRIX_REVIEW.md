# Instant, preorder and selected-chef delivery review

Implemented in `rotihai-user`; web/backend inspected read-only. No API/schema changes, migrations, deployment, live customer access or real order/payment requests.

## Resulting behavior

- Product delivery-mode override takes priority; inherited products use the selected chef mode. Valid API effectiveMode is reused.
- A category offering delivery slots does not force preorder or mandatory scheduling.
- Instant/default flexible baskets retain Deliver now, with optional scheduling where offered.
- Preorder baskets require a selected day and one of that chef’s enabled Lunch/Dinner meals. Global meal windows and chef notice periods are respected. Expiration uses meal end, matching web. Tomorrow remains available as on web.
- Flexible `both` dishes may join either mode. Instant-only and preorder-only dishes cannot share a chef/category checkout. Different chef/category groups remain independent.
- Active but currently closed kitchens accept preorder dishes and flexible dishes in a preorder basket. Inactive kitchens remain unavailable.
- Draft selection is scoped to the chef/category checkout. Fresh product, chef, settings and existing backend preorder validation are checked before submitting. A disabled/expired meal cannot submit.
- Existing pricing quote, wallet, payment confirmation and duplicate-order protection remain in place.

## Modified files for this task

- `src/application/user/catalog/menuRules.ts`: shared effective-mode resolver and product-aware kitchen availability.
- `src/application/user/cart/cartRules.ts`: shared basket fulfillment classification and controlled-clock business date support.
- `src/application/user/cart/checkoutRules.ts`: chef-specific meal choices, fresh-mode validation and submission checks.
- `src/application/user/cart/restoreCart.ts`: restored basket compatibility and closed-chef preorder support.
- `src/core/api/models.ts`: type existing chef preorder settings.
- `src/presentation/user/screens/CatalogScreens.tsx`: allow eligible preorder additions from closed active chefs.
- `src/presentation/user/screens/CartScreen.tsx`: mode-aware availability and incompatible basket guard.
- `src/presentation/user/screens/CheckoutScreen.tsx`: selected chef meal loading, enabled-meal UI, per-checkout draft reset and fresh validation.
- `src/review/ReviewApp.tsx`, `src/review/transport.ts`: development-only lunch/dinner fixtures and isolated review attempt state.
- `tests/fulfillment-matrix.test.cjs`: 29 isolated matrix cases, including execution of actual reference web calculator and backend product-mode handler with mocks.
- `review/fulfillment-browser.cjs`: running Expo browser checks with external APIs blocked.

## Verification

- Full mobile suite: 138 passed, 0 failed, 0 skipped.
- TypeScript: passed.
- Actual-source parity: product/chef mode combinations and selected-chef meal windows compared with the existing web/backend code, using controlled clocks and mocked storage.
- Running Expo UI: lunch-only and dinner-only chefs, explicit meal selection, closed active chef preorder, protected submission; passed at 375px and 390px.
- Running Expo regression UI: Deliver now without a slot, optional scheduling, required address fields and correctable map pin; passed at both widths.
- Android and iOS JavaScript/Hermes exports: passed, artifacts in `review/fulfillment-export`.
- `git diff --check`: passed (existing line-ending warnings only).

Screenshots: `review/screenshots/fulfillment/`. Logs: `review/fulfillment-all-tests.log`, `review/fulfillment-matrix-typecheck.log`, `review/fulfillment-browser-final.log`, `review/fulfillment-regression-browser.log`, `review/fulfillment-export.log`.

## Scope of validation

Browser UI checks use explicit development-only fixtures and reject every order/account/payment mutation. Native exports verify compilation, not a signed native-device end-to-end run. Live chef configuration and actual order/payment execution were not accessed. Existing unrelated working changes were preserved.
