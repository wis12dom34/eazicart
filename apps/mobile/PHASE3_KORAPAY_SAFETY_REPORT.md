# EaziCart Native — Isolated KoraPay Checkout Safety Milestone

Date: 2026-11-05
Status: **Not deployed; payment and order creation intentionally disabled**.

## Current backend audit

- Production EaziCart service has an active API bundle rooted at the existing release. The active app registration calls the legacy `registerPayments` route; source `/payments/initialize` calls `initializePaystack`.
- KoraPay preview routes (`/preview/korapay/checkout`, `/preview/korapay/orders/:orderId/verify`) are defined in candidate modules but are **not registered in production**. The isolated candidate startup explicitly requires a disposable PostgreSQL Unix-socket cluster.
- `POST /orders` requires `addressId` and `expectedTotal`, validates stock and total and clears cart, but there is **no demonstrated server-side idempotency-key enforcement** for repeated order creation. Client-side locking does not solve repeated requests after app restarts, network timeouts, or concurrent devices.
- These issues block production payment activation.

## Implemented native code (fixture-only)

- `src/lib/checkout-safety.ts`: explicit fail-closed production checkout switch, KoraPay-only session validation, HTTPS checkout URL allowlist, strict owner-scoped verification-response validation.
- `src/lib/isolated-checkout-coordinator.ts`: injection-only fixture coordinator that re-reads cart and addresses, sends idempotency keys to a **mock backend contract**, deduplicates concurrent calls and reuses an existing fixture order on retries. Does **not** have a real production adapter and is not called by the mobile UI.
- `src/app/checkout.tsx`: reuses the single checkout-disabled reason. No payment or order-creation call introduced.
- No secret keys or customer records are included.

## Test results

- Mobile tests: **35 passed** (including 11 new checkout safety/fixture orchestration tests).
- Separate backend candidate fixture tests: **29 passed** across 6 suites (provider adapter, signed webhooks, preview config, migration contract and preview checkout). Candidate source files were read/copied into the isolated worktree for test execution, then removed. No production account, secret or database used.
- Prisma Client generated and compiled **only in isolated worktree**; no migration executed.
- TypeScript, ESLint and Prettier checks: **passed**.
- Android and iOS Hermes JavaScript bundle exports: **passed** (not installable APK/IPA).
- Read-only live API smoke checks: **passed** (GET only).

## Required before payment can be enabled

1. Explicit deployment approval and tested production-ready backend KoraPay checkout route; never route native checkout through legacy Paystack initializer.
2. Backend transactional request-level idempotency for `POST /orders` and checkout creation: stable key scoped to buyer + cart version, persisted conflict results, same order returned on retry, prevention across devices and restarts.
3. Preserve all existing payment history and wallets; verified NGN amount, reference, provider, ownership, pending-only transitions and KoraPay signed webhook; exactly-once settlement/inventory updates.
4. Isolated PostgreSQL integration tests for order creation duplicates, concurrent checkout, failures/timeouts, payment verification, stock changes, retries, and rollback.
5. Native Android/iOS real-device development-build tests and legitimate staging KoraPay payment flow, with return URLs treated as untrusted pending states until backend confirmation.
6. Separate explicit approval to activate checkout and deploy. No customer payments or production order creation are authorized.

## Preservation

No changes to existing web/API code, production database, inventory, wallets, orders or payments. The native payment button stays disabled.
