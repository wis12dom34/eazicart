# EaziCart Native — Phase 19 Prebuild Integrity Hardening

Date: 2026-11-12. Based on Phase 18 commit `499999688ac8ad55f69575192e6690d7e9e58aa7`.

## Issue reproduced
The previous Android verifier checked for identifiers and deep links with plain `includes()`. A synthetic Android native project with commented-out correct identifiers and active wrong identifiers was incorrectly accepted by `verifyNativePrebuild(..., "android")`.

## Changes
- Ignore code comments and XML comments when verifying generated native output.
- Validate active Android Gradle `namespace` and `applicationId` declarations and reject conflicting definitions.
- Require Android's `eazicart` URL scheme inside an actual VIEW + BROWSABLE intent filter.
- Validate active iOS Xcode bundle identifier declarations, bundle identifier entry in Info.plist, and registered CFBundleURLSchemes.
- Reject missing or malformed Expo configuration without throwing.
- Add six focused regression tests.

## Verification
- Reproduced the prior false pass using a synthetic incorrect Android configuration.
- Native prebuild verifier tests: 14/14 passed (8 previous plus 6 new).
- Combined native script test suite: 31/31 passed.
- Manual Android branch gate: passed.
- Synthetic APK signing/package verifier: 10/10 cases passed.
- `git diff --check` and Node syntax check: passed.

## Limitations and safety
- Read-only checks and synthetic test inputs only.
- Full native client tests, lint, TypeScript, fresh Expo prebuild, APK/IPA assembly and physical-device QA were not rerun in this phase.
- Dedicated isolated Android QA runner and approved staging API still required; production VPS must not be used as a build runner.
- No production deployment, real API call, credentials, database, payments or store publication.
- This is a review-only branch; no merge or build dispatch without approval.

## Next
1. Validate against actual Expo SDK 58 generated Android/iOS projects on an isolated development machine.
2. Run full mobile test suite, lint and TypeScript with locked dependencies.
3. After approval, generate debug development builds and perform Android/iOS real-device QA.
