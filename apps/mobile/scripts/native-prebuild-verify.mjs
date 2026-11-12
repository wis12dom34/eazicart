#!/usr/bin/env node
/** Read-only verification of Expo-generated development native projects. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_PACKAGE = "com.eazicart.mobile.dev";

function removeCodeComments(source) {
  if (typeof source !== "string") return "";
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\r\n]*/g, "");
}

function removeXmlComments(source) {
  return typeof source === "string"
    ? source.replace(/<!--[\s\S]*?-->/g, "")
    : "";
}

function hasExactGradleDeclaration(source, field) {
  const pattern = new RegExp(
    "^\\s*" + field + "\\s+(?:'([^']+)'|\"([^\"]+)\")\\s*$",
    "gm",
  );
  const matches = Array.from(
    source.matchAll(pattern),
    (match) => match[1] ?? match[2],
  );
  // Reject both missing declarations and mixed development/production variants.
  return (
    matches.length > 0 && matches.every((value) => value === EXPECTED_PACKAGE)
  );
}

function hasCorrectIosBundleIds(source) {
  const matches = Array.from(
    source.matchAll(
      /\bPRODUCT_BUNDLE_IDENTIFIER\s*=\s*(?:"([^"]+)"|([^;]+))\s*;/g,
    ),
    (match) => (match[1] ?? match[2]).trim(),
  );
  return (
    matches.length > 0 && matches.every((value) => value === EXPECTED_PACKAGE)
  );
}

function hasAndroidDeepLink(source) {
  // Android resolves external app links only from an exported activity with
  // matching VIEW, DEFAULT, BROWSABLE and scheme entries in one intent filter.
  // Require Expo's MainActivity; a matching filter elsewhere is insufficient.
  const activities = source.matchAll(
    /<activity\b([^>]*)>([\s\S]*?)<\/activity>/g,
  );
  for (const [, attributes, body] of activities) {
    if (!/\bandroid:name\s*=\s*["']\.MainActivity["']/.test(attributes))
      continue;
    if (!/\bandroid:exported\s*=\s*["']true["']/.test(attributes)) continue;
    const filters =
      body.match(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g) ?? [];
    if (
      filters.some(
        (filter) =>
          /<action\b[^>]*\bandroid:name\s*=\s*["']android\.intent\.action\.VIEW["'][^>]*\/?>/.test(
            filter,
          ) &&
          /<category\b[^>]*\bandroid:name\s*=\s*["']android\.intent\.category\.DEFAULT["'][^>]*\/?>/.test(
            filter,
          ) &&
          /<category\b[^>]*\bandroid:name\s*=\s*["']android\.intent\.category\.BROWSABLE["'][^>]*\/?>/.test(
            filter,
          ) &&
          /<data\b[^>]*\bandroid:scheme\s*=\s*["']eazicart["'][^>]*\/?>/.test(
            filter,
          ),
      )
    ) {
      return true;
    }
  }
  return false;
}

function hasIosDeepLink(source) {
  if (!/<key>\s*CFBundleURLTypes\s*<\/key>/.test(source)) return false;
  const schemes = source.match(
    /<key>\s*CFBundleURLSchemes\s*<\/key>\s*<array>([\s\S]*?)<\/array>/,
  )?.[1];
  return Boolean(schemes && /<string>\s*eazicart\s*<\/string>/.test(schemes));
}

export function verifyNativePrebuild(files, platform = "all") {
  if (!["all", "android", "ios"].includes(platform))
    return { ok: false, errors: ["Unsupported native platform."] };
  const android = platform !== "ios";
  const ios = platform !== "android";
  const errors = [];
  let config;
  try {
    config = JSON.parse(files.appJson)?.expo;
    if (!config || typeof config !== "object" || Array.isArray(config))
      throw new Error("Missing Expo configuration");
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

  if (android) {
    const gradle = removeCodeComments(files.gradle);
    if (
      !hasExactGradleDeclaration(gradle, "applicationId") ||
      !hasExactGradleDeclaration(gradle, "namespace")
    )
      errors.push("Generated Android application ID or namespace mismatch.");
    if (!hasAndroidDeepLink(removeXmlComments(files.androidManifest)))
      errors.push("Generated Android deep-link intent filter missing.");
  }

  if (ios) {
    if (!hasCorrectIosBundleIds(removeCodeComments(files.iosProject)))
      errors.push("Generated iOS bundle ID mismatch.");
    const plist = removeXmlComments(files.iosPlist);
    if (
      !/<key>\s*CFBundleIdentifier\s*<\/key>\s*<string>\s*(?:\$\(PRODUCT_BUNDLE_IDENTIFIER\)|com\.eazicart\.mobile\.dev)\s*<\/string>/.test(
        plist,
      )
    )
      errors.push(
        "Generated iOS Info.plist bundle identifier missing or invalid.",
      );
    if (!hasIosDeepLink(plist))
      errors.push("Generated iOS deep-link URL scheme missing.");
  }

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
        "PASS: generated " +
          platform +
          " development identifiers and deep links verified.",
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
