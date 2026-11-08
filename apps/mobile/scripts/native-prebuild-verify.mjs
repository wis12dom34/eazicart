#!/usr/bin/env node
/** Read-only verification of Expo-generated development native projects. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_PACKAGE = "com.eazicart.mobile.dev";

export function verifyNativePrebuild(files, platform = "all") {
  if (!["all", "android", "ios"].includes(platform))
    return { ok: false, errors: ["Unsupported native platform."] };
  const android = platform !== "ios";
  const ios = platform !== "android";
  const errors = [];
  let config;
  try {
    config = JSON.parse(files.appJson).expo;
  } catch {
    return { ok: false, errors: ["Invalid Expo app configuration."] };
  }
  if (
    (android && config.android?.package !== EXPECTED_PACKAGE) ||
    (ios && config.ios?.bundleIdentifier !== EXPECTED_PACKAGE)
  )
    errors.push("Development package identifiers must match.");
  if (config.scheme !== "eazicart")
    errors.push("Native deep-link scheme mismatch.");
  if (
    android &&
    (!files.gradle?.includes("applicationId '" + EXPECTED_PACKAGE + "'") ||
      !files.gradle?.includes("namespace '" + EXPECTED_PACKAGE + "'"))
  )
    errors.push("Generated Android application ID or namespace mismatch.");
  if (android && !files.androidManifest?.includes('android:scheme="eazicart"'))
    errors.push("Generated Android deep-link scheme missing.");
  if (
    ios &&
    !files.iosProject?.includes(
      'PRODUCT_BUNDLE_IDENTIFIER = "' + EXPECTED_PACKAGE + '";',
    )
  )
    errors.push("Generated iOS bundle ID mismatch.");
  if (ios && !files.iosPlist?.includes("<key>CFBundleIdentifier</key>"))
    errors.push("Generated iOS Info.plist missing bundle identifier.");
  if (
    ios &&
    (!files.iosPlist?.includes("<key>CFBundleURLTypes</key>") ||
      !files.iosPlist?.includes("<string>eazicart</string>"))
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
    const platform =
      process.argv.slice(2).filter((arg) => arg !== "--")[0] ?? "all";
    const result = verifyNativePrebuild(
      {
        appJson: read("app.json"),
        ...(platform !== "ios" && {
          gradle: read("android/app/build.gradle"),
          androidManifest: read("android/app/src/main/AndroidManifest.xml"),
        }),
        ...(platform !== "android" && {
          iosProject: read("ios/EaziCart.xcodeproj/project.pbxproj"),
          iosPlist: read("ios/EaziCart/Info.plist"),
        }),
      },
      platform,
    );
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
