# EaziCart Native — Disposable Staging Finance Authentication

Date: 2026-11-06
Status: **Isolated review candidate. Not deployed, merged, published, or attached to a live staging service.**

## Problem addressed

The previously tested native-audit HTTP loopback fixture accepted bare fake user IDs as bearer values. That was adequate for authorization-route checks but did not prove that a real request must carry a signed, short-lived credential. A dedicated staging server will ultimately need its own authenticated identity lifecycle without accepting production EaziCart buyer/seller sessions.

## Implemented

- Added `apps/api/src/test-support/staging-audit-auth.ts`, an **in-memory, per-process fixture-only** bearer authenticator using random 256-bit signing material, HMAC-SHA256, a constant-time signature comparison, fixed audience and version, server-selected subject, nonce, issued-at timestamp and short expiry (1–300 seconds, 120-second default).
- Secret material and issued tokens are never stored in source, disk, logs or public Expo variables. A new server instance cannot validate old tokens.
- Authentication refuses missing, malformed, tampered, expired, cross-instance or incorrectly scoped tokens. The module refuses initialization/verification unless `NODE_ENV=test` and the disposable PostgreSQL/KoraPay fixture flags are enabled.
- Converted the existing real-HTTP native audit integration test to issue signed disposable admin and buyer tokens rather than raw principal IDs. The route still independently checks `User.role === ADMIN` on every request.
- Added negative loopback checks: unrelated signer (401), expired token (401), unrecognized token (401), signed ordinary-buyer token (403) and previously valid admin token after role revocation (403).
- The loopback listener is restricted to `127.0.0.1`. It registers only GET-only reconciliation endpoints and closes after testing; no order, payment, settlement, or webhook mutation endpoints are exposed.
- Production app startup, existing customer authentication, native checkout, production payments, wallets and data are unchanged.

## Verification

- **4/4 standalone Vitest authentication tests passed**: fail-closed environment, signature isolation/tamper/expiry, issue-time limits and protected bearer route.
- **38/38 disposable PostgreSQL integration tests passed**: 12 order-idempotency and 26 synthetic KoraPay staging cases, including the amended native-client real HTTP loopback checks. The temporary PostgreSQL cluster was destroyed afterward.
- **50/50 mobile API and security regression tests passed**.
- **11/11 Android QA runner/readiness and isolated API preflight tests passed**.
- Scoped API ESLint and TypeScript passed; schema validation passed.
- No live KoraPay API call was made, no real payment was initiated and no production database connection was used.

## Limitations and next work

- **This is a test-support authenticator, not production-ready customer or administrator login.** It has no user provisioning, credential exchange, revocation list or distributed signing-key lifecycle. It cannot be deployed by itself to a device-accessible staging service.
- Staging deployment and KoraPay sandbox credentials must be separately authorized. A secure staging identity provider, access logging, least-privilege network control, and an approved nonproduction hostname are necessary before enabling external network access.
- Existing Android debug APK has not been produced; production shared VPS build was previously stopped due to memory/swap exhaustion. A separately provisioned protected runner is required to produce a debug APK and run Android UI/accessibility, lifecycle, rotation and sharing tests.
- Actual iOS simulator and physical device testing remain outstanding. No native app has been published.
- Production order idempotency, KoraPay merchant integration, migrations and Pay button remain inactive.
