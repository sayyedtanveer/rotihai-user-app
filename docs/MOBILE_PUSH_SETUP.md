# Native order notifications
Implementation is local only. No database migration, deployment, credential creation or real push has been performed.

## Mobile-only API
GET /api/mobile/push/config returns enabled.
POST /api/mobile/push/devices registers {token,platform} with the existing customer bearer token.
DELETE /api/mobile/push/devices deactivates {token} only for the authenticated owner.
No browser endpoints or push subscription records were changed.

## Activation
1. Create/link the rotihai-user Expo/EAS project. Set EXPO_PUBLIC_EAS_PROJECT_ID to its project ID.
2. Create a Firebase Android app with the exact application ID com.anonymous.rotihaiuser (or choose the final ID before release). Download its google-services.json and set GOOGLE_SERVICES_JSON to that file path. Upload the FCM v1 service-account credential through EAS credentials; never bundle or commit the private service-account key.
3. For iOS, choose IOS_BUNDLE_IDENTIFIER and configure an Apple developer APNs key/provisioning through EAS.
4. Apply Replitrotihai/migrations/20261115_mobile_push.sql explicitly after normal database review/backup.
5. Deploy the backend source and set MOBILE_PUSH_ENABLED=true. If Expo enhanced push security is enabled, set the server-only EXPO_ACCESS_TOKEN.
6. Build/install a new native app. Expo Go is not a push test target. In Account, choose Enable notifications and grant OS permission.
7. On a dedicated test account/device, test foreground, background, closed app, notification tap, permission denial, token rotation, logout and account switch. Android force-stop and OS/battery restrictions can prevent delivery.

## Behavior
Existing order-update broadcasts enqueue native events asynchronously. Browser push remains separate. A database outbox de-duplicates device/user/order/status, uses worker leases and bounded retries, checks Expo receipts, and disables invalid tokens. The current worker requires a running backend process. Old queued notifications expire after one hour; receipts are checked for up to a day.
The client registers granted permissions at login/resume/token rotation; first permission prompt is explicit. Notification taps validate order access before navigation.
Remote delivery is best-effort: provider acceptance is not proof of device display. A crash after provider acceptance can still cause duplicate delivery on retry.
Logout attempts device deregistration without blocking local logout. If the network is unavailable, server deregistration can fail; already delivered OS notifications cannot be recalled. Payloads contain generic order wording and order/user IDs, not phone/address/payment details.
This uses the existing customer bearer-token authentication contract, including its current phone-only MVP limitation.

## Verification
Mobile TypeScript/regression checks and backend build are required. Backend tests: node --test tests/mobile/push.test.cjs.
No production delivery is claimed until configured and device-tested.

Official setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
FCM: https://docs.expo.dev/push-notifications/fcm-credentials/
