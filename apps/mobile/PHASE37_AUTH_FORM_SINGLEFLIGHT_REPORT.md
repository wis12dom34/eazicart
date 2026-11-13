# EaziCart Native — Phase 37 Authentication Form Single-Flight Safety

Date: November 13, 2026. Based on Phase 36 checkpoint `90c11525ad0c04b7b4b86993beeece11d5bd646e`.

## Identified issue
The native login and registration screens relied solely on React `useState(busy)` to prevent repeated submit taps. Because React updates are not synchronous, rapid double taps could initiate overlapping sign-in or registration requests before the loading state rendered. Late responses could also navigate backward or show an alert after a user left the form.

## Changes
- Added `createAuthFormCoordinator`, based on the existing synchronous exclusive mutation gate. It acquires immediately at submit time and refuses competing attempts while one request is pending.
- Added screen lifetime invalidation: a disposed login/register screen suppresses late success navigation, error alerts and UI state writes.
- Captures normalized email, password, and registration name at submission time; avoids credentials changing unexpectedly mid-request, with no new logging or persistence.
- Updated login and registration screens to use the coordinator and retain existing validation, loading indicators and error text; disabled switching between login/register screens during active submission.
- On a failed API request, the guard releases so a user can retry.
- This is a **UI single-flight guard**, not network cancellation or an authorization change. The existing AuthProvider's server session/epoch checks and secure token storage remain unchanged; an already-started authentication request may still complete after unmount.

## Verification
- Six new auth form coordinator tests: 6/6 passed (rapid duplicate taps, failed attempt/retry, unmount after success/error, submissions after form dismissal, callback-error cleanup).
- Focused auth form and session-write-gate tests: 11/11 passed.
- Full React Native client tests: 158/158 passed.
- Native build-safety script suite: 64/64 passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint `--max-warnings=0`: passed.
- Prettier and `git diff --check`: passed.
- Fresh offline Android Hermes JS export + asset verifier: passed.
- Fresh offline iOS Hermes JS export + asset verifier: passed.
- Exports used synthetic `https://fixture.invalid/api` and made no real account or API calls.

## Scope and pending work
- Review-only isolated development branch; no production app/API deployment, merge, login attempt against real users, credential collection, DB mutation, payment, wallet mutation or app store publication.
- Exports are JS/Hermes bundles, not installable Android APK or iOS IPA. Device installation and runtime QA require approved isolated native build runners and a disposable staging backend.
- Follow-on auth recovery requires separately verifying available backend endpoints and secure UI flows; no password reset endpoints were invented or changed.
