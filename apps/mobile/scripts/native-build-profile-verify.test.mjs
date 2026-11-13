import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkNativeBuildProfile,
  readNativeBuildConfiguration,
} from "./native-build-profile-verify.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = readNativeBuildConfiguration(root);
const safeEnv = Object.freeze({
  EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD: "1",
  EAZICART_ANDROID_QA_ALLOWED_API_HOST: "qa.internal.example.test",
  EXPO_PUBLIC_EAZICART_API_BASE_URL: "https://qa.internal.example.test/api",
  EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "0",
});
const verify = (profile, app = config.app, eas = config.eas, env = safeEnv) =>
  checkNativeBuildProfile({ profile, app, eas, env });

test("development and staging use internal distribution and correct environments", () => {
  for (const profile of ["development", "staging"])
    assert.deepEqual(verify(profile), { ok: true, errors: [] });
});
test("production and unknown profiles fail closed", () => {
  for (const profile of [
    undefined,
    "",
    "production",
    "release",
    "preview",
    "Development",
  ])
    assert.equal(verify(profile).ok, false, String(profile));
});
test("production IDs and incorrect schemes are not accepted", () => {
  for (const expo of [
    { ...config.app.expo, ios: { bundleIdentifier: "com.eazicart.mobile" } },
    { ...config.app.expo, android: { package: "com.eazicart.mobile" } },
    { ...config.app.expo, scheme: "other" },
  ])
    assert.equal(verify("development", { expo }).ok, false);
});
test("missing app or EAS configuration refuses builds", () => {
  assert.equal(verify("development", {}).ok, false);
  assert.equal(verify("development", config.app, {}).ok, false);
  assert.equal(verify("staging", config.app, { build: {} }).ok, false);
});
test("store distribution and production channels cannot be used for QA", () => {
  const dev = {
    ...config.eas.build,
    development: { ...config.eas.build.development, distribution: "store" },
  };
  const stage = {
    ...config.eas.build,
    staging: { ...config.eas.build.staging, channel: "production" },
  };
  assert.equal(verify("development", config.app, { build: dev }).ok, false);
  assert.equal(verify("staging", config.app, { build: stage }).ok, false);
});
test("environment omitted or set to production fails closed", () => {
  for (const profile of ["development", "staging"]) {
    const build = {
      ...config.eas.build,
      [profile]: { ...config.eas.build[profile] },
    };
    delete build[profile].environment;
    assert.equal(verify(profile, config.app, { build }).ok, false);
    build[profile].environment = "production";
    assert.equal(verify(profile, config.app, { build }).ok, false);
  }
});
test("development requires dev client and staging refuses it", () => {
  const dev = {
    ...config.eas.build,
    development: { ...config.eas.build.development, developmentClient: false },
  };
  const stage = {
    ...config.eas.build,
    staging: { ...config.eas.build.staging, developmentClient: true },
  };
  assert.equal(verify("development", config.app, { build: dev }).ok, false);
  assert.equal(verify("staging", config.app, { build: stage }).ok, false);
});
test("absent or production staging endpoints fail closed", () => {
  assert.equal(verify("development", config.app, config.eas, {}).ok, false);
  assert.equal(
    verify("development", config.app, config.eas, {
      ...safeEnv,
      EXPO_PUBLIC_EAZICART_API_BASE_URL: "https://eazicart.com/api",
    }).ok,
    false,
  );
  assert.equal(
    verify("staging", config.app, config.eas, {
      ...safeEnv,
      EAZICART_ANDROID_QA_ALLOWED_API_HOST: "not-approved.example.test",
    }).ok,
    false,
  );
});
test("secrets, admin preview and absent explicit authorization are refused", () => {
  for (const override of [
    { EXPO_PUBLIC_KORAPAY_SECRET_KEY: "secret" },
    { EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "1" },
    { EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD: "0" },
  ])
    assert.equal(
      verify("development", config.app, config.eas, { ...safeEnv, ...override })
        .ok,
      false,
    );
});
test("pre-install CLI checks the EAS_BUILD_PROFILE without explicit arguments", () => {
  const hook = fileURLToPath(
    new URL("./native-build-profile-verify.mjs", import.meta.url),
  );
  const valid = spawnSync(process.execPath, [hook], {
    env: { ...safeEnv, EAS_BUILD_PROFILE: "development" },
    encoding: "utf8",
  });
  assert.equal(valid.status, 0, valid.stderr);
  const store = spawnSync(process.execPath, [hook], {
    env: { ...safeEnv, EAS_BUILD_PROFILE: "production" },
    encoding: "utf8",
  });
  assert.equal(store.status, 23);
  assert.match(store.stderr, /Production\/store builds are disabled/);
  const missing = spawnSync(process.execPath, [hook], {
    env: safeEnv,
    encoding: "utf8",
  });
  assert.equal(missing.status, 23);
});
