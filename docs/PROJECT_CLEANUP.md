# Project cleanup — 15 November 2026

Reviewed the application entry points, navigation imports, Expo plugins, test fixtures and source placeholders before deletion.

Removed seven rebuildable exports: dist-admin-parity, dist-checkout, dist-customer-check, dist-journey-review, dist-onboarding-check, dist-ui-check and dist-ui-final. These are ignored generated outputs, not application source.

Removed the unused scaffold src/presentation/user/screens/HomeScreen.tsx and its otherwise-unused index.ts re-export. Home continues to use DiscoveryScreen through CustomerHomeScreen.

Removed obsolete scaffold README files under src and folders left completely empty. They incorrectly said the implemented app features were still reserved for future work. Current documentation stays in docs.

Source/doc recovery copies are in review/backups/cleanup-20261115. Generated exports can be rebuilt using Expo export.

Kept Android native build sources, node_modules, lockfile, Expo configuration, environment files, Git/IDE state, build plugins, tests, real assets, review fixtures/scripts/screenshots and recovery backups. Review fixtures are imported by tests and development review routes; plugins are referenced by app.json. Reference projects were not changed.
