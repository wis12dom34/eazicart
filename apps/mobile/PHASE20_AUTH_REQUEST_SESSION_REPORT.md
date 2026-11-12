# EaziCart Native — Phase 20 Authenticated Request Session Isolation

Date: 2026-11-12. Based on Phase 19 commit `aa943ed1bf007e89f29e6f045b86150927744690`.

## Scope and risk
A previously started authenticated network call could complete after logout or user switching, returning stale private data to a caller. An old HTTP 401 could also trigger a refresh and retry after account switching. An optional anonymous request could refresh a newly signed-in account after an anonymous HTTP 401.

## Changes
- Track the current authenticated session generation independently of bearer token rotation.
- Reject responses from authenticated requests if logout, sign-in or account replacement changed the session while the response was pending.
- Check generation both immediately after fetch and after parsing a successful or failed JSON response.
- Block HTTP 401 refresh and replay if the originating session is no longer current, including if it changes while refresh is pending.
- Permit a legitimate refresh-token renewal to update the access token without invalidating requests from that same session.
- Avoid invoking the refresh handler for anonymous optional requests that carried no bearer token.
- Add five focused regression tests covering late responses, account changes, paused refresh, anonymous 401, and direct token replacement.

## Validation actually run
- Existing API test baseline: 5/5 passed.
- Updated API tests: 10/10 passed.
- Native client test suite using a cached TSX runner, synthetic `https://fixture.invalid/api` configuration: 92 tests passed; one test file (`session-cache.test.ts`) failed to load because `@tanstack/react-query` was not installed in the disposable checkout. This is an incomplete environment run, not 93/93 passing.
- Prettier check (3 changed files): passed.
- `git diff --check`: passed.
- No live API calls, installations, builds or device tests.

## Safety and next steps
- Only the isolated GitHub development branch is updated; no production source, deployment, wallets, KoraPay configuration, databases, migrations, user sessions, or App Store / Play Store publication changed.
- Restore locked development dependencies on an authorized isolated QA machine and rerun the full suite including React Query cache test, TypeScript and ESLint.
- Verify Expo Android/iOS generated files against the Phase 19 validator in a disposable, nonproduction build environment.
- After explicit approval and dedicated runner readiness, create development builds and perform real-device QA.
