# EaziCart Native — Phase 24 Generated Android/iOS Project Verification

Date: November 12, 2026. Based on Phase 23 commit `c8067aaa5919a6c300122811c8f31e60a7e01f2c`.

## Objective and result

On a fresh isolated development checkout, generated both native platform projects with installed Expo SDK 58 using `expo prebuild --platform all --no-install`. Generation succeeded while `EXPO_OFFLINE=1`, `CI=1`, and `EXPO_PUBLIC_EAZICART_API_BASE_URL=https://fixture.invalid/api`; no real backend or payment endpoint was accessed. This is native-project generation, **not a compiled Android APK or iOS IPA**.

Verified the real generated `apps/mobile/android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `ios/EaziCart.xcodeproj/project.pbxproj`, and `ios/EaziCart/Info.plist` with the existing development identifier and deep-link verifier.

- Generated Android application ID and namespace: `com.eazicart.mobile.dev`.
- Generated iOS bundle ID: `com.eazicart.mobile.dev`.
- Android and iOS register the `eazicart` scheme.
- Generated native projects are gitignored and not included in this commit; all tracked configuration files were unchanged by prebuild.

## Verified gap and code changes

The prior Android deep-link verifier would accept `eazicart` VIEW + BROWSABLE entries even when the intent filter was attached to an unexported activity, lacked Android's DEFAULT category, or belonged to an unrelated Activity. This could report a passing check even when an external deep link would not be resolvable by the expected MainActivity.

Changed the verifier to require all conditions together inside an **exported MainActivity**: `VIEW` action, `DEFAULT` category, `BROWSABLE` category, and the `eazicart` scheme. Kept existing XML-comment removal.

Added four regression tests reproducing the previously false passing cases:
1. Deep-link activity `android:exported="false"`.
2. Intent filter missing the DEFAULT category.
3. Link attached only to an unrelated Activity.
4. Exported MainActivity existing but link attached only to a separate unexported Activity.

All four new tests failed with the prior verifier and passed after this fix. The hardened verifier also passed against the actual newly generated Android and iOS files, both in combined and platform-specific modes.

## Verification

- Actual Expo Android and iOS project generation: passed (no native compilation).
- Real generated native project verification: all / Android / iOS passed.
- Prebuild unit tests: 18/18 passed (14 existing plus four new).
- All native script tests: 35/35 passed.
- Full native app tests: 103/103 passed.
- Native TypeScript typecheck: passed.
- Native ESLint: passed.
- Prettier and git diff whitespace checks: passed.
- Android manual QA branch safeguard: passed.
- Synthetic offline APK verifier: 10/10 passed (no APK generated).

## Constraints and next steps

- **No APK, IPA, Xcode compilation, Gradle build, native device installation, store upload, signing, EAS remote build, CI workflow dispatch, or deployment** was performed.
- The connected VPS devices host production workloads and are not appropriate dedicated native build runners. An approved isolated Android SDK + Java build runner and a macOS/Xcode/signing environment are still required before real binary and device QA.
- No production web/API services, live payments, database, credentials, customer wallets or data were changed.
- Review-only development branch. Do not merge or deploy without approval.
