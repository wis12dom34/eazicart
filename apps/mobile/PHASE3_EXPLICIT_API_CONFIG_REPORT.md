# EaziCart Native — Explicit API Configuration Checkpoint

Date: 2026-11-07
Status: **Review branch only; no production deployment, APK, iOS build, payment activation, staging service, or app-store publication.**

## Baseline and scope

- Parent: `fac47fe039a9308b566076ad52f0f3300e153f4e` on `feat/eazicart-android-single-debug-signer-20261107`.
- New branch: `feat/eazicart-mobile-explicit-api-20261107`.
- The React Native client previously used `https://eazicart.com/api` when `EXPO_PUBLIC_EAZICART_API_BASE_URL` was absent. This was unsuitable for isolated mobile QA.

## Changes

1. `src/lib/api-base.ts` now requires an explicit API URL, validates its HTTPS `/api` shape, and permits `http://localhost:<port>/api` only for local development. This generic parser does not replace the stricter Android approved-host and synthetic staging attestation gates.
2. `src/lib/api.ts` resolves its configured base URL before making a network request. There is no implicit production fallback.
3. `tests/api-base.test.ts` adds three focused test scenarios for missing configuration, accepted formats, and rejected unsafe formats.
4. `package.json` runs mocked mobile unit tests with a deliberately non-resolving `https://fixture.invalid/api` URL.
5. `.env.example` uses `https://staging.invalid/api` as a non-resolving placeholder instead of a production URL.
6. `README.md` explains explicit staging configuration and the already-required Android QA gates.

## Evidence and limitations

- GitHub branch comparison against parent verified exactly six scoped changed files.
- Local isolated TypeScript compilation of the new URL resolver succeeded with `tsc`.
- Three focused equivalent Node tests of the compiled resolver passed (3/3).
- **Full Expo project typecheck, lint, Jest/tsx mobile test suite, disposable PostgreSQL tests, real Android build, emulator/device QA, and iOS/Xcode validation were not run in this checkpoint.** The 3/3 count is not a claim about the full repository test suite.

## Outstanding gates

- Approved separate Linux Android build runner with JDK 17, Android SDK Platform 37, Build Tools 37.0.0, NDK 27.1.12297006, isolated Gradle cache, and sufficient resources.
- Dedicated nonproduction HTTPS API with synthetic/disposable staging attestation; maintainers must allowlist the hostname.
- Separate approval before manual Android build dispatch, any runner provisioning/activation, iOS signing, production deployment, database migration, or payment activation.

Production EaziCart web, API, database, wallets, orders, and live payments were not changed.
