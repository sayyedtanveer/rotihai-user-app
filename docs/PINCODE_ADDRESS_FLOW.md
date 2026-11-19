# Pincode-first delivery flow

Mobile uses the web's public GET /api/admin/delivery-areas and POST /api/validate-pincode. Only active areas with an exact configured pincode are accepted; unconfigured pincodes show the web fallback message and do not change the selected delivery area or load chefs for the rejected pincode. Existing selected-area results remain associated with their original pincode.

Home discovery uses the validated pincode and area coordinates. Saved selection is revalidated when restoring. Address entry carries the Home pincode as read-only, offers configured area choices for that pincode, and binds building, street and landmark independently. Changing pincode routes back to Home with instructions to use the delivery-location header. Addresses belonging to a different pincode are not reused at checkout.

Address map/GPS/search-preview controls removed. Legacy onboarding location/search/confirm branches use the existing pincode screen. Full building/street/area/pincode is still geocoded through the existing web endpoint before checking the selected kitchen and server fee. Pincode-only geocoding fallback remains rejected rather than billed as an exact house location. No Google map key is required for this address flow.

Web/backend unchanged. Existing backend geocoding availability is still required; it can use OpenStreetMap without Google. No new APIs, recipient contracts, or saved-address database were introduced.

Validation: final TypeScript check and 79 automated tests pass. Actual Android screenshots captured in review/screenshots/pincode. Native checks confirmed unsupported pincode rejection, read-only address pincode and map-free area selection. Address-to-checkout interaction verification is recorded separately; no live orders or payments were submitted.

Native journey PASS: rejected 999999; confirmed no editable pincode/map; entered ReviewFlat12 and SampleRoad independently; saved guest address and reached existing Review order with building preserved. Uses read-only fixture APIs and local test storage only. Screenshot: review/screenshots/pincode/PincodeAddressCheckout.png.

Existing customer prefill: structured address fields are parsed independently of coordinates, including houseNumber/addressStreet aliases and numeric pincodes. Same-pincode profile fields fill incomplete local drafts; late profile updates hydrate only untouched forms. Different-pincode addresses remain excluded. Unserviceable pincodes now use the web Hero copy: “We're not here yet!” and a Try another pincode action. Operational/network errors remain errors, not unsupported-area claims. Regression suite: 80 passed.

Address recovery: web checkout saves the profile address non-blockingly, so an existing order may contain building/street while the profile is incomplete. Mobile now falls back to the latest structured order address for the exact authenticated user ID and selected pincode. Phone-only/unowned orders are excluded; customer edits are preserved. No backend changes. Android RecoveredAddress fixture verified both Recovered Flat 24 and Recovered Station Road with an empty profile address. TypeScript passed; 81 regression tests passed.

Bill details: shows estimated pricing distance using server-returned straight-line distance and the current admin road multiplier (same formula/default as backend). This is an estimate, not a measured road route. Displays configured convenience-fee tiers/waiver, backend amount remaining for free delivery, and applied bonus/coupon/wallet credits. No additional handling, tax or packaging charge invented. TypeScript and 83 tests pass.
