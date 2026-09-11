# Customer Home fidelity review

Source: [EaziCart Customer Home, node 1:6](https://www.figma.com/design/747q8npBh3lvQTo9HPKYY8?node-id=1-6).
Design context and screenshot inspected after the PostgreSQL customer flow
passed CI. The source mobile frame is 430 × 932.

## Applied in the separate navigation pass

- Reused existing house, search, play-square, bag and user glyphs at 24px.
- Set the floating navigation to 64px high, 24px corners, an opaque white
  background, the source border color and a subtle 2px/5px shadow.
- Matched 11px labels, 14px line height and 5px icon/label spacing, with
  semibold active and regular inactive labels.
- Matched 20px horizontal clearance while preserving responsive sizing and
  at least 44px touch targets. Added safe-area-aware scroll clearance.
- Replaced hardcoded Home category destinations with live API category
  slugs; this preserves the existing layout and makes those links work.

Browser checks cover the full customer flow at desktop and 430px mobile
widths, plus navigation dimensions, touch targets, product scroll clearance
and Home-to-category filtering. Home screenshots are saved as CI artifacts.

## Remaining Home differences

The current Home implementation still uses the earlier promotional hero and
trending-product layout. The Figma source instead has a centered logo,
search-first header, category strip and seller-grouped product feed with
Follow and Add to Cart controls. Product-card dimensions and typography
also differ. This navigation pass does not claim complete Home fidelity.

A subsequent Home implementation pass should reuse the verified API clients,
authentication and product components, preserving customer flows. It should
source the exact logo and icons from Figma, use real catalog data and avoid
hardcoding example seller verification badges, stock or prices. PR #4 can
be reviewed as reference material without merging its overlapping Home.
