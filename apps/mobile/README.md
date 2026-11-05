# EaziCart Native Mobile

Real native React Native + Expo Router application sharing the existing EaziCart HTTPS API.

## Development

Run `pnpm install` at the monorepo root. Configure `EXPO_PUBLIC_EAZICART_API_BASE_URL` for local/staging API when available. Then run `pnpm --filter @eazicart/mobile start`. Expo development builds require the native development client.

## Security

Only the refresh token is persisted, via Expo SecureStore. Access tokens live in memory. Never copy server KoraPay secrets into this app. No database or server migration is required.

## Milestone scope

Home feed (real cursor pagination), existing-account login/registration/session restoration, product details/gallery, public search, seller storefronts, product Likes, Saves, comments and native sharing. Reels, stories, seller tools, cart and checkout are intentionally deferred.

## Release safety

Do not deploy apps to stores or modify the existing live web/API without explicit approval. This is an isolated development branch, not a production build.
