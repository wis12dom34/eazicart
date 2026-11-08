# EaziCart Native — Phase 15 App Foreground Refresh and Account Cache Hygiene

Date: 2026-11-08. Development branch only; no deployment.

## Baseline
Phase 14 commit `1efcd2bb2987893718dd6d78de0d4f96378f401d`.

## Changes
- Register React Native AppState focus events with TanStack Query's focus manager on Android and iOS, so stale active queries can refetch after the app returns to the foreground. Background and inactive states are not treated as focused. Web is unaffected.
- Cancel pending cached queries and clear query/mutation caches during sign-out, when a restored session is loaded, on a rejected session, and when a different account signs in.
- Set the access token to null immediately on sign-out before clearing local SecureStore credentials and attempting best-effort remote logout.
- Add focused tests for native foreground/background state and removal of notifications, conversations and moderation access cached under a previous account.

## Verification
- Native unit/API tests: **83/83 passed**.
- Native TypeScript: **passed**.
- Native ESLint: **passed**.
- Android Hermes JS export: **passed** using non-resolving synthetic API host `https://fixture.invalid/api`.
- iOS Hermes JS export: **passed** using the same synthetic host.
- Prettier and git diff whitespace validation: **passed**.

## Remaining
- Native Android debug APK and iOS development IPA have **not** been built or installed; no emulator/physical-device testing.
- Real-device validation of app background/resume, auth changes and offline sign-out is still required, using isolated synthetic staging credentials.
- The prepared manual Android build workflow requires a dedicated isolated runner and explicit authorization; it was not dispatched.
- No production API, database, website, customer, or payment changes.
