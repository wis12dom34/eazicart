# EaziCart Native — Phase 12 Staff Access and Platform Bundle Verification

Date: 2026-11-08
Status: development branch only. No production deployment, database migration or device installation.

## Baseline
Phase 11 commit `b64394bb909014001e4de37b8852b8c8509abaa4`.

## Changes
- New authenticated `GET /admin/chat-reports/access` capability check, which queries the current user's role in PostgreSQL on every request. It returns 200 with `allowed: true` only for ADMIN and 403 for other authenticated users.
- Native account profile shows the Chat moderation navigation link only after the server verifies the current signed-in account is an administrator. Unauthenticated and denied users see no link; backend authorization remains enforced for every report/history/update endpoint.
- API tests verify anonymous 401, buyer 403, and administrator 200. Mobile tests verify bearer authentication, 403 and signed-out refusal. No role is trusted from client-controlled account fields.

## Verification
- Disposable PostgreSQL 16 at localhost:55539: migrations applied only there; **13/13** messaging integration tests passed.
- Native unit tests **76/76 passed**.
- Mobile TypeScript **passed**, mobile lint **passed**, scoped API TypeScript **passed**, messaging lint **passed**, git diff whitespace **passed**.
- Android Hermes JavaScript bundle exported successfully using `https://fixture.invalid/api` (non-resolving synthetic host). iOS Hermes JavaScript bundle exported successfully with the same synthetic host. Neither is an APK or IPA.
- Existing API-wide KoraPay staging test remains excluded only from the scoped TypeScript QA run; it was not modified.
- Production checkout, notifications, messaging migrations, KoraPay credentials, customer records and website are untouched.

## Device-build blockers
- This Linux environment lacks JDK, Android SDK and Apple Xcode. It is a shared 8 GiB VPS with production workloads, not an approved isolated Android build runner. Do not install toolchains or run Gradle here.
- The prepared manual Android GitHub Actions workflow requires a dedicated authorized runner, pinned source SHA and isolated HTTPS staging API; it has not been dispatched or activated.
- A genuine Android debug APK, iOS development build, emulator or physical-device verification still requires an approved isolated build environment and separate explicit authorization.
- The native UI is based on existing patterns; no new direct Figma inspection was possible.
