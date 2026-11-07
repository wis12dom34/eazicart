# Subscription verification candidate review

Prepared 2026-11-06. **Candidate only; not ready for production approval.**

Checkout: `/workspace/eazicart-candidate`, branch `feat/subscription-verified-badges`, base `cfbe138985c57c6a83bb9751c43c297f303615b5`. GitHub was cloned using terminal/gh. No MCP, deployment, production restart, production migration, live payment, billing-rule change, or historical transaction update was performed. The initial checkout was clean; unrelated tracked files were preserved.

## Source and production audit

Read `apps/web/AGENTS.md` and the installed Next.js `use-client` guide. No other AGENTS.md was found in the available repository/workspace. `/opt/eazicart/source` is absent locally. There is no SSH host, username, configuration, or key in this workspace; the reply “Yes” did not supply connection coordinates. Therefore live service working directories, release symlinks, reverse proxy targets, deployed commits, and VPS-local changes **remain unverified**. Do not infer them from GitHub main or the supplied source path.

Rechecked GitHub schema and routes: SellerPlan BASIC/PRO/BUSINESS; SellerSubscription PENDING/ACTIVE/CANCELLED/EXPIRED; nullable start/end dates; newest-record subscription summary; no customer ownership/suspension/payment evidence before this candidate. `apps/api/src/modules/payments/index.ts` implements **Paystack**, including provider verification, signed webhooks and serializable order settlement. The base checkout contains no KoraPay path. Newer remote-branch KoraPay drafts were inspected during the continuation below; they are explicitly unregistered candidates, not evidence of the current live release. Payment is order-linked. Subscription UI has no working purchase action. These facts describe this checkout, not the inaccessible production release.

## SVG and Figma evidence

Both existing SVG roots are exactly 16×16 with `viewBox="0 0 16 16"`.

- `apps/web/public/figma/verified.svg`: scalloped gold `#FFD400` silhouette plus white checkmark. Used byte-for-byte for Business. SHA-256 `96ccac068f8d03346b348c0ead1e6a0010b5bb87e8a51d82c8e64fcba519b26b`.
- `apps/web/public/figma/gold-badge.svg`: gold silhouette only, without checkmark. Preserved unused. SHA-256 `0872035b1585fb38aab81269ed02ba1809d8fed3b6df15268a6779aaf2dd17f4`.
- Existing historical design evidence: `docs/figma-verification/REPORT.md`, reference file https://www.figma.com/design/747q8npBh3lvQTo9HPKYY8 and its repository captures. This does not establish current badge parity.

**Pro asset supplied and approved by the user in a follow-up.** `apps/web/public/figma/eazicart-pro-blue-badge.svg` is copied byte-for-byte from the attached `eazicart-pro-blue-badge-traced.svg` (SHA-256 `e0c513de34a4ab9ac015c7d16206e460ad0e541f76680608ae784d2864a08e60`). Its original viewBox `256 0 1024 1024`, paths, transparency, blue `#007CF7`, and thick white checkmark are preserved. The SVG describes itself as a raster trace, not an original Figma export; the user explicitly authorized its use. Pro is now enabled in the shared component using the same server-derived eligibility and existing reserved dimensions. No layout CSS was changed. Current gold/Figma confirmation remains unavailable. Candidate spacing is 4 CSS px; sizes are 16/20/24 CSS px, preserving SVG proportions. Exact current Figma parity is not claimed.

## Eligibility and payment security

One `resolveBadge` function handles active and paid-cancelled records with inclusive start and exclusive end. BASIC, pending, expired, future, missing-settlement, failed-payment, and suspended records yield no badge. Account suspension overrides all records. Business wins over valid Pro, regardless of record creation order. Effective periods govern upgrades/downgrades; the metadata expires at the next period/start boundary. A newer pending/future record cannot mask a valid paid subscription. Seller summary now prefers the valid paid record before its newest-record fallback.

The existing SellerSubscription remains the membership model. Additions are optional account ownership, account/subscription suspension timestamps, and SubscriptionPayment as payment-intent/settlement evidence. The order Payment table and order callbacks are unchanged. They cannot activate subscriptions.

The internal `activateSubscription` guard checks persisted intended owner, subscription, plan, provider, reference, positive amount in integer minor units, currency, successful status, settled time, transaction identity and valid stored period. Serializable transaction, conditional updates and unique provider transaction constraints prevent double activation/spending. Replays return the existing result without extending dates, clearing suspension or undoing cancellation. Renewal requires a new subscription period/payment intent; never overwrite a historical paid period.

**No public activation route or checkout was added.** The guard accepts evidence from a future trusted provider-verification adapter; it is not itself a KoraPay API verifier. Provider ownership/metadata verification, intent creation and production KoraPay settlement remain blocked until the actual production code and provider contract can be inspected. Isolation tests do not establish provider certification or live payment behavior.

## Public data and caches

Existing server-created seller/account DTOs receive only `badge: null | { variant, expiresAt }`. The server serializer batches unique account IDs through one Prisma lookup operation (Prisma can execute several constant-count relation queries), rather than querying per post. Relevant active/cancelled future-ending records are fetched with a narrow selection. Public RSC catalog serializers retain only minimal metadata.

`POST /verification/badges` is a read-only public batch lookup (maximum 1,000 bounded account IDs; strict body rejects tier fields). It never awards entitlements. Badge-bearing responses and batch lookups use `private, no-store`; existing public catalog fetches already use `no-store`.

One shared client scheduler refreshes all mounted account names in batches every 30 seconds and on focus/visibility return. Known expiry boundaries trigger local hiding and a refresh. Failed refresh hides badges. There is no per-post entitlement request, timer, or global focus listener. Background-tab timers can be throttled by the browser; focus/visibility handling re-evaluates expiry. Administrative changes in already-open tabs become visible on the next batch/focus response, **not via instantaneous push**. Browser clock manipulation cannot grant server privileges; display expiry uses browser time between server refreshes.

## Shared UI and surface inventory

VerifiedBadge uses the exact available SVG, reserved dimensions, inline optical alignment, accessible membership wording, desktop hover, keyboard focus/activation, touch tap, Escape and outside dismissal. Tooltips render in a fixed portal to avoid clipped name containers and dismiss on viewport scroll/resize. Click/keyboard activation prevents parent-link navigation. Pointer movements are not intercepted. Both Pro and Business rendering are covered by the browser suite.

| Requested surface | Real file(s) inspected/integrated | Status |
| --- | --- | --- |
| Home feed | `apps/web/app/home-content.tsx`, `home-sections.tsx` | Product seller names and seller cards integrated |
| Reels | `apps/web/app/reels/page.tsx` | Real seller names and comments integrated; external attribution receives no seller badge |
| Stories | `apps/web/app/home-content.tsx` story strip | Existing seller shortcuts integrated; no story service/viewer exists |
| Seller profiles | `apps/web/app/seller/[id]/seller-content.tsx` | Integrated |
| Customer profiles | `apps/web/app/profile/page.tsx`, `seller/customers/[id]/page.tsx`, `seller/customers/page.tsx` | Existing own-account and seller customer detail/list integrated; no general public customer-profile route |
| Product seller names | `apps/web/app/product/[id]/product-content.tsx`, `components/product-card.tsx`, `components/discovery-product-card.tsx` | Integrated |
| Account search | `apps/web/app/search/search-content.tsx` | Existing seller search integrated; no general customer search service |
| Comments and replies | `apps/web/app/reels/page.tsx` | Comments integrated; replies do not exist in schema/UI |
| Chat lists/headers | `apps/web/app/chat/page.tsx` | Empty-state only; no conversations, headers, message API or message model to integrate |
| Followers/following | `apps/web/app/following/page.tsx` | Following integrated; backend exposes follower count only, no follower list |
| Marketplace cards | `apps/web/app/explore/explore-content.tsx`, `category/[slug]/category-content.tsx`, `explore/map/explore-map.tsx`, `saved/page.tsx`, shared product cards, home sections | Integrated |
| Business storefront | seller public profile and `apps/web/app/seller/store/page.tsx` preview | Integrated |

No new chat, replies, story system or social directory was invented. Feed action order, routes and controls were retained. The expanded browser suite exercises badge rendering and existing layout bounds in home/story shortcuts, Explore seller cards, category sellers, seller profiles, product details, following, saved, own-account profiles, seller customer details, store preview, reels/comments, and selected map details. MapLibre is stubbed for the map-detail UI check; external tiles, geolocation, and WebGL rendering are not validated. Complete functional regressions, swipe gestures and physical-device safe areas remain untested; screenshots do not establish current Figma parity.

## Migration and backfill

Prepared `packages/database/prisma/migrations/20261106190000_subscription_verification/migration.sql`. Applied only to a disposable PostgreSQL 17.11 instance initialized in `/workspace/verification-db`, loopback port 55437. All ten migrations applied successfully from scratch, including the new one. Existing production upgrades are not tested against a production snapshot.

Existing seller rows retain their seller ownership. Exactly one of sellerId/accountId is required. Nullable accountId/suspension columns default to null. SubscriptionPayment is separate from the unchanged order ledger and links one intent to one existing-model subscription period. Unique reference/provider transaction constraints and positive-amount/paid-tier/settlement checks are included. The valid-period CHECK is `NOT VALID` to preserve historical invalid periods while rejecting new invalid writes; audit legacy rows before validating it.

**No automatic paid-history backfill.** Existing ACTIVE rows without trusted subscription settlement evidence receive no badge. Do not infer subscription payments from product orders, a seller-selected plan, creation date, or user role. A future reviewed backfill must reconcile provider references, owner, intended plan, amount/currency and actual period; retain evidence and exclusions. Admin suspension fields are supported, but no new admin UI/action endpoint was created.

## Actual validation

- Database Prisma generation and database TypeScript build: passed.
- API TypeScript check/build: passed. API suite with explicitly named disposable database: **66 passed**, including 2 real-PostgreSQL tests. Fixtures clean up only their own generated users/payments/subscriptions. The integration test refuses non-loopback URLs and any database name other than `eazicart_badge_test`; it never falls back to DATABASE_URL.
- Resolver tests cover BASIC/free, Pro/Business, exact expiry, cancelled paid time, future start, pending/failed/missing evidence, both suspension levels, Business priority, overlapping records and effective upgrades/downgrades.
- Settlement isolation tests cover mismatched owner/reference/provider/amount/currency/plan/status/time, duplicate callback and conflicting transaction. Real database tests cover concurrent callbacks, idempotent replay, seller/account compatibility, legacy no-evidence behavior, suspension, cancellation, refresh and sign-out/sign-in, newest pending record and unknown order-like reference.
- Public DTO tests exercise a 100-item response, deduplicated account lookup, minimal public fields, no-store response headers, next-request suspension and forged client tier rejection.
- Web TypeScript check: passed. Web unit suite: **31 passed**, including three scheduler regression tests for mounting long feeds without postponing refresh, exact expiry during pending requests, and ignoring stale responses after account remount. Only one shared timer remains after mounting multiple names; no timer remains after unmount.
- Browser interaction suite: **15 passed** across desktop Chromium, Pixel-7-sized Chromium and iPhone-13-sized WebKit. WebKit uses the previously extracted workspace-only dependencies and host-validation bypass; the actual WebKit browser runs and tests pass. These are emulated devices; no physical iPhone/Android was used. Each browser tests both variants across the existing surfaces, tooltip interactions and a 100-account list using exactly one 100-ID entitlement batch.
- Browser checks cover hover, focus, mobile tap, Escape, outside tap, parent-link isolation, batch refresh and local expiry. The follow-up browser suite checks both supplied Pro and existing Business artwork, 16px reserved dimensions, and absence of a free-account badge.
- Next production build: compiled, checked types, generated all 38 static pages and completed using temporary `experimental.useTypeScriptCli: false`. Default CLI mode compiled but failed with “Could not parse output from TypeScript's --showConfig” in this execution environment (a direct spawned TypeScript subprocess returned empty stdout). The temporary config is restored; the default-mode build is not claimed to pass.
- Targeted changed-code lint and `git diff --check`: passed. Full API lint fails on the pre-existing async-without-await handler in `apps/api/src/modules/payment-configuration/index.ts:8`. Full web lint fails on pre-existing unused `useMemo` in `apps/web/app/seller/products/page.tsx:5`. Neither unrelated file was changed. A first web lint attempt also traversed the temporary review build directory; that generated directory was removed before the final lint run.

Representative commands (from repository root; use the locked pnpm version in a normal development environment):

```sh
packages/database/node_modules/.bin/prisma generate --schema packages/database/prisma/schema.prisma
node_modules/.bin/tsc -p packages/database/tsconfig.build.json
node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json
# Explicit disposable database ONLY; never substitute a production URL:
DATABASE_URL=postgresql://agent@127.0.0.1:55437/eazicart_badge_test packages/database/node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma
# Run from apps/api:
EAZICART_VERIFICATION_TEST_DATABASE_URL=postgresql://agent@127.0.0.1:55437/eazicart_badge_test ./node_modules/.bin/vitest run
# Run from apps/web:
./node_modules/.bin/vitest run
# Start a local dev server on port 3100 before the browser command:
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node_modules/.bin/playwright test --config e2e/verified-badges.config.mjs
```

Browser tests mock API responses; real provider calls and charges are never made. Local review server/database have been stopped. Dependency/runtime files live outside the candidate checkout. The browser test config assumes the local review server is already running.

Screenshots: [Desktop Chromium](screenshots/desktop-chromium.png), [Android-sized Chromium](screenshots/android-chromium.png), [iPhone-sized WebKit](screenshots/iphone-webkit.png). They show candidate Business rendering on account search, including its membership tooltip. Follow-up Pro screenshots are linked below; exact Figma parity is not asserted.

## Approval-gated deployment and rollback plan

1. Obtain SSH host/user and authorized credential location. Read remote AGENTS.md, git status/diffs and service configuration read-only. Establish actual live web/API cwd, release artifact, commit, environment references and proxy paths. Preserve all remote work. Reconcile this candidate with that exact source, particularly KoraPay differences.
2. The user-approved Pro SVG is wired. Obtain current gold/Figma references, confirm Business artwork/spacing, and repeat browser/screenshots for all live surfaces. Complete trusted provider verification/intent adapter and isolated provider-contract tests; keep checkout disabled unless separately approved.
3. Review schema against a disposable copy/sanitized snapshot of the real database, including constraint preflight and legacy period anomalies. Review migration, explicit evidence-only backfill (if any), privacy and the 30-second open-tab invalidation bound. Build immutable candidate artifacts without touching the active release.
4. **Stop for explicit approval** of the scoped production migration and release/service switch. Do not execute production migrations, copy over the live source, activate checkout/payments, change prices/rules, restart services, or deploy under this task's current authorization. Exact service commands must be filled from verified live paths, not guessed.
5. After approval, take the agreed backup, apply only this additive migration, deploy the reviewed API/web pair via the existing release mechanism, and smoke-test free/paid/suspended fixture accounts without charging real customers. Keep checkout disabled. Monitor callback conflicts, latency and DB query volume.
6. Rollback: switch both applications to the **recorded previous live artifacts** using the verified release process and separately approved service action. Keep additive columns/tables and settlement evidence intact; do not drop ledgers, delete memberships, restore an old database over new customer activity, or undo payment history. Any database rollback/backfill reversal requires its own reviewed plan.

## Files modified/added

- `apps/api/src/app.ts`
- `apps/api/src/modules/seller-subscriptions/index.ts`
- `apps/api/src/modules/verification/database.integration.test.ts`
- `apps/api/src/modules/verification/entitlement.test.ts`
- `apps/api/src/modules/verification/entitlement.ts`
- `apps/api/src/modules/verification/public-badges.test.ts`
- `apps/api/src/modules/verification/public-badges.ts`
- `apps/api/src/modules/verification/settlement.test.ts`
- `apps/api/src/modules/verification/settlement.ts`
- `apps/api/test/app.test.ts`
- `apps/api/test/reels-comments-pagination.test.ts`
- `apps/api/test/reels-media.test.ts`
- `apps/api/test/reels-publish.test.ts`
- `apps/web/app/category/[slug]/category-content.tsx`
- `apps/web/app/components/badge-store.test.ts`
- `apps/web/app/components/badge-store.ts`
- `apps/web/app/components/discovery-product-card.tsx`
- `apps/web/app/components/product-card.tsx`
- `apps/web/app/components/verified-badge.module.css`
- `apps/web/app/components/verified-badge.tsx`
- `apps/web/app/explore/explore-content.tsx`
- `apps/web/app/explore/map/explore-map.tsx`
- `apps/web/app/following/page.tsx`
- `apps/web/app/home-content.tsx`
- `apps/web/app/home-sections.tsx`
- `apps/web/app/product/[id]/product-content.tsx`
- `apps/web/app/profile/page.tsx`
- `apps/web/app/reels/page.tsx`
- `apps/web/app/saved/page.tsx`
- `apps/web/app/search/search-content.tsx`
- `apps/web/app/seller/[id]/seller-content.tsx`
- `apps/web/app/seller/customers/[id]/page.tsx`
- `apps/web/app/seller/customers/page.tsx`
- `apps/web/app/seller/store/page.tsx`
- `apps/web/lib/api/follows.ts`
- `apps/web/lib/api/reels.ts`
- `apps/web/lib/api/types.ts`
- `apps/web/lib/public-catalog.ts`
- `apps/web/public/figma/eazicart-pro-blue-badge.svg`
- `apps/web/vercel.json`
- `docs/verification-badges/REVIEW.md`
- `docs/verification-badges/VPS-ACCESS.md`
- `docs/verification-badges/migration-preflight.sql`
- `docs/verification-badges/screenshots/android-chromium-business-comments.png`
- `docs/verification-badges/screenshots/android-chromium-business-home.png`
- `docs/verification-badges/screenshots/android-chromium-business-map.png`
- `docs/verification-badges/screenshots/android-chromium-business-profile.png`
- `docs/verification-badges/screenshots/android-chromium-business-reels.png`
- `docs/verification-badges/screenshots/android-chromium-business.png`
- `docs/verification-badges/screenshots/android-chromium-pro-comments.png`
- `docs/verification-badges/screenshots/android-chromium-pro-home.png`
- `docs/verification-badges/screenshots/android-chromium-pro-map.png`
- `docs/verification-badges/screenshots/android-chromium-pro-profile.png`
- `docs/verification-badges/screenshots/android-chromium-pro-reels.png`
- `docs/verification-badges/screenshots/android-chromium-pro.png`
- `docs/verification-badges/screenshots/android-chromium.png`
- `docs/verification-badges/screenshots/desktop-chromium-business-comments.png`
- `docs/verification-badges/screenshots/desktop-chromium-business-home.png`
- `docs/verification-badges/screenshots/desktop-chromium-business-map.png`
- `docs/verification-badges/screenshots/desktop-chromium-business-profile.png`
- `docs/verification-badges/screenshots/desktop-chromium-business-reels.png`
- `docs/verification-badges/screenshots/desktop-chromium-business.png`
- `docs/verification-badges/screenshots/desktop-chromium-pro-comments.png`
- `docs/verification-badges/screenshots/desktop-chromium-pro-home.png`
- `docs/verification-badges/screenshots/desktop-chromium-pro-map.png`
- `docs/verification-badges/screenshots/desktop-chromium-pro-profile.png`
- `docs/verification-badges/screenshots/desktop-chromium-pro-reels.png`
- `docs/verification-badges/screenshots/desktop-chromium-pro.png`
- `docs/verification-badges/screenshots/desktop-chromium.png`
- `docs/verification-badges/screenshots/iphone-webkit-business-comments.png`
- `docs/verification-badges/screenshots/iphone-webkit-business-home.png`
- `docs/verification-badges/screenshots/iphone-webkit-business-map.png`
- `docs/verification-badges/screenshots/iphone-webkit-business-profile.png`
- `docs/verification-badges/screenshots/iphone-webkit-business-reels.png`
- `docs/verification-badges/screenshots/iphone-webkit-business.png`
- `docs/verification-badges/screenshots/iphone-webkit-pro-comments.png`
- `docs/verification-badges/screenshots/iphone-webkit-pro-home.png`
- `docs/verification-badges/screenshots/iphone-webkit-pro-map.png`
- `docs/verification-badges/screenshots/iphone-webkit-pro-profile.png`
- `docs/verification-badges/screenshots/iphone-webkit-pro-reels.png`
- `docs/verification-badges/screenshots/iphone-webkit-pro.png`
- `docs/verification-badges/screenshots/iphone-webkit.png`
- `e2e/verified-badges-surfaces.spec.mjs`
- `e2e/verified-badges.config.mjs`
- `e2e/verified-badges.spec.mjs`
- `packages/database/prisma/migrations/20261106190000_subscription_verification/migration.sql`
- `packages/database/prisma/schema.prisma`
- `playwright.config.mjs`
- `scripts/audit-verification-read-only.sh`
- `scripts/verify-badge-migration-upgrade.py`
- `vercel.json`

## User-supplied Pro asset follow-up

The attached transparent SVG is used unchanged in `VerifiedBadge`; every already-integrated account-name surface receives Pro rendering when server-derived metadata resolves to Pro. Eligibility, billing, database and layout CSS are unchanged by this follow-up.

New screenshots: [Desktop Pro](screenshots/desktop-chromium-pro.png), [Android Pro](screenshots/android-chromium-pro.png), [iPhone Pro](screenshots/iphone-webkit-pro.png). The expanded browser suite passed all **6 tests**, exercising both variants across all three emulated browsers. Web TypeScript and targeted badge lint checks passed. Source asset and runtime-served SVG preserve the original vector paths and white checkmark.

Additional file: `apps/web/public/figma/eazicart-pro-blue-badge.svg`. Updated files: shared badge component, `e2e/verified-badges.spec.mjs`, this report and variant-specific screenshots. This does not resolve the outstanding VPS/provider audit or authorize deployment.

## Continuation: surface coverage and refresh hardening

- Added missing shared badges to category seller rows, map store details and saved-product seller names; following can use server-derived account metadata if a seller-profile DTO is absent.
- Scoped the badge image selector to prevent legacy Explore styles from forcing 14px dimensions and absolute positioning. The name/card/page layouts and navigation remain unchanged.
- Fixed refresh deadlines so mounting additional names cannot postpone the next batch, and local expiry still notifies components while a batch request is pending. Responses from a prior unmounted account subscription are ignored.
- Escape now dismisses an open badge tooltip before the underlying comments sheet handles it. Browser tests confirm the comments panel remains open.
- Added `apps/web/app/components/badge-store.test.ts` and `e2e/verified-badges-surfaces.spec.mjs`. Updated config includes both browser specs.

Additional Pro screenshots: [Desktop home](screenshots/desktop-chromium-pro-home.png), [Desktop profile](screenshots/desktop-chromium-pro-profile.png), [Desktop reels](screenshots/desktop-chromium-pro-reels.png), [Desktop comments](screenshots/desktop-chromium-pro-comments.png), [Android home](screenshots/android-chromium-pro-home.png), [iPhone profile](screenshots/iphone-webkit-pro-profile.png), [iPhone comments](screenshots/iphone-webkit-pro-comments.png), [iPhone map details — stubbed renderer](screenshots/iphone-webkit-pro-map.png). Matching Business captures are alongside these files.

Outstanding production-source/SSH and trusted provider-adapter blockers are unchanged. No production deployment, restart, migration, charge or billing change has occurred.

## Local review archive

`/workspace/eazicart-verified-badges-candidate.tar.gz` contains only candidate files changed/added relative to base `cfbe138985c57c6a83bb9751c43c297f303615b5`, including screenshots and a SHA-256 manifest. It excludes dependencies, environment files, credentials, database state and build outputs. It is a review overlay, not a standalone repository or production deployment artifact. Reconcile against the verified production source before applying anything. The candidate is maintained on dedicated branch `feat/subscription-verified-badges`; no merge or deployment is authorized.

The final continuation build passed compilation, type checking and generation of all 38 static pages using the previously documented temporary compiler-API workaround; config and generated Next environment declarations were restored afterwards. The local review server has been stopped.

## Continuation: live contract, remote candidates, and migration-upgrade audit

Public GET-only checks of `https://eazicart.com/api/health`, `/api/products?limit=1` and `/api/sellers` returned HTTP 200. Health reports `eazicart-api`. The product DTO includes `originalPrice`, `discountPercent` and `restockedAt`, fields absent from this main-based candidate schema. This confirms source divergence and reinforces that the review archive must not be applied blindly to the VPS. No account login, payment call, view telemetry or customer write was performed. Only response field names were retained; no customer record values were recorded.

Additional remote source inspected without checking out or merging unrelated work:

- `origin/feat/eazicart-kora-reconciliation-20261106` at `6c44e59`: `korapay-api-adapter-candidate.ts`, `korapay-migration-candidate.ts`, `korapay-webhook-candidate.ts`, `korapay-prisma-settlement-candidate.ts`, and API registration. The candidate verifies reference/currency and both charge/paid amount, uses NGN major units, authenticates callbacks and re-queries the provider before serializable order settlement. Its modules are explicitly unregistered and order-scoped. They must never be used as subscription payment evidence.
- Reports retained on `origin/feat/eazicart-staging-audit-auth-20261106` at `230185f`: the KoraPay staging and reconciliation reports explicitly describe synthetic provider fetchers, fixture-only routes, no official sandbox signature vectors, and no production activation. These reports cannot prove what is currently deployed.
- No SSH host/user/key was found in the main CI workflow, available deployment documentation or workspace SSH configuration. Current production service paths and the real payment adapter still require the authorized SSH connection requested from the user.

Added `scripts/audit-verification-read-only.sh`. Syntax checked and exercised against this local candidate. It inventories EaziCart systemd WorkingDirectory/MainPID/FragmentPath and process cwd/executable links, resolves Git roots, lists working-tree changes and AGENTS paths, and hashes selected source files. It does not print process arguments, environment values, keys, database rows or configuration contents, and uses `GIT_OPTIONAL_LOCKS=0` to avoid Git index refresh writes. It invokes no sudo, service control or deployment commands. It has **not** been run on the VPS.

Added `docs/verification-badges/migration-preflight.sql`, a read-only transaction with aggregate legacy subscription status/period checks. It contains no backfill and no customer identifiers. Inspect the actual live schema before using it; no production SQL was executed.

Added `scripts/verify-badge-migration-upgrade.py`, run against the explicitly disposable local PostgreSQL instance on port 55437. It refuses the default PostgreSQL port, non-loopback hosts, credentials/query options, an unexpected database name, an unapproved server data directory and any nonempty target database. It creates no database and never drops existing contents.

Actual upgrade result: all **9 pre-badge migrations** applied; three synthetic legacy subscriptions and one synthetic historical successful product-order payment were inserted; the candidate migration then applied successfully. All historical fixture fields were identical before/after. The deliberately invalid legacy period was preserved with the NOT VALID check, no paid subscription evidence was fabricated, and new invalid owner/period/amount writes were rejected by the intended constraints. Default-port and nonempty-target refusal paths were also exercised. The 20 focused entitlement/settlement/DTO/PostgreSQL tests passed again.

Reproduction (disposable server and a newly created empty database only):

```sh
python3 scripts/verify-badge-migration-upgrade.py \
  --database-url postgresql://agent@127.0.0.1:55437/eazicart_badge_upgrade_test \
  --psql /path/to/psql
```

`playwright.config.mjs` now excludes the fixture-only `verified-badges*.spec.mjs` files from the default real-customer suite. Test collection verified **122 existing customer-flow tests** remain in the default config and **15 isolated badge tests** remain in the explicit badge config. This prevents the 3100-port mocked badge suite from being accidentally run against the default 3000-port production-build harness. No browser test was removed from the dedicated badge suite.

Production deployment, migrations, billing changes and provider activation remain unapproved and untouched. The VPS audit and provider reconciliation require the SSH host/user and authorized credential location.

The settlement guard now also rejects any subscription intent whose reference is already assigned to a product-order Payment row. This indexed, transaction-local check prevents accidental reference reuse from repurposing historical order payments; it neither writes to order payments nor wires a live activation route. A dedicated regression test verifies that no subscription/evidence write occurs on this rejection.

Final security-check results: the full API suite passed **66 tests** with the product-order reference guard; the real PostgreSQL owner suites passed again after adding an actual synthetic order-payment/subscription-reference collision. Both the subscription and evidence rows remained PENDING on rejection. API type checking, API build, scoped verification-module lint, Bash syntax, Python compilation, and diff whitespace checks passed. The aggregate preflight SQL also executed successfully on the disposable upgraded schema. No web runtime code changed during this audit continuation, so the previous 31 web-unit and 15 browser results remain the applicable UI evidence.

## Owner-provided Contabo details and GitHub deployment review

Owner supplied VPS IP `169.58.189.217`, repository `wis12dom34/eazicart`, and candidate source directory `/opt/eazicart/source`, and confirmed no SSH key was available. The SSH username/port and actual service paths remain unverified. The server has not been contacted over SSH.

GitHub inspection refreshed remote refs and confirmed main still resolves to `cfbe138985c57c6a83bb9751c43c297f303615b5`. Main's checked-in workflow is CI; its root Compose file starts only development PostgreSQL. The web/API packages provide build/start commands, and the Next.js configuration can rewrite `/api/*` to the server-provided `EAZICART_PUBLIC_API_URL`. These settings do not identify the VPS's live process roots.

Found the existing Contabo deployment template on `origin/codex/api-deployment-foundation` at `a62b972810445f6ce123ccfcc19b480c61e28487`: `infra/vps/README.md`, `infra/vps/compose.yaml`, `infra/vps/Caddyfile`, `Dockerfile.api`, and `docs/api-deployment.md`. It describes an API-only Docker/PostgreSQL/Caddy setup with a migration service that runs automatically before API startup; it is a first-deployment template. No build, compose-up, migration, proxy change or service restart from that template was executed. It cannot be assumed to match the existing VPS.

GitHub workflow metadata also lists API container tests and AWS infrastructure validation; inspected definitions perform CI verification, not a Contabo SSH release. The five latest deployment records were Preview records; the newest successful record links a Vercel preview at commit `d118d3ed16b66e951b8e62c592fd6d66aaa1e52b`. These records do not prove the VPS release path or production deployment architecture.

Extended the read-only audit helper with **selected Docker metadata only**: EaziCart container image/image ID, workdir/Compose workdir, and mount source/destination paths. Full inspect output and container environments are never printed. Bash syntax and a synthetic Docker fixture passed; duplicate container IDs were inspected once, and only metadata-read commands were accepted by the fixture. No live Docker daemon or VPS was changed.

Prepared a temporary Ed25519 key pair **outside the repository and review archive**, with the private key kept in the workspace (mode 600; parent directory mode 700). Only the public authorization line is shared. Suggested authorization expires 2026-11-07 19:36:45 UTC. Creating the key pair did not configure or contact the VPS. The owner must append its public line to the intended SSH account before it can authorize a connection. See [secure connection instructions](VPS-ACCESS.md). The private key is not included in any deliverable.

## Dedicated branch push safeguard

The owner authorized committing and pushing the prepared candidate without merging or deploying. Added `git.deploymentEnabled` rules disabling **only** `feat/subscription-verified-badges` in root and web-root `vercel.json`, covering the repository's possible Vercel project roots. Other branches keep their default deployment behavior. This prevents the known Git-connected Vercel preview integration from deploying this review branch on push. No project-wide Vercel setting, VPS service or live configuration was modified. Reference: https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled .
