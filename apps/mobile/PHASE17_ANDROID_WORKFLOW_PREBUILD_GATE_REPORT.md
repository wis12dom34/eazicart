# EaziCart Native — Phase 17 Android Build Preflight Integration

Date: 2026-11-08. Baseline Phase 16 commit `f6707b236b13941ae43419d6dd6a527bfdbf862a`.

## Changes
- Extended the existing read-only native project verifier to support `all`, `android`, and `ios` modes.
- Android-only verification does not require an iOS Xcode project on a Linux runner; iOS-only verification does not require Android Gradle files.
- Added three regression tests for platform-specific verification and fail-closed unknown platform selection.
- Wired Android project identifier and deep-link verification into the existing manual Android debug workflow **after** Expo prebuild and **before** any Gradle APK assembly.
- Preserved all existing staging API, attestation, runner isolation, SHA-pinning, manual-dispatch, and debug APK verification gates.

## Verification
- Expo Android-only prebuild completed successfully in a disposable checkout using the synthetic non-resolving API `https://fixture.invalid/api`.
- Android-only project verifier and all 8 verifier tests passed. The pnpm argument separator (`-- android`) was explicitly tested and handled.
- Native client TypeScript, lint and 83 existing tests passed.
- No actual APK, iOS IPA, device installation, production deployment, live API, database, or payment changes.

## Remaining
A dedicated isolated Android QA runner with required SDK and approved staging backend must be provisioned before the manual workflow can be dispatched. Both connected VPS machines are production hosts and fail the safety requirements. No automatic workflow trigger or artifact distribution was enabled.
