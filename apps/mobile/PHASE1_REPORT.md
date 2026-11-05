# EaziCart Native — Phase 1 Milestone

Status: Implemented in an isolated staging branch, **not deployed**.
Date: 2026-11-05.

## Architecture

- React Native 0.88.1 / Expo SDK 58 / Expo Router with TypeScript.
- TanStack Query handles paginated public feed, product details, search, seller profile and saved products.
- API base defaults to `https://eazicart.com/api`, configurable through `EXPO_PUBLIC_EAZICART_API_BASE_URL`.
- Uses existing login/register/session/logout flows. Refresh token persists in Expo SecureStore; bearer access token is memory-only.
- Design uses approved EaziCart orange `#F97316`, with app logo derived from existing web Figma export.

## Implemented

- Native Home feed: cursor pagination, pull-to-refresh, cover images, counts, share/save/comment/like actions with correct approved order; Like at far right, red.
- Discover: server-powered product search and grid.
- Account: registration, login, restore, sign out.
- Product: native horizontal multi-image gallery, price/discount display, seller and comments links.
- Seller: storefront, bio, counts, three-column product grid.
- Comments: read, pagination and authenticated posting.
- Expo development build config, iOS and Android native prebuild.

## Existing APIs integrated

`/health`, `/auth/login`, `/auth/register`, `/auth/session`, `/auth/logout`,
`/feed/products`, `/products`, `/products/:id`, `/sellers/:id`,
`/sellers/:id/products`, `/products/:id/comments`, `/saved-products`,
`/saved-products/:productId`, `/products/:id/like`.

## Verified

- `pnpm --filter @eazicart/mobile test`: 5 tests pass (mocked fetch and auth edge cases).
- `pnpm --filter @eazicart/mobile typecheck`: passes.
- `pnpm --filter @eazicart/mobile lint`: passes.
- `pnpm --filter @eazicart/mobile export:android`: Android Hermes bundle exported.
- `pnpm --filter @eazicart/mobile export:ios`: iOS Hermes bundle exported.
- `expo prebuild --no-install --platform all`: generated native Android and iOS project directories (not a signed device binary).
- `pnpm --filter @eazicart/mobile test:live:read-only`: GET-only API contract smoke tests, no writes.

## Not yet implemented / blockers

- Native Reels, Stories, follow/unfollow UI, advanced social state, view-event telemetry, and complex gallery gestures.
- Cart, checkout, KoraPay payment verification, seller publishing, upload, chats, notifications and analytics.
- Approved Figma screen-to-screen sign-off, dark mode approval, accessibility audit, profiling and performance measurement.
- iOS Simulator/Android Emulator and physical device testing: requires supported runners/devices.
- Apple and Google store provisioning, app association domains, real native push credentials, staged developer accounts.
- No live-user authentication or payment test performed (avoids altering customer records).

## Release guardrails

- No changes to existing backend code, database, wallets, payments, production service or live website.
- No production deployment or App Store / Play Store publication.
- Existing root checkout with uncommitted work was not modified.
