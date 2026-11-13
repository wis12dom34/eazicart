# EaziCart Native — Phase 34 Chat Read Receipt & Pagination Reliability

Date: November 13, 2026. Based on Phase 33 checkpoint `769d601e248a4a2fdd24223330a41745b14a1a94`.

## Verified issues
- The chat screen used `read.isPending` and a single last-marked message ID. If another message arrived during a pending read receipt, the newer acknowledgement could be skipped rather than queued.
- The acknowledgement marker was not scoped by user and conversation and the previous successful read callback invalidated a query key captured from its starting render, which risked stale account cache updates.
- An older-page fetch error could set `messages.isError` and replace already-loaded chat messages with a full-screen error; there was no targeted retry control for older history.

## Changes
- Added `createChatReadCoordinator`, a scoped single-flight read acknowledgement queue keyed by account, conversation and newest message ID. The latest requested read wins while one is pending; a successful acknowledgement is not repeatedly issued on every 12-second poll.
- Only refresh the originating user's conversation cache if the account and conversation remain current when the read completes.
- Failed reads are retried on a subsequent message-query update instead of spinning immediately. Cache refresh failures do not cause duplicate API reads.
- Keep existing messages visible when a later-page fetch fails. Add a dedicated `Retry loading older messages` button. Pause automatic older-page loading after failure until the user initiates a retry.
- Preserve existing backend API contract; no production chat/read requests executed.

## Verification performed
- New read/pagination coordinator tests: 9/9 passed (repeat dedup, queued next receipt, latest-only coalescing, account switch, chat switch, read retry after failure, cache refresh failure, invalid scope, pagination state).
- Focused chat/messaging tests: 25/25 passed.
- Full React Native client tests: 136/136 passed.
- Native build-safety script suite: 64/64 passed.
- TypeScript: initial run reported two nullable-state checks in the new coordinator; corrected the implementation and reran `tsc --noEmit` successfully.
- ESLint and Prettier: passed. `git diff --check`: passed.
- Fresh offline Android Expo Hermes JavaScript export and asset verification: passed.
- Fresh offline iOS Expo Hermes JavaScript export and asset verification: passed. Exports used the nonproduction `https://fixture.invalid/api` configuration.

## Remaining limitations and safety
- Exports are only JavaScript/Hermes assets, not installable Android APK or iPhone IPA builds.
- Dedicated, approved isolated Android and macOS build runners, disposable staging backend and physical-device QA remain prerequisites for binary testing and release.
- Review-only branch. No merge, deployment, real notifications/messages, payments, wallets, KoraPay, Paystack records, databases, user data, or app-store publication changed.
