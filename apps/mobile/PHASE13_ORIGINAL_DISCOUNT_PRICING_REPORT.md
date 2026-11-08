# EaziCart Native — Phase 13 Original and Discounted Pricing

Date: 2026-11-08
Status: **isolated development branch only** — no production database migrations, API releases, payment activity, or app-store distribution.

## Checkpoint
Parent: `feat/eazicart-native-seller-fulfillment-20261108`, commit `00631e67a0f32d924de9f746b104c6c56255c507`.

## Audit findings
- Earlier native product cards, product pages and cart already supported display of `originalPrice` and `discountPercent`, but the checked Prisma Product model and Fastify product endpoint did **not** store or return these fields.
- The actual selling price is `Product.price` and it already drives cart unit prices, cart totals and order item prices. Preserve that behavior.
- The checked API has no secure general-purpose product photo-upload endpoint. No photo upload functionality was falsely added.

## Implemented
- New additive nullable `Product.originalPrice` decimal field and check constraint requiring original price to be strictly greater than selling price. Existing product rows remain valid because default is null.
- Existing authenticated product create/update routes now accept an optional original price. API rejects equality or lower original prices, including edited sale prices that conflict with a previously stored original price.
- Product serialization returns current selling price, original price (or null) and a calculated percentage discount, without modifying existing product price/cart/checkout calculations.
- Native seller product editor now includes optional original-price entry, prefills it from owned inventory, clears it by sending null, and validates decimal values using integer cents before save.
- Existing images remain untouched by product form updates; archive status is unchanged.
- No new payment, KoraPay, checkout or media upload functionality activated.

## Verification
- Existing migrations plus additive discount-price migration applied **only** to ephemeral PostgreSQL 16 container `eazicart_discount_synthetic` on localhost port 55433.
- Prisma migration/schema diff **no difference**; database package build/typecheck **PASS**.
- Fastify API/PostgreSQL tests **5/5 PASS**: signed-out rejection, invalid original price, discounted creation and serialization, cart charging selling price rather than original price, invalid sale-price edit, ownership checks and discount removal.
- Scoped API TypeScript and scoped lint **PASS**. Pre-existing unrelated malformed Kora staging test excluded only in temporary local QA tsconfig; config removed before commit.
- Native TypeScript **PASS**, lint **PASS**, native tests **82/82 PASS**.
- Expo Android Hermes JS/asset export **PASS** using `EXPO_PUBLIC_EAZICART_API_BASE_URL=https://fixture.invalid/api`. This export is not a store-ready Android bundle.
- No actual customer cart/order or payment data modified, no live API or real-device QA, and no iOS Xcode build.

## Outstanding
- Secure product image upload service (media scanning, size/type constraints, storage authorization, retention, rate limiting), native picker and product photo ordering.
- End-to-end staging tests for cart/checkout and seller price edits after original-price migration, partial updates, concurrent price changes and discounts.
- Verified native KoraPay checkout remains review-only; do not enable payment acceptance on the app before a safe staging checkout.
- Store-ready AAB and iOS distribution build with approved identities, Figma comparison and physical device QA.
- Explicit separate approval required before production migration, API deployment, native distribution, or Play/App Store submission.
