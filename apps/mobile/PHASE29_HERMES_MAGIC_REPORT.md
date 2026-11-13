# EaziCart Native — Phase 29 Hermes Bytecode Signature Verification

Date: November 13, 2026. Baseline Phase 28 commit `eb9f6fec5dd695a2eef7b579dd0db61091ef4f25`.

## Objective
Address the final export-verification integrity gap before development native binaries are attempted. This work does not request or execute a native build.

## Reproduced defect
The Phase 28 native export validator accepted any `.hbc` file over 50 KB referenced by valid Metro metadata; it did not validate that the file contained Hermes bytecode. Two new regression tests failed against the original validator when large random data or plain JavaScript was renamed to `.hbc`, or when the expected Hermes header was altered.

## Fix
- Read the first eight bytes of the compiled bundle and require Hermes bytecode magic `c61fbc03c103191f` (little-endian `0x1F1903C103BC1FC6`).
- Require this signature in addition to platform-specific metadata, expected `.hbc` location, minimum nonempty bundle size, safe paths and valid asset references.
- Update test fixture bytecode to include the authentic header and add two regression tests covering renamed garbage, source text and altered bytecode magic.
- Confirmed header against the Android and iOS Hermes bytecode files actually exported in Phase 28.

## Tests executed
- Focused Hermes export verifier suite: 10/10 passed (previously 8/8).
- Phase 29 validator against actual Phase 28 Android exported bundle and 28 assets: passed.
- Phase 29 validator against actual Phase 28 iOS exported bundle and 24 assets: passed.
- Full native build-safety test suite: 64/64 passed.
- Full React Native client tests: 103/103 passed.
- TypeScript: passed.
- ESLint: passed.
- Prettier and git diff whitespace checks: passed.

## Explicit boundaries
- The first-eight-byte signature is a guard against malformed or mislabeled bundles; it does **not** cryptographically authenticate the whole bundle. This stage does not create an APK or IPA.
- The online connected machines remain unsuitable production VPSs for native builds; no dedicated authorized Android JDK/SDK runner or Apple Silicon Xcode signing environment is available.
- No Gradle, Xcode, CocoaPods, EAS remote build, GitHub workflow dispatch, device installation, simulator launch, store publication, signing, payment changes, production endpoint access, database changes or customer data exposure occurred.
- This commit is an isolated review branch; do not merge, dispatch or publish without approval.

## Next
When a dedicated isolated QA runner and disposable synthetic staging backend are approved, run the manual Android debug build and unsigned iOS Simulator workflow for the exact reviewed commit, verify binary artifacts, then perform physical-device smoke tests. Device signing and app-store release require separate approval.
