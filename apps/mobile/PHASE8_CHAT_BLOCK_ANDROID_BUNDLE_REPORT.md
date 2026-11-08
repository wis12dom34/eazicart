# EaziCart Native — Phase 8 Chat Safety and Mobile Bundling

Date: 2026-11-08
Status: **isolated development branch only; not deployed to production**.

## Baseline
- Parent: `feat/eazicart-native-chat-reliability-20261108` commit `ab725e25cce51fe61bc2c0a1df98da62b0c023d9`.
- The Phase 5–7 chat database migrations remain undeployed to production.
- This checkpoint combines and validates earlier uncommitted isolated Phase 8 blocking work, then adds private reporting and stronger block/send concurrency guards.

## Changes
1. Additive `buyerBlockedAt` and `sellerBlockedAt` fields on `Conversation`, with independent per-participant block state.
2. Protected `PATCH /conversations/:id/block`: participant-only, outsiders receive 404. A PostgreSQL row lock serializes block-state updates with the new-message transaction, to prevent in-flight concurrent sends from racing past completed block changes.
3. New sends from either participant are rejected with `CONVERSATION_BLOCKED` when either has blocked the chat. An already-confirmed idempotent send may still be retrieved with the same client UUID; this never inserts another message.
4. Native chat UI provides confirmation-based Block/Unblock and a disabled composer when blocked; existing history stays visible.
5. New private `ChatReport` table and additive migration. Only authenticated conversation participants may record a report using `SPAM`, `SCAM`, `HARASSMENT`, or `OTHER`; optional details are limited to 1,000 characters. One report per reporter per conversation; identical retries reuse the record, conflicting replays receive HTTP 409. Reports and their details are absent from public and participant-facing conversation lists.
6. Native report form includes reason selection, optional details, honest status messaging, and sign-in/participant checks. **There is no enabled moderator review process yet**; the UI does not promise investigation or enforcement.

## Isolated validation
- Frozen-lockfile dependency installation and Prisma client generation completed in a temporary VPS clone.
- Prisma schema validation **PASS**. The two additive Phase 8 migrations were applied **only** to a disposable PostgreSQL 16 Docker database on `127.0.0.1:55432`; Prisma schema comparison: **no difference detected**.
- PostgreSQL integration tests: **11/11 PASS**, covering participant authorization, outsider denial, blocking/unblocking, retried accepted messages, concurrent rate-limiting, private reports, deduplication, and invalid input.
- Native unit/API tests: **71/71 PASS**, including authenticated block and report endpoints.
- Mobile TypeScript **PASS** and lint **PASS**. Database TypeScript **PASS**. Scoped messaging API TypeScript **PASS** and lint **PASS**. Scoped Prettier and whitespace checks **PASS**.
- Scoped API TypeScript validation excluded the unrelated pre-existing malformed `src/modules/payments/isolated-kora-staging.postgres.test.ts`; temporary validation configuration was removed.
- Android Expo JavaScript/Hermes bundle export **PASS** with `EXPO_PUBLIC_EAZICART_API_BASE_URL=https://fixture.invalid/api` (intentionally unusable fixture API, no production access).
- iOS Expo JavaScript/Hermes bundle export **PASS** with the same intentionally invalid fixture API.
- **Not tested:** Android APK/Gradle build, iOS IPA/Xcode build, signed builds, simulator, physical device, slow-network messaging behavior, or real API connectivity. Java, Android SDK/ADB and Gradle are not installed on this isolated Linux host.
- Full repository typecheck and lint still have unrelated pre-existing KoraPay syntax/lint issues. Direct Figma inspection unavailable because the connected account's MCP starter-plan limit had been reached.

## Remaining safety and release gates
- Approved dedicated staging server and isolated credentials; deployment of baseline messaging migrations into staging first.
- Build and device QA on Android/iPhone; lifecycle, keyboard, accessibility, network loss/reconnect, long conversations, concurrent block/send under realistic load.
- Staff moderation inbox, triage and resolution workflow, safe retention, rate limits for reporting, abuse escalation, audit trail, monitoring, product card moderation and privacy review.
- Explicit separate user approval required before production migration, API release, app distribution, or live moderation/notification activation.
