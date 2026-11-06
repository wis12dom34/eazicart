# EaziCart Native — Manual Android QA Build Preparation

Date: 2026-11-06
Status: **Prepared and statically tested on a review branch; workflow NOT activated, dispatched, deployed or published.**

## What was prepared

- Added a manual-only GitHub Actions workflow at `.github/workflows/android-debug-manual.yml`. It has a single `workflow_dispatch` event, read-only repository permissions, and a runner label requiring a separately provisioned `eazicart-android-qa` machine. There are no push/PR/schedule triggers.
- The manual workflow requires an explicit operator confirmation and approved isolated HTTPS staging API URL/hostname. It does not default to `eazicart.com`.
- Added `apps/mobile/scripts/android-qa-api-preflight.mjs` to reject production and lookalike domains, localhost, unapproved or insecure hosts, URL credentials, paths other than `/api`, public secret-looking env variables, and an enabled Finance Audit preview. This check runs before dependency and native build commands.
- Integrated the staging API preflight into the existing `android-debug-qa.sh` so local manually initiated builds also fail closed.
- Added six local automated regression tests in `apps/mobile/scripts/android-qa-api-preflight.test.mjs`.
- The workflow runs typecheck, lint, native tests, Expo Android prebuild, guarded debug APK creation, APK signature/ZIP/package checks and SHA-256 reporting. It does **not** perform app installation, sign a release, deploy anything, upload the APK, or publish to any store.

## Important operational limitations

- GitHub requires manual workflows to exist on the default branch before they can be dispatched. This file is **only on a development branch**; it is not currently runnable through GitHub Actions. An authorized, separately reviewed merge/activation is required before manual dispatch.
- The existing production VPS is **not** an acceptable build runner: the last attempted native build exhausted swap and had to be stopped. The workflow label intentionally excludes that server.
- No runner with the `eazicart-android-qa` label was confirmed or provisioned in this milestone; running the workflow would be blocked until one is registered and equipped with Java 21, Android SDK 37 / Build Tools 37 / NDK 27, and adequate available memory/disk.
- No real Android APK was built or verified here, and no emulator or device execution occurred. No sandbox KoraPay charge was attempted.
- A future operator should review the permissions and trust of the dedicated self-hosted runner before allowing third-party code or PRs onto it. Avoid production credentials entirely.
- APK remains local to the dedicated runner; a separate user-authorized transfer or internal artifact-sharing procedure would be needed to retrieve it.

## Next release gate

After explicit authorization for CI runner setup and manual build execution, provision the isolated runner, review/activate the workflow, set the approved staging URL and confirmation, and verify a debug APK on an Android development device. No production database, customer payment or EaziCart deployment change is included.
