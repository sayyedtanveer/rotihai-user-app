# Test Craving Buddy on iPhone and Android

## Why the microphone did not work in Expo Go

Expo Go is a precompiled app. It includes text-to-speech, but it does not include `expo-speech-recognition`, which Craving Buddy needs for speech-to-text. This affects **both iPhone and Android**. Granting permissions, reinstalling npm packages or restarting Metro cannot add native code to Expo Go.

You can preview the improved UI, Hindi greeting and typed matching in Expo Go. For the complete greeting → automatic microphone → transcript → food flow, install a **RotiHai development build**. This is your app with its native modules included. After installing it once, everyday JavaScript edits still reload from Metro.

The project now includes `expo-dev-client`, an internal `development` profile in `eas.json`, and `npm run start:device`. The build has not been submitted to Expo or Apple. iOS signing and installing an app on your phone need your account/device setup.

## Try the new Hindi greeting and design in Expo Go now

Run `npx expo start --go --lan` in this project and scan its QR in Expo Go. Tap Craving Buddy. You can hear the improved greeting, preview the design and type a craving. To quickly try speech input without a native build, tap the craving text field and tap the **iPhone keyboard’s dictation microphone** (if enabled on your phone). Apple dictation inserts text into that field; press Find food afterward. This is a manual keyboard fallback, not the automatic microphone conversation. The central Buddy microphone remains unavailable in Expo Go instead of pretending to work.

If the keyboard dictation mic is missing, check Settings → General → Keyboard → Enable Dictation. See [Apple’s Dictation instructions](https://support.apple.com/guide/iphone/dictate-text-iph2c0651d2/ios).

## iPhone — Windows computer using Expo’s build service

Requirements: an Expo account and an Apple Developer Program membership for signing an internal build for a real iPhone. An iOS Simulator build cannot be installed on your phone. Expo account/build quotas and Apple membership are separate from speech or AI API charges.

On this Windows workstation, npm needed the Windows certificate trust store. In the current PowerShell terminal, use `$env:NODE_USE_SYSTEM_CA='1'` if you encounter the same registry certificate error. TLS verification stays enabled.

1. Open a terminal in `C:\Users\sayye\source\repos\rotihai-user`.
2. Run `npx eas-cli login` and sign in to your Expo account.
3. Run `npx eas-cli build:configure --platform ios`. Before your first signed build, set `ios.bundleIdentifier` in `app.json` to a unique identifier owned by your Apple team if the provisional `com.anonymous.rotihaiuser` is not yours. For an existing signed app, keep its registered identifier. `IOS_BUNDLE_IDENTIFIER` in `app.config.ts` also supports a build-environment override; keep local and cloud build environments consistent.
4. Run `npx eas-cli device:create`, open its registration URL on the iPhone, and follow Expo’s device registration instructions.
5. Run `npx eas-cli build --platform ios --profile development`. Sign in to the correct Apple team when the CLI requests it and review signing prompts. This starts a cloud build; no such build was started by Codex.
6. When it finishes, open the install link on the registered iPhone and install **RotiHai**. Follow iOS’s Developer Mode prompt if requested.
7. On the computer, run `npm run start:device`. Keep the computer and phone on the same reachable Wi-Fi. Scan that terminal’s development-build QR code with the iPhone Camera and open it in **RotiHai**, rather than Expo Go. You can also open the RotiHai development launcher and select the server.
8. If your Wi-Fi isolates devices, stop Metro and try `npx expo start --dev-client --tunnel`. This changes how the development server is reached, not which app contains the native module.
9. Tap Craving Buddy. Allow **Microphone** and **Speech Recognition** when requested. Wait for the greeting to finish; then speak. Example: “मुझे तीखा चिकन डेढ़ सौ रुपये के अंदर चाहिए” for speech capture; for the numeric Phase 1 budget interpreter, prefer “spicy chicken under 150” or type a numeric budget if the speech engine returns number words.

Without an Apple Developer membership, the local Mac/Xcode option below can be used with an Apple ID. Expo Go is still not a speech-recognition workaround.

## iPhone — Mac with Xcode

1. Copy/clone this project to the Mac and run `npm install`.
2. Install/configure Xcode, connect and trust the iPhone, and enable Developer Mode if requested.
3. Run `npx expo prebuild --platform ios --no-install`. Do not use `--clean` over native changes you want to keep.
4. Open the generated iOS workspace in Xcode, select your Apple development team and a unique bundle identifier. A free Personal Team has Apple’s provisioning restrictions and requires periodic re-signing; paid membership is not required for this local route.
5. Run `npx expo run:ios --device`, selecting the connected phone. Then start Metro with `npm run start:device` if it is not already running.
6. Open the installed RotiHai app and test the same flow. Never test native speech in Expo Go expecting it to load your custom module.

## Android — local development build on Windows

Requirements: Android Studio SDK, Java, and a real Android phone with USB debugging enabled (or an emulator with a speech recognition service).

An **arm64-v8a RotiHai development APK has already been built locally** at `android/app/build/outputs/apk/debug/app-debug.apk`. You can transfer this APK to an arm64 Android phone, install it, and continue with step 5 below. Steps 1–4 rebuild/install it from source when needed. The APK is a development app: it connects to Metro and is not a standalone store release.

1. In the same project directory, run `npm install`.
2. Connect the phone by USB. Approve its USB debugging prompt.
3. Run `npx expo prebuild --platform android --no-install` to apply native permissions and development-client configuration.
4. Run `npx expo run:android --device` and select your phone. This compiles, installs and launches the RotiHai development app. The previous x86_64-only APK was for an emulator; do not install it on a typical arm64 phone expecting it to work.
5. For subsequent tests, run `npm run start:device` and open the project in the installed RotiHai development app. For USB networking, `adb reverse tcp:8081 tcp:8081` can make Metro reachable. Same-Wi-Fi QR/server selection is also available.
6. Allow microphone access when prompted. Ensure a supported speech recognition service, such as Google’s service, is enabled and supports Hindi / English.

Alternative cloud route: `npx eas-cli login`, `npx eas-cli build:configure --platform android`, then `npx eas-cli build --platform android --profile development`. Install the returned APK, then connect it to Metro. Apple signing is not involved in Android builds.

### This workstation’s local Android certificate setup

The verified local build used the existing workstation trust bundle because Java could not validate the network’s certificates. If the standard local build fails with the same PKIX error, set these in your PowerShell session before running `npx expo run:android --device`:

```powershell
$env:NODE_USE_SYSTEM_CA='1'
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_TOOL_OPTIONS='-Djavax.net.ssl.trustStore=C:\Users\sayye\source\repos\rotihai-user\review\native\build-truststore.jks -Djavax.net.ssl.trustStorePassword=changeit'
```

This uses an existing local certificate store; it does not turn off TLS verification or change machine-wide settings. Do not upload the workstation trust bundle to a cloud build. The default project trust-store password is for public certificate data, not an Apple or app signing password.

## Voice and UX changes

- The greeting now uses actual Hindi script: “हाय! आज क्या खाने का मन है? बताओ ना, कुछ बढ़िया ढूँढते हैं!”
- Installed Hindi India voices are selected at runtime, preferring enhanced quality. An English India voice is not selected to read romanized Hindi. Speaking speed and pitch stay close to their natural defaults.
- The app cannot promise a specific Mumbai accent or Siri’s proprietary voice using free device TTS. Available voices are controlled by iOS/Android. Add a Hindi voice through the phone’s speech settings if one is missing.
- On iPhone, voice options are under Accessibility → Read & Speak (called Spoken Content on older iOS versions) → Voices. Choose/download Hindi if available. Apple also documents voice downloads through Accessibility → VoiceOver → Speech; you do not need to enable VoiceOver just to select a voice. See [Apple voice settings](https://support.apple.com/en-in/111798).
- The sheet has a warm multicolor voice orb, state-dependent pulse animation, a central mic/stop control, live recognized text, language controls, optional typing and quick craving suggestions. Animations stop on close and respect Reduce Motion. Pulse animation represents the conversation state, not measured microphone loudness.
- Expo Go, missing native modules, missing recognizers and permission errors have distinct explanations. There is no simulated microphone success.
- Raw audio is not saved or sent to RotiHai. The device speech provider may use a network connection. No paid AI APIs were added.

## Test checklist

1. Normal Home opening: no speech, no microphone permission request.
2. Tap Buddy: Hindi greeting, speaking orb; microphone starts only after completion and permission approval.
3. Speak Hindi / Hinglish, then English with the English control. Confirm actual transcript and real menu results.
4. Tap “Finish speaking” to submit the current transcript; no duplicate search.
5. Close during speech, during voice selection, during listening and during a network search. Reopen cleanly.
6. Deny permissions and retry; enable them through Settings and reopen. Missing recognition service must produce an actionable explanation.
7. Background the app and return: no background listening or automatic restart. iOS permission prompts should not close the sheet merely because iOS briefly reports `inactive`.
8. Test silence, speech-service network failure, offline menu refresh, empty results and multiple kitchens.
9. Select a food card, choose any variant, add to the existing cart and review checkout in a test environment. Do not place real orders or make payments.
10. Verify Reduce Motion, large text, a small screen, safe areas, keyboard and VoiceOver/TalkBack.

References: [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/), [using the development launcher](https://docs.expo.dev/develop/development-builds/use-development-builds/), [recognition module](https://github.com/jamsch/expo-speech-recognition), [Expo TTS](https://docs.expo.dev/versions/latest/sdk/speech/).
