# EaziCart Native — Phase 14 Moderation Connectivity and Uncertain-Write Recovery

Date: 2026-11-08. Development branch only; no deployment.

## Baseline
Phase 13 commit `6c97c8672930fe97bd68469d2886afaf6ed3e3f4`.

## Changes
- Distinguish expired/unauthorized administrator access from offline/timeouts and other moderation API failures.
- On an uncertain moderation mutation (connection lost or request timeout), never claim the write succeeded or failed. Explain that the server may have saved it, discard stale pagination, and refresh the queue before any manual retry.
- HTTP 409 conflict also invalidates the old list, clears the selected audit panel, and explains the need to review the new server state.
- Avoid starting a moderation transition while a queue refetch is in progress.
- Queue error screens show useful authorization, connectivity or invalid-cursor messages and provide retry.
- No automatic replay of moderator actions, no optimistic status writes, no bans or notifications.

## Verification
- Native unit/API tests: **81/81 passed** (four new recovery tests).
- Native TypeScript: **passed**.
- Native ESLint: **passed**.
- Prettier and git whitespace validation: **passed**.
- No physical-device QA, Android APK or iOS IPA created. The prepared isolated Android build workflow was inspected, not dispatched.

## Release gate
- Test actual network drops, device background/resume and role changes on Android and iPhone against an approved isolated staging backend.
- No production deployment or changes to live customer data, payments or databases.
