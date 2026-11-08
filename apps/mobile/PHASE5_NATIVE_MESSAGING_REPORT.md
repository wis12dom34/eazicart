# EaziCart Native — Buyer/Seller Messaging Checkpoint

Date: 2026-11-08
Status: **Isolated GitHub development branch only**. No production deployment, database migration, mobile binary, payment activation or push notifications.

## Baseline
- Parent branch: `feat/eazicart-native-notifications-20261108`, head `220c08a1574e42524b27195086c58acbfc069749`.
- Existing production API code did not expose native buyer/seller conversation endpoints; the web chat screen was a placeholder.
- Prisma schema had no conversation or chat message model.
- Figma source could not be reopened because the connected Figma account hit its MCP Starter-plan call limit. The native code uses the existing EaziCart theme and navigation patterns, not a claimed pixel-perfect Figma export.

## Included
- Additive Prisma `Conversation` and `ChatMessage` models, composite unique keys and scoped migration file. **Migration remains unexecuted in production.**
- Protected REST routes:
  - `GET /conversations` (participant scoped)
  - `POST /conversations` (buyer to existing seller, unique pair)
  - `GET /conversations/:id/messages` (participant scoped, cursor paginated, 30 per page)
  - `POST /conversations/:id/messages` (participant scoped, message validation and sender-scoped UUID idempotency)
- Native inbox tab, chat thread UI, authenticated API methods, message compose, reply, safe retries and entry point on seller storefront.
- Text-only chat. No rich media, realtime sockets, typing status, read receipts, attachments, push or product cards in this checkpoint.

## Verified QA
- Frozen-lockfile dependency installation and Prisma client generation completed in isolated VPS clone.
- Disposable Docker PostgreSQL 16 database named `eazicart_chat_synthetic` on loopback port `55432` only. All migrations applied **only to this synthetic database**.
- `prisma validate` **PASS**; migration diff from disposable DB to new schema: **no difference**.
- Isolated PostgreSQL API tests: **6/6 PASS**, covering auth, seller existence, self-chat, repeat conversation creation, unauthorized outsider reads/writes, concurrent message idempotency, conflicting replay, validation and seller reply.
- Scoped API TypeScript and lint **PASS**. The QA typecheck excluded the **pre-existing unrelated malformed** `src/modules/payments/isolated-kora-staging.postgres.test.ts`, using a temporary config not committed.
- Native app `tsc --noEmit` and `eslint src` **PASS**.
- Native app mocked tests **64/64 PASS**; dedicated messaging API tests included.
- Scoped Prettier **PASS** and `git diff --check` **PASS**.
- Full API typecheck and lint **not green**, blocked by pre-existing malformed KoraPay test and a pre-existing payment-configuration lint error.

## Outstanding before release
- Direct Figma inspection/comparison, Android/iOS build and physical-device keyboard and navigation QA.
- Dedicated approved HTTPS staging API/database and migrations tested end-to-end, including user identity and auth store consistency.
- Test longer message histories, concurrent send/reconnect, network interruption, lifecycle and performance.
- Review moderation/abuse controls, reporting/blocking, rate limits, retention policy, and secure notifications.
- Separate explicit approval before any production migration, API or native deployment.
