# EaziCart Native — Phase 35 Chat Block/Unblock Confirmation Safety

Date: November 13, 2026. Baseline Phase 34 commit `47da551d6ba59bb8ff00ca5b2ca418bc93e142d4`.

## Reproduced UI risk
The native chat header's Block/Unblock confirmation captured an outdated block-state Boolean and conversation ID inside React Native's Alert callback. If the user changed accounts, navigated into another conversation, or received a new block state before confirming, the stale action could be executed. Multiple rapid taps could also race before React Query's `block.isPending` state rendered.

## Changes
- Added `createChatBlockCoordinator`, a dependency-free, synchronous single-flight gate for moderation writes.
- Refuses confirmations when the expected user, conversation or block state differs from the current screen context. Revalidates that scope at action start.
- Prevents concurrent Block/Unblock calls and repeated submission of the same already-successful action before refreshed state renders.
- After successful write, invalidates the originating account's conversation cache only if the account and conversation are still current. A cache refresh error does not cause a duplicate block write.
- Retains existing backend authentication and moderation authorization; the guard adds client-side protection only. Failed requests release the gate for a new retry.

## Verification performed
- Eight new coordinator tests: 8/8 passed, covering rapid taps, stale accounts and chat confirmations, changed server block state, normal block→unblock sequence, account switch during write, error recovery, cache refresh failures and invalid account/chat.
- Focused coordinator plus existing messaging API tests: 24/24 passed.
- Full React Native client tests: 144/144 passed (136 baseline plus eight).
- Native build-safety script tests: 64/64 passed.
- TypeScript, ESLint, Prettier and `git diff --check`: passed.
- Fresh offline Android Expo Hermes JavaScript export and asset verification: passed.
- Fresh offline iOS Expo Hermes JavaScript export and asset verification: passed.
- All test exports used `https://fixture.invalid/api` with no real API traffic.

## Safety / pending work
- Changes are limited to an isolated development checkout and a GitHub review branch. No merge, production deploy, real chat moderation writes, payments, databases, user data, wallet mutations or app-store publication occurred.
- Bundled JavaScript exports are not installable APK or IPA files. A separately approved isolated Android runner, Apple Silicon macOS/Xcode runner, disposable staging backend, and physical-device QA are required before native binary release.
