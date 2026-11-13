# EaziCart Native Mobile

Real native React Native + Expo Router application sharing the existing EaziCart HTTPS API.

## Development

Run `pnpm install` at the monorepo root. Configure `EXPO_PUBLIC_EAZICART_API_BASE_URL` explicitly to your approved HTTPS `/api` staging endpoint (or localhost HTTP during local development). There is no production API fallback; the `.env.example` hostname is intentionally non-resolving. Android QA builds additionally require the approved-host and synthetic staging identity gates. Then run `pnpm --filter @eazicart/mobile start`. Expo development builds require the native development client.

## Security

Only the refresh token is persisted, via Expo SecureStore. Access tokens live in memory. Never copy server KoraPay secrets into this app. No database or server migration is required.

## Milestone scope

Home feed (real cursor pagination), existing-account login/registration/session restoration, product details/gallery, public search, seller storefronts, product Likes, Saves, comments and native sharing. Native Reels now uses the existing live feed with Expo video playback, pagination, actions, comments and idempotent authenticated view tracking. Stories, seller tools, cart and checkout are intentionally deferred.

## Release safety

Do not deploy apps to stores or modify the existing live web/API without explicit approval. This is an isolated development branch, not a production build.

## Phase 2 Reels

See [PHASE2_REELS_REPORT.md](./PHASE2_REELS_REPORT.md) for implemented functionality, tests, and device-testing limitations.

## Native build profile safety (development only)

This branch defines EAS **development** and **staging** internal build profiles with explicit EAS environments (`development` and `preview`). Both use `com.eazicart.mobile.dev`.

The zero-dependency `eas-build-pre-install` hook checks `EAS_BUILD_PROFILE` before installation. **Production/store builds are intentionally refused.** Do not bypass this hook or modify identifiers until native-device QA is complete and release approval is explicit. The hook validates config, approved staging API hostname, no public secrets, and disabled admin-audit preview. It does not verify the staging server is actually isolated; the existing synthetic staging attestation is a separate required check.

For authorized internal QA, set `EXPO_PUBLIC_EAZICART_API_BASE_URL` to the approved HTTPS staging `/api` URL, `EAZICART_ANDROID_QA_ALLOWED_API_HOST` to the exact maintainer-managed hostname, `EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD=1`, and `EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW=0`. No real KoraPay keys may be exposed. Test the gate locally from the monorepo root using `pnpm --filter @eazicart/mobile test:build-profile`; from the mobile directory run `node scripts/native-build-profile-verify.mjs development` with the approved staging environment.

Do not start EAS, Gradle, Xcode, or any GitHub Actions build on either production VPS. The prepared Android workflow remains manual and review-only. Native binaries still require a dedicated nonproduction runner, verified isolated staging backend, and real-device checks.

## Phase 26: iOS Simulator QA (prepared, not activated)

The review-only GitHub Actions workflow `.github/workflows/ios-simulator-manual.yml` has only a manual dispatch trigger and **is not activated or merged to the default branch**. It targets a dedicated Apple Silicon self-hosted runner labeled `eazicart-ios-qa`. It does not sign, export, upload or submit an iOS app.

The runner must be a separate macOS machine with an unprivileged service account, Xcode 26.4 or newer (for Expo SDK 58), the iOS Simulator SDK and command-line tools, at least 20 GiB free disk, and at least 6 GiB free RAM. It must not contain production EaziCart source or services. Do not register a production Mac or either VPS as the QA runner.

For manual activation **after explicit approval**, restrict the runner group to trusted maintainers and reviewed branches, configure repository Actions variables `EAZICART_IOS_QA_APPROVED_SHA` to the exact 40-character reviewed commit and `EAZICART_ANDROID_QA_ALLOWED_API_HOST` to an operator-approved _disposable_ staging hostname, and verify an isolated synthetic staging backend. The dispatch form additionally requires `BUILD_IOS_SIMULATOR_ONLY`; no production data or real payment keys belong in the staging environment.

Before `pnpm install`, the workflow checks the isolated runner, pinned SHA, safe internal EAS profile, API allowlist, and synthetic staging attestation. It then generates the iOS development project and calls Xcode with `CODE_SIGNING_ALLOWED=NO` for the generic iOS Simulator. No IPA, device build, distribution, simulator launch or App Store action is prepared. Run the read-only tests with `pnpm --filter @eazicart/mobile test:ios-runner`.

The signing configuration and real iPhone development build remain separate work requiring an approved Apple Developer team and an isolated device-testing environment.
