# EaziCart Native — In-App Notifications Inbox Checkpoint

Date: 2026-11-08
Status: **Isolated development branch only**. No deployment, Android/iOS binary build, payment activation, notification push delivery, database migration, or production API change.

## Baseline
- Parent: `bd0c0764b3d12fb7a68805113645222bd0d7ac10` on `feat/eazicart-mobile-explicit-api-20261107`.
- Native app: Expo Router / React Native / TypeScript, **not a WebView**.
- Existing backend contract from `apps/api/src/modules/notifications/index.ts`: authenticated GET `/notifications`, PATCH `/notifications/:id/read`, PATCH `/notifications/read-all`.
- Existing web counterpart: `apps/web/app/notifications/page.tsx` uses All, Orders, Social, Updates categories and a 99+ unread count.
- Figma MCP Starter-plan tool-call limit blocked direct Figma inspection on 2026-11-08. This implementation follows the existing Figma-mapped web notifications UX and existing native theme; pixel-perfect comparison to Figma is **not** claimed.

## New Native Behavior
- In-app notifications route with user-scoped query cache, refresh, loading/error/empty states, four filters, unread indicators, accessible tap targets, and read actions only after server confirmation.
- Bell in the authenticated home feed with unread count capped visually at 99+, plus profile navigation.
- API methods use the existing authenticated backend endpoints. User-supplied notification ID is URL encoded. No API fallback to production; no push token collection or background push.
- Signed-out users cannot fetch or mutate private notifications.
- Added mocked API tests and pure filter/time-display tests. No live user data was accessed.

## Verification
- In a separate isolated clone under `/tmp/eazicart-native-qa-20261108`, checked out exact development commit `e6e6b06955e22609d44d25bfa3a1e0176a1450d8` and installed frozen-lockfile dependencies via pnpm 10.28.1 with `--ignore-scripts`.
- Initial validation caught two React Native `FlatList` prop type issues, unsafe environment-URL typing, and a test assertion typing issue. Corrected these and formatted the scoped files without changing production API behavior.
- Reran the following against the amended local workspace: `pnpm --filter @eazicart/mobile typecheck` **PASS**, `lint` **PASS**, `test` **PASS (61/61 tests)**, and `prettier --check` on changed mobile files **PASS**.
- Local `git diff --check` **PASS**. Corrections were restricted to 7 mobile files; no server, web, database, migrations, payment, or production deployment changes.
- **Not run:** Android APK build, physical-device QA, iOS/Xcode checks, full monorepo test/build suite, or end-to-end staging API tests. A success reported by unrelated CI statuses must not be construed as native mobile QA.
- Existing staging/Android safety gates from the prior checkpoint still apply.

## Next Gates
- Verify typecheck + mobile tests in a dependency-equipped isolated CI runner.
- Compare inbox screen directly against EaziCart Figma once connector access is restored.
- Test auth transitions, read/read-all, refetch after offline, unread counts and accessibility on Android/iOS against approved nonproduction HTTPS API and synthetic users.
- Do not trigger deployment or notification delivery without separate approval.
