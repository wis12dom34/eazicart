# EaziCart Native — Isolated Staging Identity & Android Toolchain Readiness

Date: 2026-11-06
Status: **Implemented and tested on an isolated review branch. No deployment, external staging service, APK, iOS build or payment activation.**

## Summary

The prepared Android QA workflow contained two incorrect local toolchain requirements: it checked `platforms/android-37.0` instead of the actual `platforms/android-37` SDK layout, and required JDK 21 even though React Native / Expo SDK 58 build infrastructure uses JDK 17. These blockers were corrected without relaxing the production-host, explicit authorization, pinned-commit, resource, or staging-host gates.

The Android debug build now requires an explicit HTTPS staging identity attestation before dependency installation and again before any Gradle action. This attestation is implemented only in the disposable PostgreSQL synthetic-KoraPay test registration and **is not registered in the live API**.

## Completed files

- `.github/workflows/android-debug-manual.yml`: read-only HTTPS staging identity probe and unit test added before dependency installation/prebuild.
- `apps/mobile/scripts/android-runner-readiness.mjs`: require real SDK `platforms/android-37/android.jar`, Build Tools 37.0.0, NDK 27.1.12297006, platform-tools/adb and JDK 17.
- `apps/mobile/scripts/android-runner-readiness.test.mjs`: new SDK directory-layout regression; retain root/production-service/resource/SHA refusal tests.
- `apps/mobile/scripts/android-debug-qa.sh`: corrected SDK platform checks and mandatory synthetic staging attestation before Gradle.
- `apps/mobile/scripts/android-staging-attestation.mjs`: GET-only probe at `/api/preview/staging/health`, strict allowlisted HTTPS host and `/api` path, no credentials, redirects disallowed, 8-second default deadline, strict synthetic-disposable response validation, fail-closed exit code 23.
- `apps/mobile/scripts/android-staging-attestation.test.mjs`: covers genuine fixture response, refusal before network calls for production URLs, ordinary health responses, live-payment data, redirects, foreign origins, bad content types and unavailable endpoints.
- `apps/api/src/modules/payments/isolated-kora-staging.ts`: new GET `/preview/staging/health`, registered **only after verifying an actual disposable `pg_virtualenv` PostgreSQL cluster**, synthetic fixture provider and test-only environment gates. Does not expose credentials or addresses.
- `apps/api/src/modules/payments/isolated-kora-staging.postgres.test.ts`: real disposable database registration contract, no-cache header, no sensitive data and rejection of POST.
- `apps/mobile/PHASE3_STAGING_ANDROID_ATTESTATION_REPORT.md`: this report.

## Checks performed

- **39/39 disposable PostgreSQL integration tests passed** (existing 38 plus one staging-health attestation test); cluster automatically destroyed.
- **50/50 mobile unit and API-contract regression tests passed**.
- **17/17 Android runner, staging-URL and staging-attestation guard tests passed**.
- Scoped API ESLint, API and database TypeScript, mobile lint and TypeScript, shell syntax checks passed.
- No production API registration, DB migrations, new secrets or live KoraPay requests.

## Connected host assessment (read-only)

- EaziCart VPS `vmi3669743`: existing production EaziCart web/API services active; approximately 12 GiB disk free at inspection. Safety guard refuses build there.
- Second connected VPS `vmi3061454`: another API service active, approximately 2 GiB available RAM, Android SDK not installed. Not an approved dedicated build machine.
- Connected Mac currently offline; iOS simulator or code-signing tests unavailable.

## Remaining / next gate

1. Provision an **explicitly approved, separate and unprivileged Android QA runner** with at least 16 GiB available disk, 6 GiB available RAM, 2 GiB available swap, JDK 17, Android SDK platform 37 / Build Tools 37.0.0 / NDK 27.1.12297006 / platform-tools.
2. Supply an authorized nonproduction HTTPS hostname and staging service with segregated credentials, disposable or separately approved synthetic PostgreSQL, no live payment keys or customer data. The runner will reject any backend missing exact fixture identity.
3. Set maintainer-controlled `EAZICART_ANDROID_QA_ALLOWED_API_HOST` and `EAZICART_ANDROID_QA_APPROVED_SHA`, review the feature branch and approve the manual build. Do not add workflow activation triggers, merge or dispatch without explicit authorization.
4. Produce a local debug APK on that runner, verify package/signature and checksum, then test Home/Reels/Stories, login, cart, rotation, keyboard, poor-network behavior and accessibility on a device.
5. Complete iOS development-build signing and simulator/physical testing separately on approved macOS tooling.
6. Production KoraPay payment creation, order migrations, push notifications and native Pay remain disabled until separate, explicit approval.

## Documentation references

- Expo SDK 58 platform matrix: https://docs.expo.dev/versions/v58.0.0/
- Expo SDK 58 build infrastructure (JDK 17): https://docs.expo.dev/build-reference/infrastructure/
- React Native setup (JDK 17): https://reactnative.dev/docs/set-up-your-environment

No production customer accounts, inventory, cart, payments or order records were mutated. No deployment, APK creation, app-store publication, runner provisioning, or background task was performed.
