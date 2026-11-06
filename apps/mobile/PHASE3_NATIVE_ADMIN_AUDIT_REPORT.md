# EaziCart Native — Development-only KoraPay Finance Audit Screen

Date: 2026-11-06
Status: **Implemented, isolated and testable; not deployed/published.**

## Completed

- `apps/mobile/src/app/admin-audit.tsx`: native Finance Audit preview with uncertain-payment summary, UNKNOWN/INITIATING filters, read-only provider evidence inspection, responsive loading/error states, refresh, and CSV text sharing. No charge, refund, settlement, write or retry control exists.
- `apps/mobile/src/lib/admin-audit-preview.ts`: hardened, GET-only, isolated staging API client. The endpoint base must be explicitly configured for a developer build. It rejects eazicart.com (including branded lookalikes), KoraPay provider hosts, insecure remote URLs, query credentials, and unexpected paths. Release builds fail closed.
- The audit preview requires an explicitly supplied, ephemeral **staging-only ADMIN bearer token**. The production EaziCart session token is never read from or passed into the audit client. This token stays in memory, not SecureStore or an EXPO_PUBLIC variable. Server-side User.role === ADMIN is rechecked by the previously implemented staging API for every audit request.
- Only `GET /preview/admin/korapay/reconciliation/report`, `GET /preview/admin/korapay/reconciliation?state=...`, `GET /preview/admin/korapay/reconciliation/:paymentId/probe` and `GET /preview/admin/korapay/reconciliation/export.csv` are used. All endpoints remain unregistered in production.
- Admin link is present only in a configured development build under Profile. Attempting to navigate directly in production displays a disabled screen and does not fetch audit data.
- CSV export uses React Native core Share for **CSV text**, not a saved .csv file. Each request asks for 100 records and validates the next-page cursor and response size. Sharing is explicit, never automatic.
- `apps/mobile/.env.example` documents the explicit preview flag and staging API URL without credentials.
- Existing EaziCart mobile feed, Reels, Stories, checkout, production payments, website and backend unchanged.

## Verification

- **44 mobile tests passed**: 35 prior tests plus 9 staging URL, token separation, GET-only, access control, path injection, CSV pagination and response-boundary tests.
- **37 isolated PostgreSQL integration tests passed**: existing order-idempotency, simulated KoraPay, reconciliation and report/export contract tests. Temporary cluster removed after test execution.
- Mobile TypeScript and ESLint passed; source formatting checks passed.
- Android and iOS Expo/Hermes JavaScript bundle exports passed. These are **not** native APK/IPA installation tests, nor do they verify the screen on an actual device.
- No actual KoraPay sandbox or live payment was attempted; no dedicated sandbox admin token or staging server was available to connect this UI to an authenticated running preview service.
- No Figma design comparison was possible in this milestone, so the screen uses existing EaziCart design tokens without claiming pixel-perfect Figma fidelity.

## Safe usage for a future developer testing session

1. Provision an **isolated, approved staging server** with an admin auth system and the already reviewed read-only routes; do not use production customer accounts or credentials.
2. Configure `EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW=1` and `EXPO_PUBLIC_EAZICART_ADMIN_AUDIT_PREVIEW_BASE_URL=https://<approved staging host>/api` in a development build only.
3. Paste the disposable staging ADMIN bearer token into the preview screen; do not store credentials in public Expo environment variables.
4. Verify the role-revocation path, authentic audit data, CSV pagination, device rendering and network fault handling, and manually compare the UI to the existing Figma system.
5. For official KoraPay sandbox verification, use dedicated sandbox merchant credentials on an approved isolated backend and current provider documentation for initialize, verify and webhook signatures. Never place a merchant secret in mobile code.

## Blockers

- Staging read-only admin routes are not deployed as a running service. The developer screen cannot fetch real results yet.
- Official KoraPay sandbox transaction lifecycle has not been exercised; prior provider tests use synthetic responses only.
- Real native development-build, simulator and physical-device tests remain outstanding.
- Production KoraPay order/idempotency migrations, payment endpoints and native payment button remain disabled; production changes require fresh explicit approval.
