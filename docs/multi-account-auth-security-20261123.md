# Multi-account authentication — implementation and security gates

Status: **implemented as a development candidate on this branch; not verified for production and not deployed by this review.**

## Current GitHub implementation (2026-11-23)
- Browser account routes implement device creation, account listing, password-verified addition, session restoration, switching, removal, and logout-all.
- Browser device secret is held in a Secure, HttpOnly, SameSite=Strict, host-only cookie and hashed in persistence.
- Browser-account access JWTs include device and generation claims, validated in the shared authenticate guard against the active account generation.
- The web Accounts sheet offers add, switch, remove, and logout-all, with reload and cross-tab account-change coordination.
- PostgreSQL schema/migrations, unit tests, mobile WebKit E2E specs, and a GitHub Actions workflow are committed.
- **Presence of tests and CI configuration is not proof that the latest commit passes.** Verify workflow results and disposable-database migration before release.

## Open security/release gates
1. Review compatibility of legacy bearer access tokens (no browser-device claims) and legacy refresh token handling. Confirm account isolation cannot be bypassed during migration.
2. Test login, add, switch, concurrent switch, stale token rejection, independent account revocation, logout-all, refresh replay, and cross-tab cache isolation.
3. Verify actual HTTPS web/API reverse-proxy topology, __Host- cookie host scope, Origin checks, and cross-origin credentials behavior.
4. Confirm rate limiting on account addition and switching; review CSRF, XSS, cookie clearing, and error paths.
5. Run disposable PostgreSQL migration and rollback rehearsal; run unit, integration, browser/WebKit and restart-persistence tests.
6. Provide isolated private HTTPS preview with test identities, disconnected from production payments/data.
7. Require explicit release approval after tests and preview. Do not infer production readiness from code presence.

## Previous VPS candidate
A separate candidate was previously reported at `/opt/eazicart/candidates/eazicart-multi-account-auth-20261123`. Its earlier tests are not a substitute for GitHub CI or a fresh release verification.
