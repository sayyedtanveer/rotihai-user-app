# Address flow update

Mobile only; web/backend unchanged. Uses existing /api/geocode-full-address, /api/chefs/by-location and /api/calculate-delivery.

- High-accuracy foreground GPS with 20-second wait limit and reported accuracy. No automatic background location.
- Complete-address lookup sends building, street, area and pincode like the web contract. Approximate pincode-only results are rejected.
- Street/area/city/pincode edits invalidate confirmation and delivery quote. Moving the map pin clears stale locality details and attempts native reverse geocoding; failed reverse lookup asks for manual details.
- Map overlay blocks invisible pin interactions. Confirming without a rendered map is permitted only for a GPS fix reporting <=50m accuracy or a backend exact search result, with explicit customer confirmation. This is a quality gate, not a guarantee of entrance accuracy.
- Fresh serviceability request includes pincode and validates the actual cart chef. Fresh backend quote is checked before save; checkout refreshes again. Missing settings, invalid fees and outside-zone responses cannot be treated as free delivery.
- Address page redesigned with warm cards, numbered location/details sections, map, location feedback, delivery preview and bottom action. Existing profile save semantics retained.

## Setup required
Set GOOGLE_MAPS_ANDROID_API_KEY in the build environment with a restricted Android Maps SDK key and rebuild the native app. app.config.ts now maps it to android.config.googleMaps. This is separate from Firebase google-services.json. No key was invented or provisioned.

## Limits
Existing distance pricing remains admin-adjusted straight-line distance, matching the web; no routing provider or backend changes were introduced. Recipient contacts/multiple saved addresses are not added. Real-device GPS, Google map rendering and final native screenshot verification still require follow-up. No live order or payment was submitted.
