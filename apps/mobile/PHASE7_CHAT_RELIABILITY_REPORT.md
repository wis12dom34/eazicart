# EaziCart Native — Phase 7 Chat Reliability and Abuse Limits

Date: 2026-11-08
Status: **isolated GitHub development only; not deployed to production**.

## Baseline
- Branch `feat/eazicart-native-chat-unread-products-20261108` commit `06e497c52b59ae5837ac67c978641b224d5e20bb`.
- This release contains no new Prisma models or migration files. Phase 5 and Phase 6 messaging migrations are still unapproved and not applied to production.
- Figma could not be consulted due the connected account's MCP plan limit; existing native UI patterns are preserved, not claimed to be directly Figma verified.

## Changes
1. **Unread performance**: replace up to 100 per-conversation `COUNT` requests with one grouped `ChatMessage` aggregate query after listing participant-authorized conversations. Keep total unread counts and buyer/seller read checkpoints unchanged.
2. **Cross-worker, transactionally enforced send protection**: protect new messages with a PostgreSQL transaction-scoped advisory lock keyed by sender, count already stored messages within the prior 60 seconds, and reject the 21st new message with HTTP 429 `CHAT_RATE_LIMIT`. All workers sharing PostgreSQL obey the same rate limit. There are no in-memory per-process counters. A new message and inbox timestamp change commit atomically.
3. **Idempotent retries**: an already stored message with the same sender and request UUID returns the saved message without consuming send quota. Changed-body or product replays are rejected. Race-safe conversation creation catches duplicate pair uniqueness conflicts and loads the existing conversation.
4. **Native reconnect UX**: after a successful send, the composer clears only draft, retry key and product selection still corresponding to the exact sent request. If the user started a new draft while a request was pending, the new text/selection remains intact. Existing network error and typed HTTP 429 propagation remain enabled.

## Verification
- Local disposable PostgreSQL 16 Docker container, database name `eazicart_chat_synthetic`, bound only to localhost TCP port 55432; existing migrations applied there only. No production data accessed or altered.
- Isolated PostgreSQL integration suite: **9/9 PASS**, including concurrent initiation, participant privacy, sender-scoped duplicate prevention, product ownership checks, unread read checkpoints, rate-limit response, concurrent send handling, message retry after saturation, and independent seller send capacity.
- Native Node unit/API suite: **68/68 PASS**, including simulated network failure with identical retry UUID, HTTP 429 and authentication behavior.
- Scoped API TypeScript **PASS** and messaging lint **PASS**. The scoped TypeScript config temporarily excluded only the pre-existing broken Kora staging test file; the temporary config was deleted.
- Native TypeScript **PASS**, lint **PASS**; database TypeScript **PASS**; changed code Prettier **PASS**; git diff whitespace check **PASS**.
- Full API lint/typecheck remains blocked by pre-existing, unrelated Kora test syntax and payment-configuration lint errors. No Android/iOS build or physical-device QA was run.
- No automatic notifications, worker, or production deployment activated.

## Remaining release gates
- Review abuse moderation/report/block policies, robust live user identity and staging integration, message retention/privacy, HTTP backpressure, conversation pagination beyond the first 100, monitoring/metrics, testing clock skew/timestamp ties, and load testing with realistic connections.
- Validate all screens on real Android and iPhone devices with slow/offline networks, keyboard and app resume.
- Require explicit separate approval for production API/migrations and app-store distribution.
