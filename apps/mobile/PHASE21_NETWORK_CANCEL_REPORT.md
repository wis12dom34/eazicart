# EaziCart Native — Phase 21 Network Cancellation and Stale Failure Guards

Date: November 12, 2026. Baseline Phase 20 commit `5cb96f07e1896bdf5ea04b281580b1bcd4c86476`.

## Reproduced issues
- The mobile `request()` function removed the caller abort listener and 15-second timeout immediately after `fetch()` resolved. If response headers arrived but JSON was still streaming, navigation-away cancellation did not reach the body.
- A delayed fetch rejection after logout or account switching returned `NETWORK_ERROR` even though it belonged to an old authenticated session, hiding `SESSION_CHANGED`.

## Changes
- Keep the request's abort listener and timer active through response JSON processing and any 401 refresh/retry; always release both in the outer `finally`.
- Recheck the originating session generation in the network catch before translating a failure to a timeout or network error.
- Two new regression tests: simulated slow JSON stream aborted after headers; stale network failure after switching accounts.

## Verification actually run
- Before fix, both new API regressions failed, proving reproducible defects.
- After fix, mobile API tests: 12/12 passed.
- Native client tests excluding unavailable `session-cache.test.ts`: 94/94 passed.
- Native scripts test suite: 31/31 passed.
- Prettier (changed files): passed; `git diff --check`: passed.
- Simulated fixture endpoint only; no real API traffic.

## Remaining limitations
- `@tanstack/react-query` was unavailable in the disposable checkout; `session-cache.test.ts` remains unexecuted in this phase.
- Full dependency-backed TypeScript and ESLint checks, real Expo prebuild, Android/iOS binary builds, and physical-device validation are outstanding.
- This is a review branch. No production code update, mobile store release, database modification, customer data access, or payment activity was performed.

## Next development milestone
Restore locked dependencies in a dedicated, approved, nonproduction QA environment; run the complete native test suite and platform generation/build preflight before attempting signed development builds.
