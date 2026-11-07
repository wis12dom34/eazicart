# EaziCart Native — In-Flight Cancellation and Auth Refresh Checkpoint

Date: 2026-11-07
Status: **Review branch only. No Android APK, staging deployment, iOS build, production change, or publication.**

## Exact baseline

- Parent commit: `45dc10d88af1f4f2bd2a2fb6916cee80003f787d`.
- Review branch: `feat/eazicart-mobile-cancel-inflight-20261107`.
- Current scope: network cancellation within `apps/mobile/src/lib/api.ts` and regression tests in `apps/mobile/tests/api.test.ts`.

## Code changes

1. In-flight caller cancellation now produces `ApiError(499, "REQUEST_CANCELLED")` rather than rethrowing an implementation-specific fetch/AbortError.
2. Once fetch has resolved, caller cancellation is checked before HTTP 401 token refresh or response parsing. A cancelled request must not cause needless token renewal or request replay.
3. Two focused regression tests cover abort during an active request and abort immediately after a 401 response, asserting no unintended refresh.
4. Existing timeout behavior remains `ApiError(408, "TIMEOUT")`; ordinary network failure remains `NETWORK_ERROR`. Existing pre-aborted and during-refresh cancellation guards remain in place.

## Validation evidence

- GitHub branch comparison verifies only the API client and its tests changed in the two functional commits.
- Read-back of the committed files verified the early cancellation, in-flight normalization, and no-refresh-after-cancellation checks.
- Locally mounted existing synthetic Android APK verifier regression suite: **10/10 passed**, shell syntax passed. This confirms offline APK verifier behavior only, not native API runtime behavior.
- **The two new API runtime tests, complete mobile suite, TypeScript/lint pipeline, real Android build, and physical/emulated device tests were not executed**. The isolated local environment lacks the monorepo and cannot reach GitHub to install missing dependencies.

## Still blocked

- Isolated Android runner with JDK 17, Android SDK platform 37, Build Tools 37, NDK 27, sufficient disk/RAM/swap.
- Dedicated approved HTTPS disposable staging API and maintainer host allowlist.
- Separate explicit approval before manual workflow dispatch, APK build, iOS signing, app-store submission, production migrations, production payment changes, or deployment.

No EaziCart production data, live services, payment, wallet, order or customer records were touched.
