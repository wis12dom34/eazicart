# EaziCart Native — Seller Following Milestone

Date: 2026-11-05
Status: Development branch only; no web/API/database changes or deployment.

## Implemented

- Added native seller Follow/Following controls to storefronts.
- Reused the backend's seller **user ID** for follow/unfollow/count endpoints, not SellerProfile.id.
- Added a Following screen and a Profile -> Shops you follow shortcut.
- Shows authenticated follow status from /following and current follower count from /sellers/:sellerUserId/followers/count.
- Sign-in required for mutations; seller cannot follow their own profile.
- Handles response conflicts for duplicate follow/unfollow and refreshes remote state.
- Retains original Home feed, Reels, Stories, payment architecture, and Figma palette.

## Backend endpoints used unchanged

- GET /following (authenticated)
- POST /sellers/:sellerUserId/follow (authenticated)
- DELETE /sellers/:sellerUserId/follow (authenticated)
- GET /sellers/:sellerUserId/followers/count (public)

## Verified checks

- `pnpm --filter @eazicart/mobile lint`: passed.
- `pnpm --filter @eazicart/mobile typecheck`: passed.
- `pnpm --filter @eazicart/mobile test`: 17/17 mocked API-contract tests passed.
- `pnpm --filter @eazicart/mobile test:live:read-only`: passed (GET requests only, including follower counts).
- Expo Android Hermes JavaScript bundle export: passed.
- Expo iOS Hermes JavaScript bundle export: passed.
- Prettier source and tests formatting checks: passed.
- Bundle exports are not signed or device-installable binaries.

## Not verified on device

- Physical device and emulator installation; iOS simulator; 60 FPS; touch gestures and account mutation integration against non-production credentials.
- Story heart/view endpoints not available from existing inspected backend. No counterfeit social metrics.
- No production write/migration/deployment or store publication.
