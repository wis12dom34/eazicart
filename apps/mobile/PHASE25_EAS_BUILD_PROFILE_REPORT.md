# EaziCart Native — Phase 25 EAS Build Profile Safety

Date: November 13, 2026. Phase 24 baseline commit `972286e06af09337a297eb82bfd95d0ae70a72d7`.

## Goal
Prepare normal EAS native-development builds without creating or distributing binaries and prevent an accidental store/production build while the app is still undergoing QA.

## Findings
The existing EAS development and staging profiles were internal, but neither specified an explicit EAS environment. Expo normally defaults an unspecified build environment to production, potentially loading unexpected environment variables. The repository also defined a production EAS profile although development Android and iOS bundle identifiers are still `com.eazicart.mobile.dev`.

## Changes
- Set the EAS development profile environment to `development` and staging to `preview`. Existing internal distribution and channels are preserved.
- Add a zero-dependency fail-closed native build validator that requires: explicitly named development/staging profile; expected iOS/Android development package IDs and scheme; internal distribution and matching channel; development client for development; dedicated environment; exact, authorized HTTPS staging API hostname; disabled admin preview; no public secrets; and explicit QA-build approval.
- Explicitly refuse production/store builds in this development branch regardless of configured store profile. Do not treat this as a replacement for production release approval.
- Hook the guard to the documented EAS `eas-build-pre-install` lifecycle script to run on standard EAS Android/iOS builds before dependency installation.
- Add an invocation of the validator and its unit tests to the prepared, manually dispatched Android QA debug workflow. The workflow remains review-only, not merged or dispatched.
- Document the QA environment prerequisites and limitations in the mobile README.

## Validation
- All 10 new build-profile tests passed. Before configuring EAS environments and the lifecycle hook, two tests failed as expected.
- Existing and new native script suite: 45/45 passed.
- Full mobile native client suite: 103/103 passed.
- Mobile TypeScript and ESLint: passed.
- Prettier and `git diff --check`: passed.
- Direct execution of actual package pre-install hooks with synthetic QA URL:
  - Development: passed.
  - Staging: passed.
  - Production: refused with exit code 23.
- Android manual branch authorization guard: passed.
- Synthetic offline APK verification: 10/10 passed; this does not represent an actual APK.

## Safety limits
- No EAS build request, CI dispatch, Gradle APK, Xcode IPA, signing, store submission, database, production API, payment transaction, or deployment.
- The tests used `https://qa.internal.example.test/api` as a synthetic hostname; a real build requires a separately approved, disposable backend, verified attestation and safe test data.
- This gate runs in the normal EAS npm build lifecycle and the prepared manual Android workflow. Custom build processes that do not run these hooks must call the guard themselves.
- Existing online VPS machines run production workloads and are not authorized native build runners. The connected Mac was offline at inspection.
- Actual release identifiers, signing credentials, dedicated runner provisioning, real Android/iOS builds, and physical-device smoke tests remain pending.
