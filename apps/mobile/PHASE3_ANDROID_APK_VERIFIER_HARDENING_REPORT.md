# EaziCart Native — 2026-11-07 Android QA checkpoint

Status: **Review branch only. No Android APK, iOS build, staging deployment, payment activation, production migration, or store submission.**

## Repository recovery and provenance

- Verified EaziCart repository: `wis12dom34/eazicart`.
- Android/mobile baseline: `feat/eazicart-mobile-build-readiness-fix-20261106`, commit `d118d3ed16b66e951b8e62c592fd6d66aaa1e52b`.
- The previously reported abbreviated SHA `dd516a3` was not resolvable through GitHub or the connected production VPS checkout. Its claimed four-file diff and test results must **not** be treated as currently verified.
- The existing production VPS checkout is on a separate web-design branch and has extensive unrelated uncommitted changes. This checkpoint did not alter that checkout.
- This review work branched directly from the verified mobile baseline to `feat/eazicart-android-apk-verifier-hardening-20261107`.

## Scoped changes

1. `apps/mobile/scripts/android-apk-verify.sh`: remove the predictable shared `/tmp` signer-output path; capture the output in memory, preserving the existing fail-closed behavior. Require a whole `CN=Android Debug` subject field rather than accepting prefix lookalikes.
2. `apps/mobile/scripts/android-apk-verify.test.sh`: eight offline synthetic-ZIP/mock-tool cases: accepted synthetic debug flow; rejected release signer, lookalike signer, signature error, zipalign error, wrong application ID, malformed manifest and missing input.
3. `.github/workflows/android-debug-manual.yml`: add the offline verifier regression step before dependency installation on the prepared manual-only isolated Android runner.
4. This checkpoint report.

## Validation performed

- `bash -n` on verifier and offline test script: passed in isolated local workspace.
- `bash apps/mobile/scripts/android-apk-verify.test.sh`: **8/8** cases passed in isolated local workspace with mocked `apksigner`, `aapt`, `zipalign`, `java` and synthetic ZIP data. **No genuine Android APK was compiled or signed.**
- GitHub branch comparison confirms only the verifier, its test and the manual Android workflow were changed before this report.
- Static workflow review: `workflow_dispatch` only; dedicated `eazicart-android-qa` runner; approved HTTPS synthetic staging attestation before installation; no APK upload.
- Previous reports of 50/50 mobile tests, 39/39 PostgreSQL tests and 17/17 runner/security tests belong to the preceding baseline and were **not rerun in this checkpoint**.

## Native feature inspection (static code, not device QA)

- Authentication: native login/register and SecureStore-based session recovery exist.
- Feed and reels: separate React Native FlatList screens use paginated queries and recovery/retry paths.
- Stories and following: dedicated routes/components exist.
- Product discovery: native search, product detail, seller storefront and cart routes exist.
- Checkout: deliberately **review-only**; the native payment initiation button remains disabled pending reviewed KoraPay integration.
- Messaging, notifications, verification/subscription badge display, seller dashboard/inventory/order management, and native maps: no corresponding top-level native routes were located in the inspected app router tree. Confirm requirements and Figma before implementing; do not duplicate backend behavior.

## Hard gates still outstanding

1. Explicitly approved isolated nonproduction Linux Android runner (unprivileged, >16 GiB available disk, >=6 GiB available RAM, >=2 GiB free swap) with JDK 17, SDK Platform 37, Build Tools 37.0.0, NDK 27.1.12297006, Android platform tools and isolated Gradle cache.
2. Dedicated allowlisted HTTPS `/api` staging hostname serving the exact disposable synthetic-finance health attestation with isolated database and no live payment credentials.
3. Approval to configure a specific reviewed full commit SHA and dispatch the manual workflow. **No build was dispatched.**
4. Real debug APK build, package/signature/checksum verification, Android emulator/device QA, and separate macOS/Xcode iOS validation.

No production customer, seller, wallet, cart, inventory, order, or payment data was modified.
