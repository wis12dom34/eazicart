# EaziCart Native — Phase 10 Seller Center Read-only Checkpoint

Date: 2026-11-08
Status: **isolated branch only — not deployed, not released, no production database migration**.

## Starting commit
`7621eacebbd7ead1ae9cee4a16af0e24fe400843` from `feat/eazicart-native-android-apk-20261108`.

## Implementation
- New Seller Center from existing authenticated `GET /seller/dashboard` showing the seller's inventory totals, order statuses, customer count and paid-revenue summary when available.
- New My Inventory screen from existing authenticated `GET /seller/products`, including stock levels and unpublished listings. Read-only; unavailable/unpublished products do not navigate into public buyer detail pages.
- New Store Orders screen from existing authenticated `GET /seller/orders`, including permitted customer name, order items, date, fulfillment status and seller subtotal. Read-only; no order status updates or payments initiated.
- Seller Center access linked from native account profile when authenticated `GET /seller-profile` returns an existing seller profile. Existing customer/buyer navigation is preserved; non-sellers do not see the seller link.
- Existing EaziCart native colors, components, routes and query authentication used. No Figma redesign, external web view or backend route invention.
- All endpoints are authenticated with the existing mobile access token; API-side seller ownership restrictions remain the source of truth.

## Verification
- Frozen lockfile dependency install completed in an isolated temporary VPS clone.
- Native TypeScript check **PASS**, ESLint **PASS**, Node native tests **72/72 PASS** (3 new seller-specific tests).
- Seller API tests verify signed-out requests fail before any network call, bearer-authenticated paths match existing backend contracts, and non-seller HTTP 403 propagates.
- Android Expo JavaScript/asset export **PASS**, using deliberately invalid `EXPO_PUBLIC_EAZICART_API_BASE_URL=https://fixture.invalid/api`; Hermes bundle ~3.3 MB. The export is not installable and cannot connect to production.
- No live user/order/payment tests, no physical device tests, no iOS app build, no store submission.

## Important unfinished work
- Native checkout is intentionally **review only** until the actual active KoraPay route is securely verified. The checkout screen must never be presented as taking payment.
- Seller registration, product creation/editing, image uploads, order fulfillment writes and seller support/analytics drill-downs need separate implementation and testing.
- Production-ready Android AAB, iOS signing/build, Figma verification, TestFlight/Play internal testing, robust login/payment lifecycle, real device slow-network tests, app policies and moderation remain.
- GitHub-hosted Android QA APK workflow from Phase 9 is independent; its completion or artifact has to be checked separately. Do not call the app store-ready on the basis of a JS export or the isolated unit tests.
- Do not merge or deploy to production without explicit approval.
