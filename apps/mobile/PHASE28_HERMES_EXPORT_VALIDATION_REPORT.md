# EaziCart Native — Phase 28 Verified Expo Android & iOS Hermes Exports

Date: November 13, 2026. Baseline Phase 27 commit `798a411d3d264e5a8ab4d5683e15b88c38abe88c`.

## Completed work

From a clean temporary checkout, using cached Expo SDK 58 packages and `CI=1`, `EXPO_OFFLINE=1`, `EXPO_NO_TELEMETRY=1` and the synthetic `EXPO_PUBLIC_EAZICART_API_BASE_URL=https://fixture.invalid/api`, exported platform-specific JavaScript and assets. These are **Metro/Hermes JavaScript bundles only**, not compiled or installable Android/iOS apps.

- Android Metro export succeeded: 1,441 modules; 3,333,725-byte Hermes bundle, 28 asset references.
- iOS Metro export succeeded: 1,296 modules; 2,995,240-byte Hermes bundle, 24 asset references.
- Both `metadata.json` manifests pointed to their respective platform bundles. Bundles and referenced assets existed in the isolated export directories.
- No network endpoint, payment API, signing service or real customer data was used in validation.

## Changes on this review branch

- Added `apps/mobile/scripts/native-js-bundle-verify.mjs`: read-only fail-closed verification of a single requested Metro platform, compiled Hermes entry file and all referenced exported assets. Rejects missing/malformed metadata, wrong-platform bundles, empty or missing files, unsafe paths, duplicates and symlinks escaping export directory.
- Added eight regression tests: Android and iOS valid bundles; missing/wrong metadata; missing, small or unsafe bundle; missing/empty/duplicate/path-traversal assets; malformed records; CLI refusal; escaping symlink directory; and static Android/iOS workflow order controls.
- Registered `verify:js-bundle` and `test:js-bundle` package scripts.
- Updated both prepared manual-only Android debug and iOS Simulator QA workflows to export and verify their platform's Hermes bundles before native prebuild/compile.
- Added build-readiness instructions to the mobile README, including clarification that exports are not installable native binaries.

## Executed verification

- Expo Android JavaScript/asset export: passed.
- Expo iOS JavaScript/asset export: passed.
- New export verifier against both actual generated export directories: passed.
- Full native build-safety script suite: 62/62 passed.
- Native client test suite: 103/103 passed.
- TypeScript and ESLint: passed.
- Prettier and git diff whitespace checks: passed.

## Safety, limitations and next steps

- No Android APK or iPhone IPA was built. No Gradle, CocoaPods, Xcode, EAS build, CI workflow dispatch, signing, installation, device testing, Play Store/App Store upload or production deployment was performed.
- The connected VPS machines host production applications and are not approved native build runners. A dedicated Android SDK runner and authorized Apple Silicon macOS runner with Xcode/CocoaPods are still required for actual binaries and device QA.
- Staging remains a synthetic nonresolvable fixture; real build QA must first attest a separate isolated disposable staging backend.
- No live payments, KoraPay keys, wallets, production services, user data, migrations or databases were changed. This branch is review-only.
