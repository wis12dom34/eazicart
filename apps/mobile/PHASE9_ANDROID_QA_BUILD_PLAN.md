# EaziCart Native — Phase 9 Isolated Android APK Validation

Date: 2026-11-08
Status: QA-only branch; no release, production deployment, database migration, payment change or app-store publication.

## Starting checkpoint
Parent commit `970eff4276c5f9583f3bc31ea1212b28f97dbd6e` from `feat/eazicart-native-chat-block-phase8-20261108`. Native app is built with Expo 58/React Native 0.88, using Android package `com.eazicart.mobile.dev`.

## Evidence from the isolated authorized VPS clone
- Existing main VPS: no Java, Android SDK, ADB, Gradle installation; about 23GB free and only ~1.9GiB currently available RAM. Secondary VPS has only about 6GB free. **Do not modify production VPS packages or run Gradle there.**
- `pnpm install --frozen-lockfile --ignore-scripts --prefer-offline` completed in `/tmp/eazicart-native-android-build-20261108`.
- With `CI=1` and an intentionally invalid API URL, `expo prebuild --platform android --no-install` succeeded and generated Gradle project and generated debug keystore **only inside isolated temporary clone**.
- The generated Android project uses `com.eazicart.mobile.dev`, Hermes, Gradle wrapper 9.4.1, release variant signed with the local generated **debug** key. This is not a Play Store signed release or a real production app.

## Scoped QA workflow
- `.github/workflows/eazicart-native-android-qa.yml` operates only on `feat/eazicart-native-android-apk-20261108` when its scoped paths change, with a 60-minute timeout.
- Runner: ephemeral GitHub Actions `ubuntu-latest`, Java 17, Android SDK 36, build tools 36, NDK 27.1, Node 22, pnpm 10.28.1, frozen lockfile.
- Check TypeScript/lint/unit tests, regenerate Expo Android native project, compile arm64-only **release-mode, debug-signed** QA APK with embedded JavaScript, verify artifact and upload it to **GitHub Actions artifacts only**, retained for 3 days.
- Uses `EXPO_PUBLIC_EAZICART_API_BASE_URL=https://fixture.invalid/api`; the QA APK **must not be used to test live API or payments**. The configuration deliberately prevents production connections. No credentials, keystores, database URLs, push tokens or app-store identities are passed.
- No backend, database or production deployment actions are defined in this workflow. Existing CI on main remains unchanged.

## Release blockers
- GitHub Actions APK result is not proven until an actual run reports success and the APK artifact exists.
- Build failure may require adjusting runner SDK/NDK/Gradle dependencies; no build-success claim should be made before inspecting the job.
- The app needs a dedicated, approved HTTPS staging backend with synthetic users, migrated synthetic database and no production secrets.
- Physical Android and iPhone tests, app signing/distribution review, Figma comparison, accessibility and QA are outstanding.
- Never merge to main, deploy app, migrate production or publish without explicit separate approval.
