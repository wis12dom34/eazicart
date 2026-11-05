# EaziCart Native — Durable Order Idempotency Candidate

Date: November 5, 2026.
Status: **Implemented and tested in isolated worktree only. Not deployed or activated.**

## Completed

- Added an additive Prisma `OrderIdempotency` record, with composite primary key `(buyerId, key)`, unique linked `orderId`, buyer/order foreign keys, and captured address/expected total.
- Wrote a non-destructive migration draft in `packages/database/prisma/migrations/20261105000100_add_order_idempotency_candidate/migration.sql`.
- Added opt-in candidate handler `registerIsolatedIdempotentOrderCandidate` for `POST /preview/orders/idempotent`, **not imported or registered in `app.ts`**.
- Server recalculates cart totals using authoritative product prices; validates buyer-owned address and item availability.
- PostgreSQL buyer-scoped transaction advisory locks serialize concurrent order creation even across different request keys. The unique database key persists request replay across processes.
- Idempotent replay returns the original order (200), initial creation returns 201, conflicting reused key returns 409.
- Created order, idempotency record, notification and cart clearing are in **one transaction**.
- Existing production `POST /orders` is untouched and still does **not** implement this new idempotency behavior.
- No payment processing, settlement, KoraPay/Paystack modifications, external requests, or client checkout activation.

## Database integration tests

- `bash apps/api/scripts/test-isolated-order-idempotency.sh` — **10/10 passed** on a freshly provisioned `pg_virtualenv -t` PostgreSQL 16 disposable cluster.
- The same temporary cluster had all 10 existing+candidate Prisma migrations applied successfully. After tests the temporary cluster was automatically destroyed.
- Tests cover unauthenticated requests, same-key replay after cart deletion, 7 concurrent same-key requests (one order), concurrent different keys (only one order), buyer isolation of equal keys, retry with a new Prisma connection, conflicting address/total, foreign address, price/stock conflicts, and rollback on forced notification write failure.
- No production database credentials, production orders or customer balances were used or modified.

## Follow-up gates

1. Audit and reconcile live VPS uncommitted Prisma schema/application changes with GitHub before proposing a migration to production. Do **not** overwrite unrelated schema revisions.
2. Review the additive migration against the actual production schema using a sanitized schema snapshot and isolated database. Obtain explicit approval before any production migration.
3. Route review, authentication hardening and staged deployment approval for the new server idempotency handler; preserve existing web checkout behavior and current order histories.
4. Match the native client idempotency key to a stable per-buyer/cart-version request. Ensure new keys on timeouts are not generated until order state is known.
5. Independently confirm KoraPay production endpoint and exactly-once provider verification/settlement with transactional inventory behavior.
6. Stage test with dedicated non-production buyer/seller accounts and physical Android/iPhone development builds.
7. Obtain separate explicit permission for any production changes, payment activation, or app publication.

## Known limitations and risks

- This milestone demonstrates **candidate** backend behavior, not a live API.
- The current production `/payments/initialize` remains Paystack, while KoraPay is an isolated unregistered candidate.
- Mobile checkout and order creation remain disabled.
- Postgres tests use isolated fixtures. No real-device, staging payment, or production order integration tests were executed.
- The API repository has a pre-existing ESLint issue in `apps/api/src/modules/payment-configuration/index.ts`. Candidate files should be linted separately; do not alter unrelated functionality.

## Worktree

`/opt/eazicart/native-order-idempotency-20261105`

## Safety

No deployment, migration to production, restart of EaziCart services, live purchase, payment charge, payment-webhook invocation, production database mutation, or app publication.
