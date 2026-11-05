# EaziCart Native — Cart & Checkout Review Milestone

Date: 2026-11-05
Status: Implemented for isolated development only. Not deployed or published.

## Completed

- Native Cart tab with real authenticated EaziCart cart endpoints.
- Native Add to Cart from product details; quantity increase/decrease, item removal and clear cart.
- Stock limits, discounted product prices, existing server totals, loading/retry states.
- Delivery addresses: real authenticated GET, create, and delete; selection on checkout review.
- Read-only buyer order history backed by existing /orders.
- Checkout review screen uses latest cart data and detects price/quantity changes before any potential order placement.
- Checkout screen explicitly blocks payment initiation and order creation.
- Existing Home, Reels, Stories, Following, approved mobile action order, and design tokens preserved.

## Backend endpoints reused without modification

- GET /cart
- POST /cart/items
- PATCH /cart/items/:itemId
- DELETE /cart/items/:itemId
- DELETE /cart
- GET /addresses
- POST /addresses
- DELETE /addresses/:id
- GET /orders

## Important payment blocker

Inspection of apps/api/src/modules/payments/index.ts showed the current /payments/initialize endpoint calls initializePaystack. A KoraPay candidate/preview implementation also exists in the repository, but its production activation is not verified. The mobile app does **not** call payment initialize, payment verify, or POST /orders. Do not enable payment or order creation until a verified, approved, idempotent production KoraPay path exists.

## Verification

- 24 unit/contract tests pass, including 7 new cart/address/checkouts tests.
- TypeScript typecheck passes.
- ESLint passes.
- Read-only production API smoke checks pass; no production cart/order/payment mutation test was attempted.
- Android and iOS Hermes JavaScript bundles exported successfully; these are not signed APK/IPA files.
- Source formatting checks pass.

## Limits

- Native device, simulator, and accessibility/FPS profiling remain untested (no connected mobile runner).
- Authenticated real-cart/cart-address mutation testing must use dedicated staging accounts and an isolated non-production environment.
- No native checkout payment authorization, order creation, or order tracking activation.
- No backend files, production database, customer wallets, website, payments, or services modified.
