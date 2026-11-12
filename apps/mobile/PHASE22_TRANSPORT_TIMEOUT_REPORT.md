# EaziCart Native — Phase 22 Transport Timeout and Response Validation

Date: November 12, 2026. Baseline Phase 21 commit `f470ddb03deb2713476692355f8353119a9894a0`.

## Bugs reproduced
- Timeout triggered after response headers while a successful JSON response was still streaming: raw parsing/abort error instead of user-friendly `TIMEOUT`.
- Timeout while reading an HTTP 503 error body: upstream server status was returned instead of `TIMEOUT`.
- Malformed JSON on HTTP 200: raw parsing error rather than a stable `INVALID_RESPONSE` error.

## Changes
- Centralize interruption checks within the request lifecycle. Session changes override old responses, explicit caller cancellations use `AbortError`, and 15-second request timeouts use `ApiError(408, "TIMEOUT")`.
- Apply interruption checks before fetch, after fetch, during non-OK response parsing, after 401 token refresh, and after success response parsing.
- Return a stable `ApiError(502, "INVALID_RESPONSE")` for a successful HTTP response that cannot be parsed as JSON.
- Preserve the original HTTP status for an ordinary non-JSON server error that was not cancelled or timed out.
- Add six focused regressions for slow success body timeout, slow 503 body timeout, malformed 200 JSON, non-JSON server error, timeout during refresh without request replay, and account switching while private JSON was still streaming.

## Verification executed
- Prior to fix, three new tests failed for the reproduced timeout/response format bugs.
- Updated API tests: 18/18 passed.
- Other available native client tests, excluding uninstalled React Query cache test: 100/100 passed.
- Native script tests: 31/31 passed.
- Android branch authorization gate: passed.
- Synthetic offline APK verifier: 10/10 passed (no real APK).
- Prettier checks and `git diff --check`: passed.

## Remaining QA limitations
- The isolated checkout does not have `@tanstack/react-query`; `session-cache.test.ts` was excluded, not counted as passing.
- Full dependency-backed TypeScript, ESLint, real Expo prebuild, Android APK, iOS IPA, signing, emulator tests, and physical-device testing were not completed in this phase.
- Production VPS are not authorized as native build runners; dedicated isolated staging/build environment remains required.
- No real customer endpoints, KoraPay live payments, databases, user data, production deployments, or app-store publication were touched.
- Review-only development branch; merge/build dispatch requires separate approval.
