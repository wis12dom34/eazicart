# EaziCart Native — Phase 27 iOS CocoaPods and Simulator Workspace Fix

Date: November 13, 2026. Based on Phase 26 commit `4709d15ee8ff0d58b4f2823feaf86e25f8177ada`.

## Verified build readiness defect

Phase 26's manually prepared unsigned iOS simulator build workflow used Expo prebuild with `--no-install`, then attempted `xcodebuild -project apps/mobile/ios/EaziCart.xcodeproj` directly. Because the project includes React Native / Expo native dependencies managed by CocoaPods, it needs a `pod install` step and compilation through the CocoaPods-generated `EaziCart.xcworkspace`. An isolated Expo SDK 58 prebuild from Phase 24 produced the `ios/Podfile` and `ios/EaziCart.xcodeproj`, but not a separately installed Pods workspace. The previous script did not check for `pod`.

Relevant vendor guidance:
- Expo iOS build process: https://docs.expo.dev/build-reference/ios-builds/
- Expo CLI and prebuild no-install: https://docs.expo.dev/more/expo-cli/
- Expo SDK 58 build tooling: https://docs.expo.dev/versions/latest/

## Changes

- Added a fail-closed CocoaPods presence check to the read-only isolated iOS runner inspector.
- Updated manual-only iOS Simulator QA workflow: after generated-project identifier/deep-link verification, `cd apps/mobile/ios && pod install --silent` and require `EaziCart.xcworkspace/contents.xcworkspacedata`.
- Replaced Xcode invocation `-project .../EaziCart.xcodeproj` with `-workspace .../EaziCart.xcworkspace`, retaining the Debug generic iOS Simulator destination and `CODE_SIGNING_ALLOWED=NO` / no signing.
- Added two tests: reject isolated runner without CocoaPods, and ensure workflow orders Expo prebuild, verification, pod install and workspace compilation while refusing signing/upload and production triggers.
- Updated README documenting the native dependencies/toolchain.

## Verified tests

- Both added regression tests failed against Phase 26's original configuration and passed after patch.
- Dedicated iOS runner tests: 9/9 passed.
- All native script tests: 54/54 passed.
- Native application tests: 103/103 passed.
- Mobile TypeScript and ESLint: passed.
- Prettier checks and git diff whitespace checks: passed.

## Scope / remaining issues

- No Apple Silicon macOS QA runner was online, so **no real `pod install`, Xcode compile, Simulator launch or iPhone install occurred**. The revised workflow is prepared, not run.
- No signed iOS IPA, Android APK, EAS build, remote workflow dispatch, artifact upload, App Store or Play Store publication.
- No production app/API, wallet, database, KoraPay transaction, user records or credentials changed.
- This branch is for review only. Actual builds require explicit authorization, a dedicated isolated Mac with Xcode 26.4+, CocoaPods, a verified disposable synthetic staging backend, and an exact maintainer-approved SHA. The Android development APK requires a separately approved isolated SDK/JDK runner.
