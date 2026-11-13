# EaziCart Native — Phase 26 iOS Simulator QA Runner Preparation

Date: November 13, 2026. Phase 25 baseline commit `703b5e4809a3eb4dc877a344d27ae87ca09a2e75`.

## Objective
Prepare a safe, review-only iOS simulator QA compilation route, without starting a build or deploying/publishing the native app.

## Environment inspection
- Two connected VPS hosts are Linux production workloads and are unsuitable for native Android or Apple device builds.
- Their free disk headroom was below the existing minimum isolated Android build requirement; no Android Gradle compilation was attempted.
- Connected MacBook was offline; no available approved Apple Silicon macOS QA runner was verified.
- Official Expo SDK 58 compatibility reference lists Xcode 26.4 or later and iOS 16.4+:
  https://docs.expo.dev/versions/v58.0.0/

## Implementation
- Added `apps/mobile/scripts/ios-runner-readiness.mjs`: read-only fail-closed checks for Apple Silicon macOS, non-root account, explicit operator authorization, exclusion of production source/workloads, >=20 GiB free disk, >=6 GiB free RAM, Xcode 26.4+, iOS Simulator tools, and GitHub Actions review-branch/maintainer-approved exact SHA.
- Added seven automated tests for positive/negative runner fixtures and static checks of the prepared workflow.
- Added review-only `.github/workflows/ios-simulator-manual.yml` with manual dispatch only, unprivileged dedicated runner label `eazicart-ios-qa`, explicit operator confirmation, read-only repository permissions, pinned commit and staging-host conditions, native EAS development profile/API allowlist checks, disposable staging attestation, locked dependencies, native TypeScript/lint/tests, Expo iOS prebuild and generated-identity verification.
- The prepared workflow would run an **unsigned generic iOS Simulator** Xcode build with `CODE_SIGNING_ALLOWED=NO` and no package export, signing credentials, artifact upload or store distribution. It has not been dispatched or merged to the default branch.
- Added read-only `verify:ios-runner` and `test:ios-runner` package scripts and QA setup documentation.

## Verification (synthetic / read-only only)
- New iOS runner tests: 7/7 passed.
- Combined native script tests: 52/52 passed.
- Full native client tests: 103/103 passed.
- TypeScript and ESLint: passed.
- Prettier and git diff whitespace checks: passed.
- Running the iOS runner inspector on the connected Linux production host correctly refused the environment (exit code 23).
- No simulator compile, signed device build, APK, IPA, artifact upload, EAS build request, CI dispatch, Apple signing, App Store submission or production deployment occurred.

## Remaining blockers
- Authorize and provision a dedicated Mac running Xcode >=26.4 with a protected trusted-runner group and approved exact reviewed SHA.
- Deploy an isolated disposable synthetic staging API and configure trusted repository Actions variables without production credentials.
- Obtain separate explicit approval before merging or dispatching the manual workflow and before development-device signing / physical-device QA.
- Actual Android debug APK requires its own separately approved isolated SDK/JDK runner and backend attestation.
