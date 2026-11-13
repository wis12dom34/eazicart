# EaziCart Native — Phase 30 Checkout Review Integrity

Date: November 13, 2026. Phase 29 baseline commit `1b136a25501debac033c62ca88acf8bb01f1b2e3`.

## Reproduced checkout-review issue
The native `cartFingerprint` only compared product ID, quantity, unit price, subtotal and total. A seller could change available stock, disable an item, or change the selected variant, item line total or delivery/service fees while keeping the same top-line total; the native checkout screen could incorrectly tell a buyer their cart had not changed.

## Fixes
- Expand the stable, order-independent cart snapshot to include cart ID, cart item ID, product ID and variant, quantity, unit and line prices, product price, stock availability, product active status, subtotal, delivery fee, service fee and total.
- Normalize missing variant/fees to null and sort by product/item/variant to avoid false changes when the server reorders the cart items.
- Refuse fractional, negative, non-finite or unsafe-integer item quantities and stock counts in review eligibility.
- Require freshly fetched cart to still pass `canCheckoutReview` before stating that the review is current.
- The **isolated fixture-only** checkout coordinator uses the same canonical cart fingerprint for idempotency-key intent comparison, preventing a previously prepared key from silently representing a changed variant, stock or fee.
- Production native checkout remains disabled. There are no payment or order-creation endpoints exposed by this app.

## Verification
- Before change, four new targeted commerce regressions failed: variant switch, stock/active change, fee/line-total/item identity change, invalid quantity/stock.
- After fix, checkout and commerce targeted tests: 25/25 passed, including new fixture coordinator tests for idempotency replay after changes and changed stock.
- Full native client test suite: 110/110 passed (103 baseline plus seven new cases).
- Existing native build-safety tests: 64/64 passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint `--max-warnings=0`: passed.
- Prettier and `git diff --check`: passed.

## Limits and safe continuation
- This is a review-only development branch. No merge, live deployment, new user API calls, payment processing, order initiation, database migration, data modification, app signing, simulator build or App Store/Play Store publication took place.
- The available two connected Linux devices are production VPSs and the connected Mac is offline. No authorized dedicated native runner or real device QA was available.
- The app still needs an approved isolated Android build environment, macOS/Xcode environment, disposable staging backend and physical-device testing. Separately approve any production KoraPay payment activation and preserve Paystack historical records.
