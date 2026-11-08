# EaziCart Native — Phase 8 Chat Block and Android JS Export

Date: 2026-11-08
Status: **isolated GitHub development only**; no production deployment, database migration, push notification, APK distribution or store release.

## Baseline
Parent: `feat/eazicart-native-chat-reliability-20261108` commit `ab725e25cce51fe61bc2c0a1df98da62b0c023d9`. Development branch follows that checkpoint; production has not received the preceding native chat migrations.

## Scope
- New additive Prisma migration storing a separate buyer/seller blocked timestamp on conversations.
- Protected `PATCH /conversations/:id/block`, authenticated and participant-scoped; outsiders get 404.
- Transactional sender enforcement rejects **all new sends** if either participant blocks the conversation, even when the other participant sends from another device. Verified previous idempotent duplicate replies remain intact.
- Native conversation screen includes a confirmation-based Block/Unblock control and disabled send button when either party has blocked the chat.
- Chat history remains readable by its participants; unblocking restores the ability to send. This is a per-conversation block, not account-wide harassment moderation or reporting.

## Evidence
- Prisma schema validation **PASS**.
- All existing migrations plus the additive Phase 8 migration applied only to a temporary disposable PostgreSQL 16 database bound to localhost:55432. Prisma schema diff **no difference**.
- PostgreSQL messaging tests **10/10 PASS** (including outsider-denial, blocked sender, unblocking and prior send rate-limiting).
- Native tests **69/69 PASS**; native TypeScript **PASS**; native lint **PASS**.
- Scoped API TypeScript **PASS** and scoped messaging lint **PASS**; the temporary QA TypeScript config omitted only the unrelated pre-existing malformed Kora staging test file.
- Android JavaScript/asset export: `pnpm --filter @eazicart/mobile export:android` **PASS** with `EXPO_PUBLIC_EAZICART_API_BASE_URL=https://fixture.invalid/api`. Generated a Hermes bundle (~3.3MB), 1,435 modules. The URL is deliberately non-production and invalid; the exported bundle is **not usable for real API connections**.
- **No APK build, no Android emulator/device QA, and no iOS simulator/device QA**. Java, Android SDK/ADB and Gradle are absent on this authorized Linux validation host.
- Full repository lint/typecheck still has unrelated pre-existing KoraPay syntax/lint blockers. Figma exact comparison unavailable due connected plan limit.

## Outstanding
- Install JDK/Android SDK on an explicitly approved isolated runner; generate real signed/unsigned development APK with an approved staging API, then run actual Android device/emulator tests.
- iOS build requires eligible macOS/Xcode or approved hosted build and real-device testing.
- Per-conversation block UI/UX, app background/resume, network interruption, privacy/moderation workflows, reporting, platform safety controls, staging API and production migration review.
- Production deployment remains blocked pending separate explicit approval.
