# EaziCart Native — Phase 6 Messaging Enhancements

Date: 2026-11-08
Status: **development branch only — do not deploy**.

## Exact baseline
Parent: `feat/eazicart-native-messaging-20261108` at `1dce65a0bbd26ebb0f740076ec4d8d4384a88bab`.
The preceding messaging tables and routes were already implemented on this branch but have **not** been migrated or deployed to production. This change extends that isolated branch.

## Changes
- Add buyer-specific and seller-specific read checkpoints on conversations.
- Add unread counts for participant-scoped conversation listings, never exposing outsider conversations. `PATCH /conversations/:id/read` acknowledges only the latest persisted incoming message, using server-stored timestamps.
- Add optional product reference on messages, with an additive foreign key, delete-safe null behavior and index.
- Product IDs are verified against active EaziCart products belonging to the seller of that conversation. Client-supplied image, seller identity, and price are not accepted.
- Senders can share product cards as standalone messages or with text. Existing sender-scoped idempotency and replay-conflict validation now checks product ID too.
- Native inbox displays unread counts; the conversation screen acknowledges messages and renders verified product cards. A native picker selects a product from the conversation seller.

## Verification (isolated test environment)
- Dedicated disposable PostgreSQL 16 Docker database, localhost:55432, `eazicart_chat_synthetic`. All prior baseline migrations plus the new additive migration applied only to that container.
- Prisma schema validation **PASS** after supplying the disposable database URL; schema comparison **no difference**.
- 8/8 PostgreSQL integration tests **PASS**, including unauthorized reads, separate participant unread counts, read acknowledgements, seller product validation, archived product rejection, idempotent concurrent messages, replay conflict, and replay after unpublishing a shared product.
- 66/66 native mocked API tests **PASS**.
- Mobile TypeScript **PASS**; mobile lint **PASS**; database TypeScript **PASS**; scoped TypeScript/API lint **PASS**; changed TypeScript files pass Prettier.
- Full API typecheck/lint still blocked by pre-existing unrelated malformed Kora staging test and an unrelated payment configuration lint violation. Scoped API TypeScript check excluded the known malformed Kora test only; temporary QA config was removed before commit.
- No Android/iOS executable, physical-device test, Figma direct comparison, or live-user messaging test.

## Remaining release gates
- Dedicated nonproduction HTTPS staging API and disposable staging credentials.
- Physical Android and iOS app testing, especially keyboard, navigation, restore/reconnect, and product picker.
- High-volume unread-count optimization (current endpoint counts messages per conversation), moderation/reporting/blocking, spam rate limits, retention/privacy review, read-state race tests, attachment security and optional realtime delivery.
- Explicit separate approval required before any production database migration, API/web release, production background worker, app build distribution, or push notifications.
