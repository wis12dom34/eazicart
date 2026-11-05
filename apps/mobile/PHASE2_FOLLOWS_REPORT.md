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

## Test and review

- Run pnpm --filter @eazicart/mobile lint
- Run pnpm --filter @eazicart/mobile typecheck
- Run pnpm --filter @eazicart/mobile test
- Run pnpm --filter @eazicart/mobile test:live:read-only
- Run pnpm --filter @eazicart/mobile export:android / export:ios
- Run pnpm exec prettier --check apps/mobile/src apps/mobile/tests apps/mobile/PHASE2_FOLLOWS_REPORT.md

## Not verified on device

- Physical device and emulator installation; iOS simulator; 60 FPS; touch gestures and account mutation integration against non-production credentials.
- Story heart/view endpoints not available from existing inspected backend. No counterfeit social metrics.
- No production write/migration/deployment or store publication.
