# EaziCart Native — Phase 18 Concurrent Session Safety

Date: 2026-11-08. Baseline Phase 17 commit `45423321002643d9a429bc1e941da43747bd2623`.

## Issue found
The previous native auth provider allowed a pending `/auth/session` response to persist refresh/access tokens after sign-out or after switching accounts. A pending initial restore or sign-in could also update the visible user after the session changed.

## Changes
- Added a small pure session-write gate that invalidates stale auth operations synchronously and serializes SecureStore token writes/deletions.
- Sign-out immediately invalidates outstanding session refreshes and cancels cached private reads; cleanup is serialized behind any in-flight SecureStore write.
- Initial session restore, background token refresh, and sign-in now check their captured session epoch before updating credentials or visible user state.
- Invalid refresh tokens revoke the visible session and cached account data, instead of leaving a stale signed-in UI.
- Added tests covering active writes, stale queued writes, sign-out/new sign-in ordering, epoch checks, and storage failures.

## Safety
- No backend API changes, database migrations, payment changes, deployment or native store publication.
- No real credentials, users, or production endpoints used in tests.
- Android and iOS physical-device verification remains outstanding.

## Local verification
- Native tests: 88/88 passed (including five new session-write-gate tests).
- TypeScript typecheck: passed.
- ESLint: passed.
- Prettier and whitespace check: passed.
- Build/physical-device verification: not performed in this phase.
