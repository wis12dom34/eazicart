# EaziCart Native — Expo SDK 58 Android Toolchain Compatibility

Date: 2026-11-07
Status: **Isolated development review only; NO build, deployment, payment activation, runner enrollment or publication.**

## Fixed the blocking native QA build prerequisites

- Updated `apps/mobile/scripts/android-runner-readiness.mjs` to require **JDK 17**, matching the documented Expo SDK 58 EAS build infrastructure and React Native environment recommendations. The older JDK 21 requirement incorrectly rejected the standard Expo SDK 58 build environment.
- Corrected Android SDK layout inspection: `platforms/android-37/android.jar`, not the non-existent `platforms/android-37.0` directory. Checks also cover `build-tools/37.0.0/apksigner`, `ndk/27.1.12297006/source.properties`, `platform-tools/adb` and `JAVA_HOME/bin/java`.
- The guarded `apps/mobile/scripts/android-debug-qa.sh` checks the same real SDK layout before Gradle and additionally repeats the existing GET-only `android-qa-staging-handshake.mjs` validation before any Gradle action.
- Maintained root/user, live EaziCart service, production source, disk, RAM, swap, feature-branch, approved SHA, isolated Gradle cache, HTTPS staging URL, KoraPay synthetic-only and disabled native checkout rules. Workflow remains manual-only and not activated.

## Verification

- 18/18 Android runner readiness, staging-host and identity handshake tests passed.
- Main/forged-branch/tag shell refusal tests passed.
- Local build helper refused the shared VPS (exit 23) without reaching Gradle.
- Read-only runner inspection refused the live EaziCart VPS (exit 23) for root, running production services/source, insufficient disk/swap and missing approved isolated toolchain.
- **50/50** mobile regression tests passed; mobile ESLint and TypeScript checks passed.
- Bash syntax, Prettier and Git whitespace checks passed.
- No APK or IPA was created; no actual Android hardware or iOS simulator tested.

## Files

- `apps/mobile/scripts/android-runner-readiness.mjs`
- `apps/mobile/scripts/android-runner-readiness.test.mjs`
- `apps/mobile/scripts/android-debug-qa.sh`
- `apps/mobile/PHASE3_ANDROID_SDK58_TOOLCHAIN_FIX_REPORT.md`

## Verified public upstream references

- Expo SDK 58 Android SDK compile version is 37: https://docs.expo.dev/versions/v58.0.0/
- Expo SDK 58 reference build image uses JDK 17 and NDK 27.1.12297006: https://docs.expo.dev/build-reference/infrastructure/
- React Native environment setup recommends JDK 17: https://reactnative.dev/docs/set-up-your-environment

## Remaining blockers

1. A **separate explicitly approved and unprivileged Android QA build machine**, with >=16 GiB free disk, >=6 GiB available RAM, >=2 GiB free swap and the validated JDK17/Android SDK platform37/Build Tools37/NDK27 toolchain. Both currently connected VPS machines have production services and cannot be enrolled.
2. An approved isolated HTTPS staging API matching the existing identity contract; no staging domain or persistent staging service is confirmed.
3. Manual workflow activation and debug-build authorization in GitHub on an exact reviewed feature-branch commit, followed by checksum, APK signature and device QA.
4. An authorized macOS/Xcode setup for a native iOS development build.
5. Real KoraPay sandbox tests and production payment activation remain separate, explicit approval gates; native checkout is still disabled.

No production application, customer data, payments, inventory, wallets or migrations were changed.
