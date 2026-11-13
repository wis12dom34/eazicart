# EaziCart Native — Phase 36 Chat Report Submission Safety

Date: November 13, 2026. Based on Phase 35 commit `c7dd03476f9c4400ef520090387c3a2899239a4e`.

## Reliability issue identified

The native chat-report form used React Query `isPending` as its only protection against rapid double submissions. It captured the report's reason and details via component state at mutation time and always showed the report success/failure modal, even if the user switched accounts or left the report screen while the request was pending. The POST endpoint does not currently expose an idempotency token; a timeout or connection loss is therefore an **uncertain outcome**, not proof that a report was not saved.

## Changes on review branch

- Added `createChatReportCoordinator`: synchronous single-flight moderation report gate (same pattern as earlier chat/cart safeguards), requiring an authenticated and current account/conversation, a supported report reason and at most 1,000 trimmed detail characters.
- Capture the immutable report payload at submission time, prevent a second report after a confirmed success for the same account/conversation during this screen session, and release the gate on failure.
- Only show the success confirmation if the reporting account/conversation is still current. The report screen also invalidates its current scope when unmounted, preventing old success/error modals from appearing afterward.
- Handle `TIMEOUT`/`NETWORK_ERROR` with a **Report status unknown** alert, explaining that a report may already have been recorded and should be checked before resubmission.
- Preserve the existing conversationReport endpoint and current disclosure that automated moderator review is not yet enabled. This is **client-side protection**, not backend idempotency.
- Added eight regression tests covering rapid duplicate taps, successful-submission deduplication, stale account/conversation, late responses, failed-request retry, payload validation, immutable submitted details and uncertain error classification.

## Verification executed

- Focused chat report coordinator + messaging API tests: 24/24 passed.
- Complete React Native client test suite: 152/152 passed (144 baseline plus eight).
- Native build-safety script suite: 64/64 passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint `--max-warnings=0`: passed.
- Prettier and `git diff --check`: passed.
- Fresh offline Android Expo Hermes JS export and asset verification: passed.
- Fresh offline iOS Expo Hermes JS export and asset verification: passed.
- Exports used synthetic `https://fixture.invalid/api`, with no real backend, moderation, payment or customer-data calls.

## Limitations and next steps

- A JS/Hermes export is not an installable APK or IPA. No Gradle, Xcode, CocoaPods, EAS remote build, workflow dispatch, signing, simulator or physical-device install occurred.
- Dedicated approved isolated Android and macOS build runners plus disposable staging remain required. Server-side moderation report idempotency should be separately reviewed before activating automated retries.
- Changes are on an isolated GitHub review branch only. No merge, deployment, live messages, moderation writes, payments, wallets, customer records, database migrations, production systems or app-store publication were affected.
