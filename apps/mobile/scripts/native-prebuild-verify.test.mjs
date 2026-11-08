import assert from "node:assert/strict";
import { test } from "node:test";
import {
  verifyNativePrebuild,
  EXPECTED_PACKAGE,
} from "./native-prebuild-verify.mjs";

const valid = {
  appJson: JSON.stringify({
    expo: {
      android: { package: EXPECTED_PACKAGE },
      ios: { bundleIdentifier: EXPECTED_PACKAGE },
      scheme: "eazicart",
    },
  }),
  gradle:
    "namespace 'com.eazicart.mobile.dev'\napplicationId 'com.eazicart.mobile.dev'",
  androidManifest: '<data android:scheme="eazicart"/>',
  iosProject: 'PRODUCT_BUNDLE_IDENTIFIER = "com.eazicart.mobile.dev";',
  iosPlist:
    "<key>CFBundleIdentifier</key><key>CFBundleURLTypes</key><string>eazicart</string>",
};

test("correct generated development identifiers pass", () => {
  assert.deepEqual(verifyNativePrebuild(valid), { ok: true, errors: [] });
});

test("production or mismatched Android application ID is rejected", () => {
  assert.equal(
    verifyNativePrebuild({
      ...valid,
      gradle: valid.gradle.replaceAll(".dev", ""),
    }).ok,
    false,
  );
});

test("mismatched iOS bundle identifier is rejected", () => {
  assert.equal(
    verifyNativePrebuild({
      ...valid,
      iosProject: valid.iosProject.replace(".dev", ""),
    }).ok,
    false,
  );
});

test("missing Android or iOS deep links are rejected", () => {
  assert.equal(
    verifyNativePrebuild({ ...valid, androidManifest: "<manifest/>" }).ok,
    false,
  );
  assert.equal(
    verifyNativePrebuild({
      ...valid,
      iosPlist: "<key>CFBundleIdentifier</key>",
    }).ok,
    false,
  );
});

test("malformed app configuration is rejected", () => {
  assert.equal(verifyNativePrebuild({ ...valid, appJson: "{" }).ok, false);
});

test("Android-only prebuild verifies Android without requiring generated iOS files", () => {
  const { iosProject, iosPlist, ...androidOnly } = valid;
  assert.equal(verifyNativePrebuild(androidOnly, "android").ok, true);
  assert.equal(
    verifyNativePrebuild({ ...androidOnly, androidManifest: "" }, "android").ok,
    false,
  );
});

test("iOS-only prebuild verifies iOS without requiring generated Android files", () => {
  const { gradle, androidManifest, ...iosOnly } = valid;
  assert.equal(verifyNativePrebuild(iosOnly, "ios").ok, true);
  assert.equal(
    verifyNativePrebuild({ ...iosOnly, iosProject: "" }, "ios").ok,
    false,
  );
});

test("unknown native prebuild platform is rejected", () => {
  assert.equal(verifyNativePrebuild(valid, "production").ok, false);
});
