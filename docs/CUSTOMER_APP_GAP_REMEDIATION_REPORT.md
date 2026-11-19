# Customer app gap remediation — in progress

## Current completion: PARTIALLY_FIXED

Baseline: mobile main; backend dev. Both contain extensive existing uncommitted work, preserved. Reviewed corrected 2026-11-19 parity report. Baseline mobile: 165 tests passed; TypeScript passed. No production records accessed, migrations run, or deployments performed.

| ID | Revalidation | Change / remaining work | Completion |
|---|---|---|---|
| F01 | VERIFIED_GAP | Added existing checkout bonus opt-in; useBonus already feeds authoritative quote and order. No client discount calculation added. Full reward concurrency/expiry acceptance pending. | PARTIALLY_FIXED |
| F02 | VERIFIED_GAP | Added checkout referral entry, existing public validation with order amount, explicit application, fresh pre-submit validation and referralCode in existing order payload. No immediate referral discount invented. Runtime acquisition/expiry/concurrency acceptance pending. | PARTIALLY_FIXED |
| F03 | VERIFIED_GAP | Browser/customer channel mismatch confirmed. Backend customer connection trusts supplied IDs without token verification; changing channel alone is insufficient. Authorization and compatibility work pending. | BLOCKED |
| F04 | VERIFIED_GAP | Existing pause route accepts omitted resume date and stores null. Mobile now supports that request and displays indefinite paused state. Scheduler/resume runtime acceptance remains pending. | PARTIALLY_FIXED |
| F05 | VERIFIED_GAP | Renewal calculates frequency duration but uses 30 for end date/delivery count. No unsafe mobile restriction removal performed. | BLOCKED |
| F06 | RUNTIME_UNVERIFIED | Discovery-wide filters need remaining metadata/UI audit. | RUNTIME_UNVERIFIED |
| F07 | VERIFIED_GAP | Removed first-subscription-only partition. Existing ordered active banners now render together in compact horizontal Home rail. Existing actions reused; footer untouched. Runtime acceptance pending. | PARTIALLY_FIXED |
| F08 | RUNTIME_UNVERIFIED | Notification controls and physical push acceptance pending. | RUNTIME_UNVERIFIED |
| F09 | RUNTIME_UNVERIFIED | Phone-only token issuance and unsupported OTP fallback require security and recovery review. | RUNTIME_UNVERIFIED |
| F10 | RUNTIME_UNVERIFIED | Quote enforces wallet eligibility; navigation/program visibility audit pending. | RUNTIME_UNVERIFIED |

## Files changed in this remediation batch

- src/presentation/user/screens/CheckoutScreen.tsx: bonus opt-in using existing useBonus and quote bill.
- src/presentation/user/screens/DiscoveryScreen.tsx: render all eligible admin-ordered promotional banners in one existing compact rail.
- This report and review/gap-*.log baseline/regression artifacts.

## Reused functionality

Existing Toggle, MealPlanBanner, activeBanners sorting, bannerAction navigation, bonus eligibility request, authoritative billing quote, bonus bill line, order payload and footer. No duplicate API, screen or pricing service.

## Backend/database

No backend/API/schema changes in this batch. No migration required for these two UI changes. Applied database state has not been inspected.

## Verification and limitations

Baseline: 165 tests passed; TypeScript passed. Post-change logs: review/gap-batch-tests.log and review/gap-batch-typecheck.log. These checks do not demonstrate runtime reward redemption or banner navigation. New focused UI tests, full backend baseline/build checks, staging and physical-device acceptance remain pending. Existing tests include Craving Buddy coverage.

## Release sequence

Do not treat this report as release approval. Finish reward contracts/security/lifecycle audits, add focused tests, complete backend and mobile regressions, then staging/device acceptance. Production deployment and live migrations require separate approval.

## Referral batch verification

Added verifyCheckoutReferral in existing couponRules.ts and existing CheckoutScreen UI/order payload. Added executable mocked-contract coverage in tests/customer-flows.test.cjs for normalized code, order amount, rejected/invalid responses and no invented discount. Full mobile suite: 166 passed, 0 failed; TypeScript passed. Logs: review/gap-referral-tests.log and review/gap-referral-typecheck.log. No backend, schema or live data changes. WebSocket compatibility audit found several web subscribers using unauthenticated customer IDs; a mobile-only channel swap cannot establish secure event ownership. That remediation remains pending, not complete.

## Indefinite-pause batch

Scoped changes: application/user/cart/dateRules.ts, presentation/user/screens/SubscriptionScreens.tsx, tests/customer-flows.test.cjs. Blank resume date is omitted from the request; no arbitrary future date, backend change or migration. Dated validation is retained. Focused executable tests cover indefinite/datetime request shape and invalid/past dates. Full regression logs: review/gap-pause-tests.log and review/gap-pause-typecheck.log. Real scheduled delivery suppression and subsequent resume have not been exercised; no promise of extending validity for an indefinite pause is introduced.

## Renewal duration review and scoped fix

Confirmed the existing renewal handler calculated renewalDurationDays but ignored it for end date and delivery count. Updated only those duration uses in Replitrotihai/server/routes.ts. Daily now uses 1, weekly 7, monthly 30; current price and existing records are unchanged. Added tests/subscription-renewal.test.cjs executing the actual extracted handler with mocked storage for all three frequencies. Backend bundle compiled; 39 isolated renewal/billing tests passed (loopback fixture required unsandboxed test execution). No database access or migration.

F05 remains PARTIALLY_FIXED: mobile non-monthly renewal remains disabled. Durable renewal idempotency, first-delivery versus count date alignment, timezone handling and schedule-log consistency still require remediation before enabling it. These tests prove duration inputs/end-date behavior, not complete renewal lifecycle safety. Backend compile output is docs/billing-validation/gap-backend-check.mjs; test log gap-renewal-tests.log. No unrelated application code changed in this batch.

## Renewal availability safeguards

Reviewed renewal storage/schema: no durable request key exists. Added rejection of admin-inactive plans and missing/inactive previous delivery slots in the existing renewal handler. Tests execute that handler with mocks and assert HTTP 400 with zero subscription writes. Existing duration cases retained. No mobile changes, schema changes or migrations in this batch. Durable renewal idempotency and schedule/date consistency remain outstanding; non-monthly mobile renewal remains disabled. This is not full F05 completion.

## Discovery and notification controls batch

Added explicit-true vegetarian filtering to existing Home/Explore dishes and kitchen eligibility; selection passes to the existing menu filter. Unknown dietary metadata is excluded. Existing serviceability and availability predicates remain. Added individual notification mark-read, unread count on notification screen, and confirmed clear-all using existing owner-scoped device storage. Notice state resets when the owner changes. No new backend APIs. Files: DiscoveryScreen.tsx, CatalogScreens.tsx, navigation/types.ts, AccountScreens.tsx, CustomerProvider.tsx. Current full suite: 184 passed, TypeScript clean before final route propagation; final TypeScript rerun recorded below. No new physical-device acceptance. F06/F08 remain PARTIALLY_FIXED: Home notification badge, focused runtime checks and remaining event/ownership infrastructure still pending. Overall completion remains PARTIALLY_FIXED, not full remediation.
