# Mobile Home and subscription update — 15 November 2026

Implemented only in rotihai-user. Web/backend reference unchanged in this task; prior push work preserved.

## Final Home
- Compact existing hero and exactly one active admin subscription banner near the top. No locally generated subscription promotion. Admin title, subtitle, action and colours retained.
- Category ordering follows displayOrder. Featured chefs include all serviceable chefs belonging to the first ordered category by ID/product/categoryIds mapping, regardless of category name, image presence or availability. Explicit user availability filters still apply. Currently this is Home Meals.
- One Nearby kitchens list, with all remaining kitchens; no duplicate From nearby kitchens dish carousel and no three-item truncation.
- Compact orange/gold referral strip between featured and nearby; rewards and minimum order come from referral settings; existing Referrals route handles eligibility/copy/share.
- Existing KitchenCard supports featured depth/press/entrance effects and compact nearby layout. No invented photos, ratings or distances.
- Existing SavedPaymentCard coordinates order/cart actions above tabs, hides for keyboard, scopes saved receipts to owner, and preserves native status pulse/reduced motion.

## Subscriptions
- Existing screen has Explore/My subscriptions tabs, cream membership cards, prominent actual prices and contents.
- Existing admin section groups collapse/expand one at a time, first group initially open; dynamic category/frequency filters retained. Custom plan action is below groups.
- Confirmed client failure: creation attempt was persisted before POST and never cleared after definitive rejection, permanently blocking later attempts. Standard/custom/renewal requests now clear only known rejection responses. Network, timeout, server-error and malformed-success outcomes retain recovery.
- Created subscription amount must come from its response, never fallback to marketing price. Draft resets correctly when plan/customer changes; numeric price comparisons avoid string/number false mismatches; category loading blocks premature submission.
- No new API. Existing authenticated POST /api/subscriptions uses planId, deliverySlotId, JSON address and coordinates. Server controls dates, duration, quantities and total. Existing subscription payment-reference/admin approval process preserved. No unsupported cancellation added.
- Pre-existing uncertain attempt records cannot safely be discarded automatically; reconcile via existing subscription list/support.

## Verification
- TypeScript passed; 77 automated tests passed, including rejection recovery, uncertain outcomes, authoritative amount, pending-payment persistence and dynamic category order.
- Small Android 360x720dp: existing routes checked from Home to tracking/cart, featured/nearby menus, referrals, plans, plan selection and subscription management. All four footer states passed using read-only fixtures.
- Large Android approximately 411x891dp: actual updated Home, featured category and subscription accordion rendered. Accordion collapse verified directly. Full large-screen scripted journey did not finish reliably because Android accessibility dumps stalled; do not treat it as a full pass.
- Later Home correction screenshots are in review/screenshots/premium-large, including HomeDiscoveryFinal.png and FeaturedReferralFinal.png. AccordionCollapsed.png shows the accordion before final header compaction. Earlier screenshots are intermediate designs.
- No iOS simulator available on Windows. No production subscription, payment or order submitted. Mocked creation/recovery coverage is not a live backend end-to-end pass.

## Files
Existing production files: core/api/models.ts; application/user/catalog/contentRules.ts; application/user/subscriptions/subscriptionRules.ts; presentation/user/components/BrandUI.tsx, SavedPaymentCard.tsx, UI.tsx; presentation/user/screens/DiscoveryScreen.tsx, SubscriptionScreens.tsx.
Existing verification files: tests/customer-flows.test.cjs, journey-payment.test.cjs; src/review/ReviewApp.tsx, transport.ts; review/interact-native.cjs.
New files are this report and review screenshots/logs only. No duplicate screens, providers, API clients or dependencies.
