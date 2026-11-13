#!/usr/bin/env node
/**
 * Fail-closed EAS build gate. This runs in the EAS pre-install lifecycle hook.
 * No build, network access, publication or provisioning occurs here.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkAndroidQaApiEnvironment } from "./android-qa-api-preflight.mjs";

const DEV_ID = "com.eazicart.mobile.dev";

export function checkNativeBuildProfile({ app, eas, profile, env = {} }) {
  if (profile === "production")
    return {
      ok: false,
      errors: [
        "Production/store builds are disabled until separate store IDs and release approval are configured.",
      ],
    };
  if (!["development", "staging"].includes(profile))
    return {
      ok: false,
      errors: ["An explicit development or staging profile is required."],
    };

  const errors = [];
  const expo = app?.expo;
  if (
    !expo ||
    expo.android?.package !== DEV_ID ||
    expo.ios?.bundleIdentifier !== DEV_ID ||
    expo.scheme !== "eazicart"
  ) {
    errors.push(
      "Only the dedicated development native IDs and scheme are permitted.",
    );
  }
  const selected = eas?.build?.[profile];
  if (
    !selected ||
    selected.distribution !== "internal" ||
    selected.channel !== profile
  )
    errors.push(
      "QA builds require the matching internal distribution and channel.",
    );
  const expectedEnvironment =
    profile === "development" ? "development" : "preview";
  if (selected?.environment !== expectedEnvironment)
    errors.push(
      "QA builds require the dedicated EAS environment, not the production default.",
    );
  if (profile === "development" && selected?.developmentClient !== true)
    errors.push("Development builds require the native development client.");
  if (profile === "staging" && selected?.developmentClient === true)
    errors.push("Staging builds must not enable the development client.");

  // Reuse existing exact-host, private-staging, preview, and secret protections.
  errors.push(...checkAndroidQaApiEnvironment(env).errors);
  return { ok: errors.length === 0, errors };
}

export function readNativeBuildConfiguration(root) {
  return {
    app: JSON.parse(readFileSync(path.join(root, "app.json"), "utf8")),
    eas: JSON.parse(readFileSync(path.join(root, "eas.json"), "utf8")),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let result;
  try {
    const root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    result = checkNativeBuildProfile({
      ...readNativeBuildConfiguration(root),
      profile: process.argv[2] ?? process.env.EAS_BUILD_PROFILE,
      env: process.env,
    });
  } catch {
    result = {
      ok: false,
      errors: ["Native build configuration is missing or invalid."],
    };
  }
  if (!result.ok) {
    result.errors.forEach((error) => console.error("REFUSED: " + error));
    process.exitCode = 23;
  } else {
    console.log(
      "PASS: internal native QA profile and staging environment verified.",
    );
  }
}
