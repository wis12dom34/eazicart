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
  androidManifest:
    '<intent-filter><action android:name="android.intent.action.VIEW"/>' +
    '<category android:name="android.intent.category.BROWSABLE"/>' +
    '<data android:scheme="eazicart"/></intent-filter>',
  iosProject: 'PRODUCT_BUNDLE_IDENTIFIER = "com.eazicart.mobile.dev";',
  iosPlist:
    "<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>" +
    "<key>CFBundleURLTypes</key><array><dict>" +
    "<key>CFBundleURLSchemes</key><array><string>eazicart</string></array>" +
    "</dict></array>",
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

test("Android declarations in comments cannot hide a mismatched real identifier", () => {
  const gradle =
    "// namespace 'com.eazicart.mobile.dev'\nnamespace 'other.package'\n" +
    "// applicationId 'com.eazicart.mobile.dev'\napplicationId 'other.package'";
  assert.equal(verifyNativePrebuild({ ...valid, gradle }, "android").ok, false);
});

test("Android rejects a second conflicting application ID", () => {
  const gradle = valid.gradle + "\napplicationId 'com.eazicart.mobile'";
  assert.equal(verifyNativePrebuild({ ...valid, gradle }, "android").ok, false);
});

test("Android rejects commented and misplaced deep-link schemes", () => {
  const androidManifest =
    '<manifest><!-- ' + valid.androidManifest + ' --><data android:scheme="eazicart"/></manifest>';
  assert.equal(
    verifyNativePrebuild({ ...valid, androidManifest }, "android").ok,
    false,
  );
});

test("iOS comments and mixed bundle IDs cannot hide a mismatched target", () => {
  assert.equal(
    verifyNativePrebuild({
      ...valid,
      iosProject:
        "/* PRODUCT_BUNDLE_IDENTIFIER = \"com.eazicart.mobile.dev\"; */\n" +
        "PRODUCT_BUNDLE_IDENTIFIER = \"other.package\";",
    }, "ios").ok,
    false,
  );
  assert.equal(
    verifyNativePrebuild({
      ...valid,
      iosProject:
        valid.iosProject + '\nPRODUCT_BUNDLE_IDENTIFIER = "other.package";',
    }, "ios").ok,
    false,
  );
});

test("iOS scheme must belong to registered URL schemes, not a comment or unrelated key", () => {
  const iosPlist =
    "<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>" +
    "<!-- <key>CFBundleURLSchemes</key><array><string>eazicart</string></array> -->" +
    "<key>CFBundleURLTypes</key><array><dict>" +
    "<key>OtherKey</key><string>eazicart</string></dict></array>";
  assert.equal(verifyNativePrebuild({ ...valid, iosPlist }, "ios").ok, false);
});

test("missing Expo config fails closed instead of throwing", () => {
  assert.deepEqual(verifyNativePrebuild({ ...valid, appJson: "{}" }), {
    ok: false,
    errors: ["Invalid Expo app configuration."],
  });
});
