# RotiHai User

Native customer frontend using the existing RotiHai web backend. Expo 58, React Native 0.88.1, React 19.3.0, TypeScript, React Navigation and TanStack Query; follows the chef app's core/application/presentation architecture.

Implemented screens cover onboarding, GPS/map delivery addresses, browsing, product variants, persistent baskets, checkout, UPI payment, orders, subscriptions, custom roti plans, profile, wallet, referrals and notifications.

See [customer coverage](docs/CUSTOMER_COVERAGE.md) for the exact scope, remaining parity gaps, verification and required configuration. This is not yet a live E2E-verified release.

## Run

npm install
npm run typecheck
npm start

Set the real HTTPS API and website origins in .env. Dummy origins currently prevent live requests. Twilio credentials belong only in the backend. Native push needs Expo project/platform configuration; release Android maps need Google Maps configuration.

## References

- ../RotiHaiMobileApp: mobile architecture and stack.
- ../Replitrotihai: customer behavior and existing backend.
- docs/USER_FEATURE_MAP.md: web-to-native source map.

Admin, partner management and delivery-worker modules are excluded. Customer kitchen selection and order delivery tracking are included.