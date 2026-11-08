# EaziCart Native — Phase 11 Seller Product Editing

Date: 2026-11-08
Status: isolated GitHub development branch; **not deployed or distributed**.

## Exact baseline
Parent `feat/eazicart-native-seller-center-20261108` commit `f8daa5cd7c64ba272df94cd1cc85c748e4b8a1ee`.

## Development scope
- Native Seller Inventory now has an Add Product entry point, and every existing listing (including unpublished products) opens the native edit form.
- Native editor supports product name (2–160 chars), description (up to 5,000), naira price with up to two decimals, stock (nonnegative whole number), and selection from real existing product categories.
- It calls the existing authenticated seller-only Fastify product create, patch, and soft-archive endpoints. Backend product ownership checks remain authoritative and unchanged.
- Editing intentionally omits the `images` field so existing product photos are not replaced or deleted by the API's image-array patch behavior. Unpublishing requires a destructive action confirmation and doesn't delete product orders or re-publish an archived product.
- Added input normalization and validation before sending requests; the server keeps final validation.
- No image-upload feature was invented: current backend has no general native product-photo upload endpoint. That is a separate incomplete piece, as is safely reactivating archived listings.

## Isolated checks
- Frozen-lockfile pnpm dependency installation completed.
- Native TypeScript **PASS**; native lint **PASS**.
- Native tests **77/77 PASS**, including five tests for field validation, signed-out write prevention, authorization paths, image-preserving patch payload and denial for another seller's product.
- Android Hermes JS/asset export **PASS**, using intentionally invalid `https://fixture.invalid/api` as base URL. Not a standalone APK or real server integration test.
- No database migration, production API deployment, real user order or payments test, iPhone build, physical device QA, Play Store or App Store submission.

## Outstanding
- Secure seller-owned product-image uploads and previews, backend media checks/rate limits, and linked app UI.
- Discounted/original pricing parity, product variant support, safe product republish flow if allowed, category navigation and media order/reordering.
- Seller fulfillment actions and KoraPay native checkout are not production-verified; checkout stays deliberately review-only.
- Real staging API and synthetic seller/buyer test accounts, Android and iOS physical-device tests, Figma verification and store-ready AAB/IPA builds.
- Keep unrelated data and live deployments unchanged; request approval before production deployment.
