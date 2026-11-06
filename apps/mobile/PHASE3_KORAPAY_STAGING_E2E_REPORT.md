# EaziCart Native — KoraPay Disposable Staging Checkout Integration

Date: 2026-11-06
Status: **Completed fixture-only integration milestone. Not deployed, published, or activated.**

## Summary

Connected the prior durable order-idempotency candidate with the existing, unregistered KoraPay checkout/verification/webhook/settlement candidate modules in an **isolated Fastify test harness**, on disposable PostgreSQL. Reused existing candidate business logic; did not touch the live order or payment routes.

## Features completed

- Imported the previously developed, unregistered KoraPay candidate modules into the isolated development branch for isolated integration and review.
- Created `registerIsolatedKoraStaging`, requiring `NODE_ENV=test`, dedicated fixture flag, disposable database flag, non-production PG port, a verified `/tmp/pg_virtualenv.*` PostgreSQL data directory, and injected synthetic provider fetcher + webhook secret.
- Registered **test-only** preview routes: `POST /preview/orders/idempotent`, `POST /preview/korapay/checkout`, `GET /preview/korapay/orders/:orderId/verify`, and `POST /preview/korapay/webhook`.
- Verified full flow: cart snapshot + address -> durable buyer-scoped order -> one pending KoraPay payment record -> simulated provider initialization -> provider-verified confirmation -> stock decrement/fulfillment/notification exactly once.
- Verified failed signature, non-owner, pending, underpaid, wrong currency, provider unavailable, inventory shortages requiring manual review, and historical Paystack records.
- Verified actual HTTP requests on loopback `127.0.0.1` and a simulated checkout URL. All provider calls are intercepted by synthetic fixture code; no external payment provider request is permitted.
- Created `test-kora-staging-disposable.sh`, which validates the disposable PostgreSQL server and runs the exact additive order-idempotency migration before test execution. File-level suites are sequential to isolate failure-injection triggers; request-level concurrency inside each suite remains enabled.

## Evidence and validation

- **25/25 real PostgreSQL integration tests passed** across two suites:
  - 12 durable order idempotency, buyer ownership, rollback, concurrency and replay tests.
  - 13 KoraPay checkout, payment review, signed callback, fail-closed behavior, loopback HTTP and settlement tests.
- Database migration SQL applied successfully in disposable cluster; cluster dropped afterward.
- API TypeScript, scoped ESLint and formatting: passed.
- No unauthorized registration in `apps/api/src/app.ts` or `apps/api/src/server.ts`.
- No production database, secret, customer wallet, inventory, order, or payment activity.

## Files added

1. `apps/api/src/modules/payments/isolated-kora-staging.ts` — hard-gated fixture-only route assembly.
2. `apps/api/src/modules/payments/isolated-kora-staging.postgres.test.ts` — disposable database end-to-end tests.
3. `apps/api/scripts/test-kora-staging-disposable.sh` — fail-closed runner.
4. Seven copied, previously developed, unregistered KoraPay candidate TypeScript modules:
   `korapay-api-adapter-candidate.ts`, `korapay-checkout-api-candidate.ts`, `korapay-checkout-flow-candidate.ts`, `korapay-migration-candidate.ts`, `korapay-preview-route-candidate.ts`, `korapay-prisma-settlement-candidate.ts`, and `korapay-webhook-candidate.ts`.
5. `apps/mobile/PHASE3_KORAPAY_STAGING_E2E_REPORT.md` — this report.

## Outstanding blockers and release safeguards

- **No actual KoraPay sandbox/live provider traffic** or provider-owned signature test vectors verified. Current tests use a simulated KoraPay fetcher and fixture HMAC signature; production webhook signature/amount semantics require current provider documentation and test credentials.
- Provider checkout initialization can be called more than once under concurrent retries even though the local `Payment` row/reference is unique. Before deployment, persist/return the checkout authorization URL and implement a durable, provider-safe in-flight recovery strategy. Do not assume client request deduplication alone guarantees a single provider initialization.
- Production `POST /orders` is not yet using the idempotency candidate, and its additive Prisma migration was **not** applied to production.
- The live `/payments/initialize` code path remains Paystack. KoraPay preview routes are deliberately unregistered in production.
- App-level native checkout must remain disabled until explicit approval, isolated staging environment with trusted credentials, completed payment integration security review, and physical-device acceptance tests.
- Preserve existing Paystack payment history and customer data. Production rollback should revert application routing without removing populated order idempotency records.

## Next recommended development milestone

Stabilize the payment-initialization concurrency/recovery contract and test against **official KoraPay sandbox credentials** in a separately configured staging environment, while keeping the native Pay button disabled. Then prepare a reviewed backend deployment plan requiring explicit approval.

- Mobile regression suite: 35/35 tests passed. The native Pay button remains disabled.
