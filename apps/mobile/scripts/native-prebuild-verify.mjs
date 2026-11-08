#!/usr/bin/env node
/** Read-only verification of Expo-generated development native projects. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_PACKAGE = "com.eazicart.mobile.dev";

export function verifyNativePrebuild(files) {
  const errors = [];
  let config;
  try {
    config = JSON.parse(files.appJson).expo;
  } catch {
    return { ok: false, errors: ["Invalid Expo app configuration."] };
  }
  if (
    config.android?.package !== EXPECTED_PACKAGE ||
    config.ios?.bundleIdentifier !== EXPECTED_PACKAGE
  )
    errors.push("Both development package identifiers must match.");
  if (config.scheme !== "eazicart")
    errors.push("Native deep-link scheme mismatch.");
  if (
    !files.gradle?.includes("applicationId '" + EXPECTED_PACKAGE + "'") ||
    !files.gradle?.includes("namespace '" + EXPECTED_PACKAGE + "'")
  )
    errors.push("Generated Android application ID or namespace mismatch.");
  if (!files.androidManifest?.includes('android:scheme="eazicart"'))
    errors.push("Generated Android deep-link scheme missing.");
  if (
    !files.iosProject?.includes(
      'PRODUCT_BUNDLE_IDENTIFIER = "' + EXPECTED_PACKAGE + '";',
    )
  )
    errors.push("Generated iOS bundle ID mismatch.");
  if (!files.iosPlist?.includes("<key>CFBundleIdentifier</key>"))
    errors.push("Generated iOS Info.plist missing bundle identifier.");
  if (
    !files.iosPlist?.includes("<key>CFBundleURLTypes</key>") ||
    !files.iosPlist?.includes("<string>eazicart</string>")
  )
    errors.push("Generated iOS deep-link scheme missing.");
  return { ok: errors.length === 0, errors };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const read = (name) => readFileSync(path.join(root, name), "utf8");
  try {
    const result = verifyNativePrebuild({
      appJson: read("app.json"),
      gradle: read("android/app/build.gradle"),
      androidManifest: read("android/app/src/main/AndroidManifest.xml"),
      iosProject: read("ios/EaziCart.xcodeproj/project.pbxproj"),
      iosPlist: read("ios/EaziCart/Info.plist"),
    });
    if (!result.ok) {
      result.errors.forEach((error) => console.error("REFUSED: " + error));
      process.exitCode = 23;
    } else {
      console.log(
        "PASS: generated iOS and Android development identifiers and deep links verified.",
      );
    }
  } catch (error) {
    console.error(
      "REFUSED: missing generated native project or unreadable configuration:",
      error.message,
    );
    process.exitCode = 23;
  }
}
