# EaziCart Native — Session Lifecycle / Logout Race Safety

Date: 2026-11-07
Status: **Isolated review branch only. No deployment, APK, iOS build, production migration, payment activation, or store submission.**

## Provenance

- Previous verified checkpoint: `a30b8203e5c8665e02fc58650ea6ab01860a2c43`.
- Review branch: `feat/eazicart-mobile-session-lifecycle-20261107`.
- Scope is confined to native authentication session persistence and unit tests. No live backend endpoints or database code changed.

## Bug and fix

The existing native `AuthProvider` could accept delayed login/session refresh results after logout and restore refresh and access tokens. A SecureStore write already running during logout could also complete out of order.

- `src/lib/session-persistence.ts` introduces a generation guard and serialized SecureStore read/write/delete queue.
- Logout invalidates prior authentication work synchronously, clears the in-memory access token, and removes the persisted refresh token after any already-started storage write.
- A failed SecureStore read during logout no longer prevents attempting token deletion; logout may lack a remote token to revoke in that case.
- A stale 401 cannot erase a later new session.
- `src/providers/auth.tsx` uses the guard for login, registration, session restoration, automatic token renewal and logout.
- `tests/session-persistence.test.ts` includes nine deterministic cases, including races, outdated responses and storage read/write errors.

## Verified validations

- The portable session helper compiled under isolated TypeScript strict checking (`tsc --target es2022 --module commonjs --strict`).
- **9/9** isolated Node tests of the session persistence helper passed, using test storage and controlled deferred writes.
- GitHub commit readback and compare confirmed this work is confined to the native session helper, provider and tests, plus this report.
- **Not yet run:** the full mobile monorepo TypeScript/lint/test pipeline, Expo native build, Android emulator/device tests, macOS/iOS tests or staging API integration. These depend on an isolated development environment with dependencies and suitable QA services.

## Remaining work / gates

1. Run complete native regressions using the correct lockfile and dependencies, including AuthProvider integration behavior under concurrent login/logout.
2. Continue isolation checks before first Android debug build; approved dedicated Android runner and disposable HTTPS staging API are still missing.
3. No workflow dispatch, provisioning/activation, deployment, app-store publication, customer migration, or live payment changes without separate explicit authorization.

No production customer, seller, payment, order, wallet or inventory data were changed.
