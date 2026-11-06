# EaziCart Native — KoraPay Admin Audit Report & CSV Export

Date: 2026-11-06
Status: **Isolated development candidate only. Not merged, deployed or activated.**

## Implemented

- `GET /preview/admin/korapay/reconciliation/report` returns a minimal summary of unresolved KoraPay checkout-initiation claims, split into `INITIATING` and `UNKNOWN`, plus an explicit `MANUAL_REVIEW_REQUIRED` action. No customer identities, credentials, bank accounts, or checkout URLs are included.
- `GET /preview/admin/korapay/reconciliation/export.csv` returns a bounded, cursor-paginated CSV with up to 250 records per request. Query parameters `state`, `limit`, and opaque `cursor` are validated. Sorting by creation time and payment ID is deterministic; invalid or mismatched cursors are rejected. `X-Export-Has-More` and `X-Export-Next-Cursor` support pagination. This is a per-page audit export, not an unbounded whole-database dump.
- Both routes require a valid authenticated session and an **up-to-date User.role === ADMIN** record. They inherit the isolated-only `NODE_ENV=test`, disposable-PostgreSQL and synthetic KoraPay provider gates.
- CSV fields are statically restricted to payment ID, order ID, reference, initiation state, local payment status, currency, reference consistency, created/updated timestamps, and the `MANUAL_REVIEW_REQUIRED` flag.
- Export cells are quoted, internal control characters removed, and spreadsheet formula-leading values forced to text. Output has attachment disposition, `no-store` cache control and `nosniff`. The report also has `no-store`.
- Neither endpoint calls KoraPay, mutates a payment/order/stock/wallet, sends notifications, initiates a charge, runs reconciliation, or changes an initiation claim.
- Existing reconciliation provider-probe route remains observation-only; the native Pay button remains disabled.

## Test plan and verified outcomes

- **4/4 CSV unit tests passed** — column whitelist, spreadsheet formula escaping, control-character and quoting, strict cursor encoding/validation.
- **37/37 disposable PostgreSQL integration tests passed** — 12 existing order-idempotency, 21 KoraPay staging/reconciliation, plus 4 new admin report/CSV tests.
- **35/35 mobile regression tests passed**, with no mobile source changes.
- API and database TypeScript, scoped ESLint, formatting and Prisma schema validation **passed**.
- Direct execution of disposable PostgreSQL runner outside `pg_virtualenv` was **refused** (expected exit code 23).
- New routes remain unregistered in production application startup.
- No real KoraPay charge, sandbox credential, production DB query or deployment is authorized.

## Operator decision checklist (manual, outside this feature)

1. Confirm the requestor is an authorized finance operator and identify the exact payment ID, order ID and KoraPay reference using the admin-only export.
2. Confirm buyer ownership and historical provider match from the server-side order/payment records. If payment reference, amount or currency does not match, **stop** and escalate.
3. Read KoraPay's official charge verification using a server-only GET `/merchant/api/v1/charges/:reference`. Never trust a mobile redirect, client success page or unsigned webhook by itself.
4. Independently match the provider reference, status, `amount`, `amount_paid`, currency, and store order total. A missing/partial/ambiguous provider response is **not** proof of settlement.
5. Reconcile against past successful charges/webhook events and payment history before deciding whether funds arrived; do not initialize another charge while the original initiation remains uncertain.
6. Record an audit note and obtain an authorized approval through a separately reviewed procedure; this feature does **not** implement such an approval or write operation.
7. A future audited repair service must enforce database-transaction settlement, exactly-once inventory/fulfillment, permission checks, and protected rollbacks. No direct manual SQL status update.
8. For disputes or ambiguous charge references, escalate through KoraPay support using sanitized logs and the transaction reference, omitting live credentials and sensitive customer data.

## Verified official KoraPay documentation consulted

- Checkout Redirect: https://developers.korapay.com/docs/checkout-redirect
- Card charge verification: https://developers.korapay.com/docs/accepting-card-payments-with-apis
- Developer FAQ: https://support.korapay.com/hc/en-us/articles/40023846563858-Technical-Support-Developer-FAQ

These references confirm KoraPay's server-side charge-verify GET endpoint and redirect-checkout initialization endpoint. They **do not** replace a sandbox integration test, webhook signature audit, or production authorization.

## Rollout blockers

- Add user-facing admin dashboard, monitoring/audit logging, rate limits and access review before any production availability.
- Confirm exact merchant account, current KoraPay webhook authentication and provider reconciliation behavior through approved sandbox credentials.
- Existing production `POST /orders`, `/payments/initialize` and the native payment action remain unchanged.
- No additive migration has been applied to production; new schema changes in preceding milestones remain review-only.
- iOS/Android device install, secure browser deep-link handling and payment UX remain unverified.
