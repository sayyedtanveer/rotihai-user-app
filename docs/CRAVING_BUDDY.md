# Craving Buddy — current implementation and verification

## Current status

Updated on 2026-11-19 after testing in Expo Go exposed the native-module limitation. **Automatic speech recognition cannot run inside Expo Go on iPhone or Android.** This revision adds an explicit diagnosis, a microphone-enabled development-client setup, better Hindi TTS pronunciation, and a voice-first UI. It does not claim that an iPhone native build has been signed or that real-device speech capture has been verified.

See [VOICE_TESTING.md](VOICE_TESTING.md) for exact iPhone / Android installation and testing steps, including a manual keyboard-dictation fallback for Expo Go.

All implementation changes are confined to `rotihai-user`. No backend, database, authentication, billing, payment or deployment changes. `Replitrotihai` and `RotiHaiMobileApp` were not modified.

## Components and services reused

- Existing Home / `DiscoveryScreen`, navigation, fonts, Warm Roti colors and Reduce Motion setting.
- `useDiscovery`, `/api/chefs/by-location` with selected coordinates/pincode, `/api/products`, `/api/categories` and existing serviceability / cache logic.
- Existing `DishCard`, product detail / variants, cart and checkout. Food-card Add opens the existing Product screen; no new order/cart path is introduced.
- Shared `Field`, `Button`, `Chip`, `ErrorView`, `Empty`, `Heading`, `Icon` and existing availability / fulfillment / rupees-off pricing functions.

## Voice behavior and diagnosis

Only tapping Buddy starts speech. The lifecycle remains `IDLE → SPEAKING → LISTENING → PROCESSING → RESULTS`. The mic starts after the greeting completes and permissions are granted. Closing, typing, backgrounding, navigation or location changes cancel the conversation, native listeners, speech, and stale async callbacks. Returning to foreground does not restart it. Temporary iOS `inactive` transitions from permission dialogs do not close the sheet.

The spoken greeting now uses Hindi script:

> हाय! आज क्या खाने का मन है? बताओ ना, कुछ बढ़िया ढूँढते हैं!

`speechProfile.ts` selects an installed Hindi India voice, preferring enhanced quality. English India is not selected to read transliterated Hindi. Rate is 0.96 and pitch is 1.02. Selection is asynchronous and cancellation-safe: closing while voices are loading cannot trigger delayed speech. The exact voice/accent belongs to the device; this does not provide a guaranteed Mumbai accent or Siri’s proprietary voice.

The adapter distinguishes Expo Go, an outdated installed app without the module, an unavailable platform speech service, an unsupported browser, and permission/language/network/audio-capture errors. Expo Go offers typing and the phone keyboard’s dictation mic as a **manual fallback**, with no false listening state. A development build is required for the full automatic flow. Supported browsers can use the recognition library’s browser adapter, subject to browser permission / secure-context restrictions.

Raw audio is not saved or sent to the RotiHai backend; recognition persistence is disabled. OS / browser speech providers may process audio online. No paid LLM or AI APIs, usage keys or application speech charges were added. Apple signing membership / build-service quotas are separate from speech API costs.

## Voice-first UI

The new sheet has an original warm multicolor orb, state-dependent pulse animation, a large mic/stop control, Hindi conversation headings, recognized speech text, quick craving suggestions, language selection, optional text input and compact food results. This is inspired by familiar voice-assistant interaction, without using Siri assets. Pulse animation indicates conversation state, not measured microphone volume. Animations stop on close and respect Reduce Motion.

## Matching

The deterministic interpreter handles common Hindi, Hinglish and Devanagari food/taste synonyms and numeric INR budgets. It matches actual names, descriptions, menu sections and categories. It does not invent chefs, products, taste tags, dietary flags, prices, ratings or availability.

Candidates come only from the existing location-filtered discovery catalog. Every search refreshes the existing queries and rejects cached/failed availability. Inactive kitchens, unavailable dishes, zero stock, invalid prices and unavailable variants are excluded. Preorder availability follows existing menu rules and is labelled. Variant budgets use the cheapest active, available, in-stock size. Prices use the existing rupees-off calculation; conditional promotional discounts are not assumed.

Diet flags are strict (`isVeg === true` / `false`). Budget is per item before delivery / checkout fees. Exact results require every keyword group; results rank by relevance, actual distance and price. Labelled alternatives preserve dietary flag and budget. Unsupported exclusions / vegan verification produce a limitation rather than misleading alternatives. Zero-price outcomes from real configured discounts remain valid.

## Files added or modified by this feature

- `package.json`, `package-lock.json`: `expo-speech`, `expo-speech-recognition`, `expo-dev-client`, plus `start:device`.
- `app.json`: native speech permission plugin, development-client plugin and provisional iOS bundle identifier. Existing `app.config.ts` can override the identifier for signing.
- `eas.json`: internal, real-device `development` build profile for both platforms.
- `src/presentation/user/screens/DiscoveryScreen.tsx`: Home entry point.
- `src/presentation/user/components/CravingBuddy.tsx`: conversation UI and existing food/navigation integration.
- `src/application/user/catalog/cravingRules.ts`: deterministic interpretation/filter/ranking over existing discovery data.
- `src/core/voice/CravingVoiceSession.ts`: cancellable conversation state.
- `src/core/voice/deviceVoice.ts`: platform detection, voice selection adapter and recognition bridge.
- `src/core/voice/speechProfile.ts`: Hindi greeting, voice ranking and actionable support diagnosis.
- `tests/craving-buddy.test.cjs`, `tests/voice-platform.test.cjs`: interpretation, availability, lifecycle and platform adapter tests.
- `docs/CRAVING_BUDDY.md`, `docs/VOICE_TESTING.md`: reports and both-phone test instructions.

Expo prebuild regenerated the ignored Android project for native configuration. Existing inspected source files were hash-checked before applying the revision. Unrelated local source edits were not reset or overwritten.

## Verification

- `npm run typecheck`: passed for the new voice adapter / UI.
- `npm test`: **176 passed, 0 failed**. Includes Hindi-script pronunciation inputs, enhanced Hindi voice selection, Expo Go diagnosis for iOS/Android, cancel during voice enumeration, recording persistence disabled, existing conversation lifecycle / interpreter tests and existing customer-flow regressions.
- Read-only browser preview at 390×844: passed no Home auto-speech, tap greeting, runtime Hindi voice selection, greeting-before-microphone ordering, final transcript → matching food, Product navigation, manual fallback, empty results, offline error and close. Greeting/listening/results screenshots were visually inspected. Browser speech events were simulated; this does not certify physical microphone or audible accent quality.
- iOS config introspection: passed. Verified bundle identifier, Microphone / Speech Recognition descriptions and development-client plugin. No iOS binary was built, signed, registered or uploaded on this Windows host.
- Android **arm64-v8a development-client APK**: `:app:assembleDebug -PreactNativeArchitectures=arm64-v8a` passed (458 tasks; 17m21s), with `expo-dev-client` / launcher and native speech libraries. Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This replaces the previous Phase 1 x86_64-only emulator APK. It still needs to be installed and tested on a real Android phone, connected to Metro using `npm run start:device`.

## Native requirements and remaining verification

`expo-speech 58.0.4`, `expo-speech-recognition 58.0.1`, and `expo-dev-client 58.0.21` are installed. Expo Go cannot load the recognizer. Install a RotiHai development build, then use `npm run start:device` and open its QR/server in RotiHai.

For a real iPhone from Windows, Expo’s build/signing route requires the user’s Expo / Apple development setup and device registration. A Mac with Xcode provides the local Apple ID / Personal Team route subject to Apple provisioning restrictions. No account or signing actions were performed here. The provisional bundle identifier must belong to the chosen Apple team before signing.

Physical-device microphone capture, audible Hindi pronunciation, Hindi/English/Hinglish recognition accuracy, system permission dialogs, background/resume, interruptions, large text and real backend matching remain device QA. Repeat the full voice-to-product-to-cart path in a test environment without real orders or payments. Better food/taste metadata can improve matching; number-word budget interpretation and automatic bilingual language switching remain future improvements.

References: [Expo TTS](https://docs.expo.dev/versions/latest/sdk/speech/), [speech recognition](https://github.com/jamsch/expo-speech-recognition), [development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Android sheet dismissal correction — 2026-11-19

An Android user reported that Buddy greeted them and then dismissed the sheet. The previous UI unconditionally called `close()` on AppState `background`. React Native documents that Android temporary system Activities can also report background; connected-phone logs showed `GrantPermissionsActivity` around the reported failure. The background-close path could therefore cancel the pending microphone permission continuation.

The sheet now stays open during AppState changes. Its voice session handles those transitions: pending permissions preserve the session without starting recording; if permission resolves just before Activity resume, recording waits for foreground (bounded to 1.5 seconds). If the app stays in background, the request expires and the customer must tap the mic again. Real background transitions during speech/listening immediately cancel audio and listeners and show a paused message; returning does not automatically restart voice. Explicit close, navigation and location changes still close and cancel normally.

The orb's `Stop` offsets were changed from `.38`/`.72` to `0.38`/`0.72` to remove the Android SVG warnings observed in logs.

Verification: `npm run typecheck` passed; `npm test` passed **184/184**. New behavioral tests cover both permission/resume orderings, close while waiting for resume, permission denial, genuine background during speech/listening, stale result rejection and prolonged background. No native dependencies/configuration changed, so the installed development app receives this fix through Metro; no APK rebuild is required. Reload RotiHai if Fast Refresh has not loaded it.

Physical-device verification remains partial: a Samsung Android phone was connected and permission-activity logs were inspected. The phone switched to another app during the post-greeting UI check, so device interaction was stopped and a user retest requested. No claim of real microphone capture or food-search success from that interrupted check is made. No orders/payments, permission resets, or app-data clearing were performed.
