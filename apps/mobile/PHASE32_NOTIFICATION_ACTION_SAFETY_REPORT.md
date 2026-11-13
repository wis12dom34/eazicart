# EaziCart Native — Phase 32 Notification Action Safety

Date: November 13, 2026. Phase 31 baseline commit `686ad6598dbdbb4a7f50830d3e2fccc5ef10685f`.

## Identified reliability issue

On the React Native notifications screen, both `Mark as read` and `Mark all as read` launched separate `useMutation` actions. Their disabled state relied on `isPending`, which changes through asynchronous React state updates. Two quick taps could therefore initiate overlapping write requests before React rerendered. Their previous `onSuccess` callbacks also invalidated the query key captured from the initiating render, even if account identity changed before an API response arrived.

## Implementation

- Added `createNotificationActionCoordinator`, a lightweight screen-scoped synchronous guard reusing the existing Phase 31 `createExclusiveMutationGate`.
- The coordinator serializes individual read and read-all operations, verifies a current signed-in account before starting, and refreshes the notifications query only when the same account is still current after the action completes.
- The notification screen shares the guard between read and read-all actions. It retains `useMutation` for loading/error UI, with cache invalidation performed by the coordinator after successful account validation instead of unconditional mutation `onSuccess`.
- The coordinator releases after a rejected action so users can retry. A .catch at the UI boundary prevents an unhandled rejection while allowing the mutation hook to display errors.
- No backend notification endpoints or other API contracts were changed.

## Verification actually completed

- Five new coordinator tests: 5/5 passed (rapid overlapping requests, successful refresh, account switching, signed-out/wrong-account requests, failed request/retry).
- Focused notification API/UI/coordinator tests: 13/13 passed.
- Full native client tests: 120/120 passed (115 prior plus five new).
- Native build-safety script tests: 64/64 passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint `--max-warnings=0`: passed.
- Prettier and `git diff --check`: passed.
- Fresh Android offline Expo Hermes JavaScript export + asset verifier: passed.
- Fresh iOS offline Expo Hermes JavaScript export + asset verifier: passed.
- Both exports used synthetic `https://fixture.invalid/api`; no real API calls were initiated.

## Safety boundaries and remaining work

- This is a review-only branch. No merge, deployment, real customer notification updates, payments, wallets, databases, user records, service restart or app-store publication.
- A JavaScript export is not an installable Android APK or iPhone IPA.
- Dedicated approved isolated Android/macOS build runners, disposable staging backend and real-device checks remain necessary for installation builds.
