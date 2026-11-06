import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAndroidQaApiEnvironment } from "./android-qa-api-preflight.mjs";

const good = Object.freeze({
  EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD: "1",
  EAZICART_ANDROID_QA_ALLOWED_API_HOST: "qa.internal.example.test",
  EXPO_PUBLIC_EAZICART_API_BASE_URL: "https://qa.internal.example.test/api",
  EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "0",
});

test("accepts explicit, isolated HTTPS staging API", () => {
  assert.deepEqual(checkAndroidQaApiEnvironment(good), {
    ok: true,
    errors: [],
  });
});
test("never falls back to production on missing QA configuration", () => {
  assert.equal(checkAndroidQaApiEnvironment({}).ok, false);
  assert.equal(
    checkAndroidQaApiEnvironment({
      ...good,
      EXPO_PUBLIC_EAZICART_API_BASE_URL: undefined,
    }).ok,
    false,
  );
});
test("rejects production, providers, lookalikes, insecure and localhost URLs", () => {
  const blocked = [
    "https://eazicart.com/api",
    "https://staging.eazicart.com/api",
    "https://eazicart.com.evil.test/api",
    "https://api.korapay.com/api",
    "https://qa.internal.example.test.evil.test/api",
    "http://qa.internal.example.test/api",
    "https://qa.internal.example.test/api?token=secret",
    "https://user:pass@qa.internal.example.test/api",
    "https://qa.internal.example.test/api#frag",
    "https://qa.internal.example.test/orders",
    "http://127.0.0.1:3000/api",
  ];
  for (const value of blocked) {
    assert.equal(
      checkAndroidQaApiEnvironment({
        ...good,
        EXPO_PUBLIC_EAZICART_API_BASE_URL: value,
      }).ok,
      false,
      value,
    );
  }
});
test("rejects disabling the explicit build approval", () => {
  assert.equal(
    checkAndroidQaApiEnvironment({
      ...good,
      EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD: "0",
    }).ok,
    false,
  );
});
test("rejects admin preview enablement, preview URLs, and public secret variables", () => {
  const overrides = [
    { EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "1" },
    {
      EXPO_PUBLIC_EAZICART_ADMIN_AUDIT_PREVIEW_BASE_URL:
        "https://qa.internal.example.test/api",
    },
    { EXPO_PUBLIC_KORAPAY_SECRET_KEY: "do-not-ship" },
    { EXPO_PUBLIC_CUSTOM_AUTH_TOKEN: "do-not-ship" },
  ];
  for (const extra of overrides) {
    assert.equal(checkAndroidQaApiEnvironment({ ...good, ...extra }).ok, false);
  }
});
test("rejects invalid approval host", () => {
  for (const host of [
    "eazicart.com",
    "staging.eazicart.com",
    "qa.korapay.com",
    "other.example.test",
    "",
    "*.example.test",
  ]) {
    assert.equal(
      checkAndroidQaApiEnvironment({
        ...good,
        EAZICART_ANDROID_QA_ALLOWED_API_HOST: host,
      }).ok,
      false,
    );
  }
});
