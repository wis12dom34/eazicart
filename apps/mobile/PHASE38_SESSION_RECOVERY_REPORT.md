# EaziCart Native — Phase 38 Session Recovery and Stale UI Protection

Date: November 13, 2026. Based on Phase 37 commit `5fb03ba9a167419fc49db96a681381da0b881736`.

## Scope
Review-only React Native authentication/session recovery improvements, preserving existing Expo SecureStore, auth endpoints, and the SessionWriteGate epoch-based token controls.

## Identified issues
- Repeated `retrySession` calls for the same auth epoch could issue overlapping refresh-token reads and `/auth/session` requests.
- The startup restoration `finally` always called `setLoading(false)`, even when the request completed after logout or another sign-in invalidated the epoch.
- The expired-refresh-token (HTTP 401) cleanup invalidated the epoch and awaited asynchronous SecureStore/cache cleanup, then updated user state without verifying that another sign-in had not taken over in the meantime.
- Logout and explicit successful authentication did not explicitly settle the restored-session loading UI when an older recovery became stale.

## Implementation
- Added a dependency-free `createSessionRestoreCoordinator` to coalesce concurrent restoration calls for the same epoch, skip obsolete attempts and emit loading-completed events only while the epoch is current.
- Updated the AuthProvider retry flow to use the coordinator and continue honoring all SessionWriteGate checks before applying restored account state.
- On a verified HTTP 401, invalidate and clear stored refresh credentials, capture the new cleanup epoch, and only clear the account cache/user UI when that cleanup epoch remains current. Settle loading for that verified expired-token cleanup.
- On transient errors, preserve the refresh token for a later retry rather than treating offline connectivity as proven invalid credentials.
- Explicit logout and successful sign-in settle loading, so invalidated recovery attempts cannot leave the app stuck in a spinner.
- The existing in-flight refresh coalescing, bearer-token generation protection, secure storage behavior, query cache cleanup and production API contracts are preserved. No password-reset/recovery endpoints were invented.

## Verified checks
- Five new session recovery coordinator tests: 5/5 passed (same-epoch coalescing, logout race, newer sign-in race, error/retry and stale epoch prevention).
- Focused session recovery + write-gate/cache tests: 13/13 passed.
- Full native application test suite: 163/163 passed (158 Phase37 baseline + 5 new).
- Native build-safety script suite: 64/64 passed.
- Native TypeScript and ESLint: passed.
- Prettier and `git diff --check`: passed.
- Fresh offline Android Expo JavaScript/Hermes export and asset verification: passed.
- Fresh offline iOS Expo JavaScript/Hermes export and asset verification: passed.
- Used only synthetic `https://fixture.invalid/api` for builds; no real accounts or backend endpoints were accessed.

## Limitations / next milestone
- The new tests exercise the coordinator and existing session primitives; live provider integration has been statically typechecked and bundled, not exercised on a physical device.
- A JavaScript/Hermes export is not an installable APK or IPA. Approved isolated Android/JDK and Apple Silicon Xcode runners and disposable staging backend are still needed for actual binaries, sign-in/out lifecycle testing and device QA.
- All work occurred in an isolated review checkout. No merge, production deployment, account/credential changes, real HTTP login, customer data, wallet/payment transactions, database modification or App Store/Play Store publication occurred.
