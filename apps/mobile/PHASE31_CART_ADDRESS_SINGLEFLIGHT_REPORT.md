# EaziCart Native — Phase 31 Synchronous Single-Flight Cart and Address Mutations

Date: November 13, 2026. Baseline Phase 30 commit `0979d65fc61a13d35449da6ab39efeaee77706a5`.

## Reason for fix
The cart and address React Native screens used asynchronous `useState` flags (`busyItem`, `clearing`, `saving`) to prevent duplicate taps. State changes do not take effect synchronously across two taps before a rerender, leaving a race for overlapping cart quantity edits, clear-cart confirmations, address saves or address removals.

## Changes
- Added a minimal, dependency-free, synchronous exclusive mutation gate that acquires before invoking an asynchronous task, refuses competing operations, and releases in `finally` on both success and failure.
- Cart screen uses one `useRef`-held gate shared by quantity changes and clear cart, preventing overlapping calls even before React renders loading indicators.
- Address screen uses one `useRef`-held gate shared by address creation and removal. Saving cannot overlap a removal and duplicate actions are refused.
- Address form Cancel is disabled while saving.
- Added five unit tests covering immediate double taps, cross-action mutual exclusion, failed-request recovery, synchronous exceptions, and protection during awaited cleanup.
- No backend endpoint contracts or payment logic were modified. This client-side guard supplements but does not replace backend idempotency.

## Verification executed
- New single-flight gate tests: 5/5 passed.
- Complete native client test suite: 115/115 passed (110 prior plus five new).
- Native build-safety script suite: 64/64 passed.
- TypeScript and ESLint: passed.
- Prettier and git diff whitespace validation: passed.
- Fresh offline Expo Android JavaScript/Hermes export and validation: passed.
- Fresh offline Expo iOS JavaScript/Hermes export and validation: passed.
- Bundle exports use the synthetic `https://fixture.invalid/api` environment; they are not installable APK/IPA binaries.

## Safety and remaining work
- Worked only in a disposable checkout from the reviewed Phase 30 commit and wrote a new GitHub review branch. No merge, production VPS service change, app deployment, wallet, payment, database, user data or App Store/Play Store submission.
- No real device install, app signing or native binary compile. Isolated Android and macOS build runners with approved disposable staging remain required.
- Production native checkout and new payments remain disabled, awaiting separately approved backend validation and release review.
