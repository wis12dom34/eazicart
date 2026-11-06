# EaziCart Native — Loopback Finance Audit Integration

Date: 2026-11-06
Status: **Isolated testing only. Not deployed, merged, or published.**

## Completed

- Added a true HTTP integration test in `apps/api/src/modules/payments/isolated-kora-staging.postgres.test.ts`. This runs the existing native `makeAuditPreviewClient` against a temporary Fastify HTTP listener bound **only to 127.0.0.1**, using an automatically destroyed `pg_virtualenv` PostgreSQL cluster.
- A dedicated ephemeral Fastify server registers **only** the existing read-only reconciliation endpoints under the `/api` prefix expected by the mobile client. It explicitly does **not** register order creation, checkout initiation, payment settlement, or webhook write routes.
- The real HTTP exchange covers a test-only administrator's report, UNKNOWN filtered claims, observation-only provider probe via synthetic GET fetcher, CSV text response, and rejection of ordinary buyer and unrecognized principal tokens.
- Verifies no changes to counts of orders, payments, or notifications. The provider call count changes only once for the explicit read-only evidence probe.
- Added `apps/api/src/test-support/expo-dev-global.d.ts` to compile the Expo client under the isolated API integration test's TypeScript environment. No app or payment source behavior changed.

## Tests performed

- **38/38 PostgreSQL integration tests passed** (the existing 37 plus the new real-HTTP native-client test). Temporary database cluster automatically destroyed.
- **44/44 mobile regression tests passed**.
- API and mobile type checking and linting: passed.
- This milestone did **not** require a production API migration, deployment, real charge, wallet mutation, or mobile UI change.

## Android testing constraint

- The connected Contabo VPS has no detectable Android SDK, Android emulator or `adb` installation. Therefore no Android emulator, signed APK, physical Android device or native development build was exercised. Previous Expo JavaScript exports are not installable Android builds.
- A developer with a configured Android SDK/AVD or physical development device must run the existing `expo run:android` workflow against an **approved, access-restricted staging environment** before claiming device validation.

## Remaining work

- Provision a separate, authorized, isolated staging backend reachable to a development device; localhost on the VPS is **not** device-accessible and is not an externally available deployment.
- Add production-grade staging auth with separate disposable administrator credentials and authenticated user lifecycle; the current isolated test credentials are fixtures only.
- Verify UI accessibility, CSV sharing UX, screen rotation, Android system back, offline/timeout behavior and Figma fidelity on actual devices.
- Perform **official** KoraPay sandbox verification with separately approved sandbox credentials; current provider responses are synthetic.
- Do not activate production checkout, run production migrations, or deploy/publish the app without explicit user approval.
