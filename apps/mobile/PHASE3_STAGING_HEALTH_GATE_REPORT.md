# EaziCart Native — Isolated Staging Identity and Android CI Gate

Date: 2026-11-06
Status: **Review-only development branch. No deployment, CI dispatch, payment activation, signing, or device installation.**

## Purpose

Prevent an Android QA APK from accidentally connecting to EaziCart production or an unverified server. Two online connected VPS machines remain unsuitable for a dedicated build runner: the EaziCart VPS operates production services, and the second VPS lacks Android toolchain and has insufficient available RAM. No APK was built.

## Implemented

1. A **disposable-only** `GET /preview/staging/identity` endpoint in `apps/api/src/modules/payments/isolated-kora-staging.ts`. It is registered **after** the existing environment flags and temporary PostgreSQL data-directory checks, and is not imported by production `app.ts`/`server.ts`.
2. The response has a strict schema: `service=eazicart-native-staging`, `environment=disposable-fixture`, `contractVersion=1`, `nativeCheckoutEnabled=false`, `paymentMode=synthetic-only`, `databaseMode=temporary-postgresql`. Headers explicitly identify the disposable fixture mode and forbid caching; no customer data or credentials appear.
3. A **GET-only, no-credentials** `android-qa-staging-handshake.mjs` security preflight. It reuses the approved exact-host/HTTPS configuration check, refuses production and suspicious URLs before network activity, disallows redirects, bounds response size, and validates server headers and all required contract fields. If the endpoint is absent, misconfigured, unreachable, enables checkout, reports a non-synthetic payment provider, or returns anything other than a matching identity, it refuses to proceed.
4. Updated the existing **manually dispatched** `.github/workflows/android-debug-manual.yml` to run identity unit tests and the actual network handshake **before installing dependencies, generating native files, or assembling the APK**. No GitHub Actions workflow was dispatched or activated.
5. Added a disposable PostgreSQL integration test for the route, including confirming GET-only behavior and zero payments/orders/notifications/provider calls. Added six Node.js security unit tests for the new handshake.

## Verified tests

- **39/39** PostgreSQL integration tests passed in `pg_virtualenv` (12 order-idempotency + 27 staging KoraPay/reconciliation/identity); the fixture cluster was destroyed automatically.
- **50/50** existing mobile regression tests passed.
- **17/17** Android readiness/configuration/identity security tests passed; manual-branch authorization shell test passed.
- API and database TypeScript, native mobile TypeScript, scoped API ESLint, mobile ESLint, Prettier formatting checks passed.
- Isolated route remains unregistered by the running EaziCart API.
- No staging HTTPS domain was provided or verified over a live network; client-side handshake's acceptance/refusal behavior was tested with mock responses, and the server response with Fastify's in-process injection.
- Android/iOS JS bundle exports passed in earlier milestones; no new native APK/IPA or physical-device test is claimed here.

## Before attempting a real Android build

- Provision a **separate, unprivileged Android build host** with at least 16 GiB free disk, 6 GiB available RAM, 2 GiB free swap, Node 22.13+, JDK 21 (the existing reviewed runner policy), Android API 37.0, Build Tools 37.0.0 and NDK 27.1.12297006.
- Set up an **approved isolated HTTPS staging API** with no production DB, accounts, wallet, KoraPay live keys or payment activation. For any future persistent staging deployment, review and explicitly authorize an appropriate environment-identity implementation; today's route is **disposable-test-only** and cannot be turned on in a persistent server by toggling a flag.
- Authorize maintainer-managed `EAZICART_ANDROID_QA_ALLOWED_API_HOST` and exact `EAZICART_ANDROID_QA_APPROVED_SHA`; preserve the manual-only feature-branch workflow.
- Test the HTTPS handshake against the approved staging server, then perform a dedicated Android debug build, verify checksum/package/signature, and test on an emulator/device. iOS needs an authorized macOS/Xcode development environment.
- Obtain separate approval before activating any CI runner, remote staging deployment, or production payment route. Never run Gradle on the existing production EaziCart VPS.

## Code changed

- `apps/api/src/modules/payments/isolated-staging-identity.ts`
- `apps/api/src/modules/payments/isolated-kora-staging.ts`
- `apps/api/src/modules/payments/isolated-kora-staging.postgres.test.ts`
- `apps/mobile/scripts/android-qa-staging-handshake.mjs`
- `apps/mobile/scripts/android-qa-staging-handshake.test.mjs`
- `.github/workflows/android-debug-manual.yml`
- `apps/mobile/PHASE3_STAGING_HEALTH_GATE_REPORT.md` (this report)

No production API, website, database, wallet, inventory, payment record, or customer account was modified.
