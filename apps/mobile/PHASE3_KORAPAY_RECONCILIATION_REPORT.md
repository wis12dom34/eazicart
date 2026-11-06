# EaziCart Native — KoraPay Uncertain-Checkout Reconciliation (Review-Only)

Date: 2026-11-06

Status: **Developed and verified in isolated fixtures. Not deployed, merged, or activated.**

## Scope

This milestone extends the previously tested, unregistered KoraPay/idempotent-order staging candidate with an administrator-only reconciliation tool for payment initiation claims that remain `INITIATING` or `UNKNOWN`. It is strictly **read-only**, not a production payment reconciliation or settlement service.

## Features completed

- `apps/api/src/modules/payments/korapay-reconciliation-preview.ts`: isolated test-only, restricted GET endpoints:
  - `GET /preview/admin/korapay/reconciliation?state=UNKNOWN&limit=20`: list uncertain initiation claims (max 50) with payment reference, order/payment identifiers, state, timestamps, and local status; no customer PII or checkout URLs.
  - `GET /preview/admin/korapay/reconciliation/:paymentId/probe`: observe synthetic provider verification for the exact persisted KoraPay reference/NGN amount using a **GET-only provider fetcher**.
- Both routes require authenticated account ID and a fresh `User.role === ADMIN` lookup in PostgreSQL on each request. Neither buyer authentication nor a spoofed role header grants access.
- The reconciliation registration checks `NODE_ENV=test`, fixture flags, nonstandard PostgreSQL port, and the actual disposable `/tmp/pg_virtualenv.*` data directory. It is only called from the already-unregistered `registerIsolatedKoraStaging` harness.
- `safeReadOnlyFetcher` rejects non-GET methods, request bodies, non-Kora domains, unexpected paths, query strings, or fragments before invoking the injected synthetic provider.
- Provider `VERIFIED`, `NOT_PAID`, and `UNVERIFIED` responses are **observations only** and always require manual review. No automatic settlement, payment status transition, order state change, stock decrement, notification, checkout URL rewrite, or re-initialization is performed.
- Inconsistent local references, unsupported currency, non-pending payments and non-uncertain claims fail closed before a provider request.
- Existing native checkout remains disabled; live order, legacy Paystack route, database, and web app unchanged.

## Verified test results

- **33/33 disposable PostgreSQL tests passed**, comprising 12 idempotent-order and 21 KoraPay staging/reconciliation tests.
- The 4 new integration tests verify admin-only list, role revocation, pagination limits, PII exclusion, rejected non-GET action, safe read-only provider verification, unchanged financial/inventory/order rows even on provider `VERIFIED`, local identity/currency/status failures, pending/underpaid/provider unavailable responses.
- **35/35 mobile regression tests passed** (no native app source changes in this milestone).
- API and database TypeScript checks, scoped ESLint, Prisma schema validation and Prettier checks passed.
- Direct test runner invocation without a verified disposable PostgreSQL cluster was refused (expected exit code 23).
- Exact two existing additive migrations executed **only inside temporary PostgreSQL** and the test cluster was dropped afterward.
- No live KoraPay request or customer financial operation was performed.

## Files added/modified

1. `apps/api/src/modules/payments/korapay-reconciliation-preview.ts` — new.
2. `apps/api/src/modules/payments/isolated-kora-staging.ts` — registers the guarded reconciliation service only within disposable fixture harness.
3. `apps/api/src/modules/payments/isolated-kora-staging.postgres.test.ts` — four reconciliation security/immutability tests.
4. `apps/mobile/PHASE3_KORAPAY_RECONCILIATION_REPORT.md` — this report.

## Known blockers and release gates

- **This is not operational production reconciliation.** Actual KoraPay sandbox/live provider request and signature contracts remain unverified. No provider credentials are configured here, and the only provider is a synthetic fetcher.
- A provider observation of `VERIFIED` is not a settlement authorization or proof of funds delivered to EaziCart; require independent provider confirmation, existing transaction safeguards and authorized operator approval before any real status repair.
- An authorized, audited manual reconciliation decision workflow, pagination and rate limiting, and real-provider support must be designed/reviewed before wider staging.
- Production order-idempotency and KoraPay-initiation migrations are not applied. Live `POST /orders`, `/payments/initialize`, and native payment button remain unchanged.
- Device-level checkout testing, security review, official sandbox credentials and explicit migration/deployment approvals remain outstanding.

## Recommended next milestone

Create a **read-only operator audit export and an explicit manual reconciliation decision checklist** with no settlement endpoint. Validate up-to-date official KoraPay sandbox/verification documentation in a nonproduction environment before introducing any staff-controlled action.
