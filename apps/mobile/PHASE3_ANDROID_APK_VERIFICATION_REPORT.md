# EaziCart Native — Android Debug APK Verification Gate

Date: 2026-11-06
Status: **Review-only development code. No APK created, no device test, no deployment.**

## Implementation
- Added `apps/mobile/scripts/android-apk-verify.sh`, a standalone, read-only inspector for an already-built local APK. It requires explicit SDK and JDK paths, a ZIP archive containing AndroidManifest.xml and DEX classes, valid zip alignment, Android APK signature verification, the standard Android Debug certificate, and the expected `com.eazicart.mobile.dev` package ID. It displays the SHA-256 digest and byte count. It does not upload, install, release-sign or publish.
- Updated `apps/mobile/scripts/android-debug-qa.sh` so successful `:app:assembleDebug` must also produce `app-debug.apk` and pass inspection. If output is missing or APK verification fails, the QA build exits with an error rather than claiming success.
- Existing development-branch, explicit opt-in, isolated Gradle cache, SDK version and memory/disk/swap guards are unchanged. No CI workflow or cloud build was triggered.

## Verified
- Shell syntax validation of both scripts passed.
- Missing APK correctly refused with exit 23.
- Synthetic malformed ZIP masquerading as APK rejected during alignment verification (exit 1).
- Production EaziCart web and API services active; QA machine remains below safe resource thresholds for another full Gradle build.
- Previous milestone: 50/50 mobile tests, Android prebuild and Hermes export passed. These are prior results, not new device validation.

## Unverified / next
- No real debug APK exists following the prior resource-protected termination, so APK signature, package and checksum checks cannot yet be validated on an actual EaziCart APK.
- Do not retry native build on the shared 8 GiB production VPS. Use a separate, adequately provisioned build machine with Android SDK 37, NDK 27, Java 21, at least 16 GiB free disk, 6 GiB available RAM and 2 GiB free swap.
- After a verified APK exists, install on an authorized emulator or physical Android device for UI, accessibility, lifecycle, offline recovery and share-sheet checks.
- Production checkout and payments remain disabled in the native candidate; no production data, website, API or database changes are authorized.
