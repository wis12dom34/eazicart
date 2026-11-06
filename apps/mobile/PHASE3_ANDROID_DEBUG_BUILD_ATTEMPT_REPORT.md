# EaziCart Native — Android Local Debug Build Attempt and Safety Preflight

Date: 2026-11-06
Status: **Partially complete — full debug APK NOT generated. No deployment, signing, or publication.**

## Work performed

1. Confirmed EaziCart's isolated native Android prebuild and the existing `com.eazicart.mobile.dev` application ID.
2. Installed Temurin OpenJDK 21, Android command-line tools, and SDK components into **`/opt/eazicart/android-qa-toolchain-20261106`**, separate from system packages, production website and server processes. Gradle provisioned the exact versions specified by Expo / React Native: Gradle 9.4.1, Android API 37, Android Build Tools 37, and NDK 27.1.12297006.
3. Initiated `:app:assembleDebug` in the isolated worktree `/opt/eazicart/mobile-native-android-audit-qa-20261106`, using the QA-only Gradle cache and a local `android/local.properties`.
4. Native build progressed through Expo plugin configuration, React Native code generation and Kotlin/Java compilation (including Reanimated and Expo modules). However, the shared 8 GiB VPS exhausted its 2 GiB swap while Gradle and Kotlin compiler daemons consumed memory. **The build was deliberately stopped before completion** to protect the production services.
5. Stopped only processes verified to belong to the QA Java/Gradle toolchain. Both `eazicart-web.service` and `eazicart-api.service` remained **active**. Removed only the ~4.5 GiB temporary QA Gradle cache, restoring ~9.2 GiB free disk space. JDK/SDK remain in the QA path for later use. No APK exists, and no emulator or device test was run.
6. Added `apps/mobile/scripts/android-debug-qa.sh`: a reviewed, opt-in debug-APK helper for a better-provisioned isolated machine. It requires a development branch, explicit execution flag, Java/SDK paths, isolated Gradle cache, Android prebuild, >=16 GiB free disk, >=6 GiB currently available RAM, >=2 GiB free swap, and exact SDK components. Uses only one Gradle worker, in-process Kotlin, ARM64 ABI, and debug assemble (not release signing / distribution).

## Tests performed

- `bash -n apps/mobile/scripts/android-debug-qa.sh`: **passed**.
- Guard without native prebuild: **refused** (exit 23), as intended.
- Guard after successful native prebuild: **refused** (exit 23) because the VPS has insufficient free disk/swap for a safe retry. **This guard prevented another memory-intensive build.**
- Android Expo native prebuild: **passed**, in both original QA worktree and new staging worktree.
- Prior milestone: 50/50 mobile regression tests, TypeScript, ESLint, formatting, and Android Hermes JS export passed. No mobile application source was changed in this milestone.
- Production web/API systemd services **active** after stopping the build.
- Device and APK smoke tests: **NOT PERFORMED**, because compilation did not complete and no connected emulator/physical Android device exists.

## Operational boundaries

- The first attempt reached native compilation but did **not** complete. Do not describe this as a successful APK build.
- SDK/toolchain files exist only in the isolated `/opt/eazicart/android-qa-toolchain-20261106` directory. Generated Android native files and debug intermediates are ignored by Git.
- No production EaziCart website, API, database, migration, wallet, inventory, payment route, KoraPay credential, account, deployment, TestFlight, Play Store release, or device installation was changed.
- No production checkout activation.

## Next safe step

Use an isolated Android CI/build runner or development workstation with **at least 16 GiB free disk, 6 GiB available RAM, and 2 GiB free swap**, configure Java 21 and Android SDK 37 / NDK 27, generate Android native files with Expo prebuild, run the guarded debug build script, and verify the resulting APK on a separate emulator/device. Cloud builds would upload project sources to a third party and should require separate authorization.

The VPS should not be used for a second intensive native build without materially expanding safe resources.
