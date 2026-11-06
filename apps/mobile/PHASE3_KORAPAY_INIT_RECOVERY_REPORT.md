# EaziCart Native — Durable KoraPay Checkout Initialization

Date: 2026-11-06
Status: **Implemented and tested in isolated development only. NOT deployed, merged, or activated.**

## Problem addressed

The earlier disposable PostgreSQL checkout flow enforced one local Payment row/reference per order, but simultaneous requests could call KoraPay charge initialization more than once. A lost provider response could trigger another call even though the first might have reached KoraPay. Local request locking is insufficient across app restarts, devices and independent backend instances.

## Development changes

- New additive Prisma model `KoraCheckoutAttempt` keyed by `paymentId`, with a persistent immutable payment reference and states `INITIATING`, `READY`, or `UNKNOWN`. There is **no automatic lease expiration** or implicit re-initialization.
- New review-only migration: `packages/database/prisma/migrations/20261106001000_kora_checkout_initiation_claim/migration.sql`. Database check constraint limits valid states; FK prevents orphaned references. This SQL **has not been applied to production**.
- New `korapay-checkout-once-candidate.ts`: checks existing order ownership, NGN amount/provider/status through the guarded store; claims a payment ID in PostgreSQL **before** its first outbound KoraPay initialization; persists and validates the HTTPS checkout URL after a successful provider response.
- Duplicate calls seeing a `READY` claim reuse the same URL and return HTTP 200 without a second provider call. First successful initialization returns HTTP 201.
- Requests observing `INITIATING` or `UNKNOWN` return an explicit HTTP 503 `KORAPAY_INITIATION_UNCERTAIN` and **never initiate again automatically**. Provider failures, unsafe redirect URLs and ambiguous writes transition to `UNKNOWN`; a crashed process leaves `INITIATING`, also fail-closed.
- The unregistered staging preview `/preview/korapay/checkout` route now calls the durable initiation gate. Its signed webhook, provider verification and exactly-once settlement candidate behavior is preserved.
- The test runner continues to verify `pg_virtualenv`, database identity and disposable flags, applies the exact order-idempotency SQL migration plus the new initiation-claim SQL migration inside temporary PostgreSQL, then destroys the cluster.

## Verified results

- **29/29 real PostgreSQL integration tests passed**, comprising 12 order-idempotency tests and 17 staging KoraPay tests.
- Additional regressions cover duplicate provider initialization requests, persisted `READY` URL reuse, independent new Prisma client/session reuse, failed provider initialization, spoofed checkout URL rejection, and orphaned claims that never retry automatically.
- **35/35 existing mobile regression tests passed**.
- API and database TypeScript checks, scoped ESLint, and Prisma schema validation passed.
- Direct test-runner execution without a verified `pg_virtualenv` failed closed (expected exit code 23).
- No application startup registration in `apps/api/src/app.ts` or `apps/api/src/server.ts`.
- No calls to actual KoraPay sandbox/live APIs; external provider behavior is simulated with a dependency-injected fixture fetcher.
- No real orders, customer funds, payment records, wallets, or inventory changed.

## Limitation and security constraints

- **The new mechanism is deliberately at-most-once, not automatic recovery.** An `INITIATING` or `UNKNOWN` claim requires provider-side reference reconciliation by authorized staff. Repeating an initialization for an ambiguous reference would be unsafe unless KoraPay's official documented idempotency guarantee is confirmed.
- Before any staging/live credential use, validate the exact current KoraPay API schema, official webhook signature format, amount units, provider-side idempotency/reconciliation behavior, and approved callback domains.
- Neither the existing production `POST /orders` nor the live Paystack-based `/payments/initialize` route was modified.
- Native `Place order / Pay` remains disabled, so the app cannot charge anyone through this candidate.
- Production would require separate approvals for additive migration, idempotent order route, KoraPay initialization, webhook and verification routes, audited settlement handling, staging credentials and device acceptance tests. Never delete populated claim records in a rollback.
- No APK/IPA, physical device test, TestFlight or Play Store release was performed.

## Next suggested milestone

Add a _separate, authenticated, read-only reference reconciliation workflow_ for `UNKNOWN` and orphaned `INITIATING` attempts, verifying provider status before an administrator can decide the next safe action. Validate against current official KoraPay sandbox documentation without enabling customer checkout or deploying any changes.
