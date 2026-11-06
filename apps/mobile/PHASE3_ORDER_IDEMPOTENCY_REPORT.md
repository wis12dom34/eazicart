# EaziCart Native — Durable Order Idempotency (Isolated Backend Candidate)

Date: 2026-11-06
Status: **Developed and tested on a disposable PostgreSQL cluster. Not deployed.**

## What was built

- Added an additive `OrderIdempotency` Prisma model and review-only SQL migration with a database-enforced unique `(buyerId, key)` constraint and unique optional `orderId`.
- Added an **unregistered** Fastify route: `POST /preview/orders/idempotent`. It is deliberately absent from `app.ts` and `server.ts`, and does not modify the existing live `POST /orders`.
- The endpoint requires authenticated buyer identity and a 16–128-character `Idempotency-Key` header. The body must contain `addressId`, `expectedTotal`, and the reviewed `cartSnapshot` (product ID, quantity, unit price).
- A canonical SHA-256 fingerprint binds the buyer, address, expected total, and sorted cart contents to the key. On first use, the backend compares the snapshot with the real cart and server pricing.
- The idempotency record, order, order items, notification, and cart-item deletion are written in **one serializable Prisma transaction**. On rollback, no key or partial order remains.
- Concurrent retries use the same persistent key. Once created, the key replays the original owned order with HTTP 200 without another notification, price recalculation, cart read or order. First creation responds with HTTP 201.
- Serializable conflicts and unique-key races are retried with a bound of six attempts. Exhaustion is reported as retry-required, not as a second order.
- No payment is initiated, verified, or settled by this candidate.

## Verification performed

- `pnpm --filter @eazicart/database build`: passed (Prisma client generated in isolated checkout).
- `pnpm --filter @eazicart/api typecheck`: passed.
- `pnpm --filter @eazicart/database typecheck`: passed.
- ESLint scoped to new API source and test: passed.
- `prisma validate`: passed.
- **12 disposable PostgreSQL integration tests**: passed, including concurrent identical requests, different keys racing for the same cart, buyer isolation, mismatched address and total, changed product snapshot even at same total, stock failure, durable replay, and post-order notification failure rolling back the transaction.
- The test runner refuses to execute unless it verifies `pg_virtualenv -t`, temporary `/tmp/pg_virtualenv.*` data directory, nonstandard port, root-only temporary role, and test-only flags.
- The runner applies `prisma db push` to the disposable cluster, removes only its new empty `OrderIdempotency` table, and applies the exact additive migration SQL. PostgreSQL cluster is deleted on completion. **No production database was used.**

## Files changed

1. `packages/database/prisma/schema.prisma` — additive schema model and relations.
2. `packages/database/prisma/migrations/20261106000000_order_idempotency/migration.sql` — additive, unapplied SQL migration.
3. `apps/api/src/modules/orders/idempotent-preview.ts` — unregistered backend candidate and transaction logic.
4. `apps/api/src/modules/orders/idempotent-preview.postgres.test.ts` — opt-in real PostgreSQL integration tests.
5. `apps/api/scripts/test-idempotency-disposable.sh` — guarded disposable runner.
6. `apps/mobile/PHASE3_ORDER_IDEMPOTENCY_REPORT.md` — this report.

## Important constraints / blockers

- The active production `POST /orders` remains unchanged and **is not yet idempotent**. The candidate must undergo explicit review and be integrated into a separately approved production route release.
- KoraPay payment initializer and callback paths remain unregistered in production. The mobile Pay/Place Order action remains disabled.
- Server-side idempotency is proven for this candidate using isolated fixtures; it has **not** been authenticated against real customer accounts or device clients.
- Production migration requires separate approval, backups, proper migration sequencing, and explicit rollback review.
- For a rollback, revert application routing first while leaving any persisted idempotency records intact. Never drop the table or delete keys containing customer order references during ordinary rollback. A table drop is only conceivable if empty, routes disabled, and separately authorized.
- iOS/Android install, physical-device verification, and live staging KoraPay payments remain future release gates.

## Next recommended milestone

Integrate the verified nonce contract into a **separate nonproduction order API**, connect the mobile checkout review to that approved staging API only, and perform isolated cross-device payment and failure recovery tests. Preserve the disabled production checkout until a separately approved KoraPay release.
