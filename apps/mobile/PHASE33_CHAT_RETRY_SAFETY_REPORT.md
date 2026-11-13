# EaziCart Native — Phase 33 Chat Submission & Retry Safety

Date: November 13, 2026. Based on Phase 32 checkpoint `ca22fc0ebf9887df45cba7e56d1754999377f84a`.

## Observed reliability risk
The chat screen relied on React Query `send.isPending` to prevent multiple simultaneous submit taps, which is not a synchronous lock. The retry key was kept in component state without an explicit account/conversation/payload scope, so edge cases involving edited text, shared products, a different conversation or account could risk replaying a stale `clientMessageId`. The existing send-success handler also cleared composer state and invalidated queries even if its initiating user/chat context changed before the response arrived.

## Changes
- Introduced `createChatSendCoordinator`, a dependency-free, screen-scoped synchronous single-flight submission coordinator based on the existing Phase 31 exclusive mutation gate.
- Snapshots trimmed message body and optional shared-product ID at send time; refuses unauthenticated/blocked/empty/overlength sends.
- Reuses the original `clientMessageId` only for an uncertain failure of the exact same message, product, account and conversation. A different message, product, chat or account receives a fresh ID.
- Does not invoke completion side effects after account or conversation switching. Clears only composer fields still matching the acknowledged snapshot.
- Keeps query cache invalidation scoped to the initiating chat/account and ensures a refresh failure cannot be treated as a failed send requiring a new ID.
- Preserves the existing chat backend endpoint, bearer authentication and server-side duplicate protection; no production message was sent.

## Verification
- Seven new chat coordinator tests: 7/7 passed, including rapid duplicate tap, uncertain retry, edited-product and message scopes, chat/account switch, stale success, invalid send, product-only send.
- Focused messaging/coordinator tests: 23/23 passed.
- Full React Native client suite: 127/127 passed.
- Native build-safety suite: 64/64 passed.
- TypeScript, ESLint, Prettier and `git diff --check`: passed.
- Actual offline Android Expo Hermes export and asset verification: passed.
- Actual offline iOS Expo Hermes export and asset verification: passed.
- Both exports used a synthetic nonproduction `https://fixture.invalid/api` endpoint and made no real API calls.

## Remaining limitations and safety
- No installable Android APK or iOS IPA was produced. Real device testing remains blocked by unavailable approved isolated Android/macOS build runners and disposable staging backend.
- This is a review-only GitHub branch; do not merge, deploy, dispatch CI, or publish without approval.
- Production web/API, payments, wallets, KoraPay, historical Paystack transactions, customers, databases and data remain untouched.
