import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAndroidQaStagingIdentity } from "./android-qa-staging-handshake.mjs";

const env = Object.freeze({
  EXPO_PUBLIC_EAZICART_API_BASE_URL: "https://qa.internal.example.test/api",
  EAZICART_ANDROID_QA_ALLOWED_API_HOST: "qa.internal.example.test",
  EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD: "1",
  EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "0",
});

const identity = {
  data: {
    service: "eazicart-native-staging",
    environment: "disposable-fixture",
    contractVersion: 1,
    nativeCheckoutEnabled: false,
    paymentMode: "synthetic-only",
    databaseMode: "temporary-postgresql",
  },
};

function reply(body = identity, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: {
      "content-type": options.contentType ?? "application/json",
      "cache-control": options.cacheControl ?? "private, no-store",
      "x-eazicart-qa-environment": options.marker ?? "disposable-fixture",
    },
  });
}

test("only GETs the approved HTTPS staging identity, without credentials", async () => {
  let calls = 0;
  const result = await checkAndroidQaStagingIdentity(env, async (url, init) => {
    calls++;
    assert.equal(
      url,
      "https://qa.internal.example.test/api/preview/staging/identity",
    );
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.equal(init.credentials, "omit");
    assert.equal(init.headers.Accept, "application/json");
    assert.ok(init.signal instanceof AbortSignal);
    return reply();
  });
  assert.deepEqual(result, { ok: true, errors: [] });
  assert.equal(calls, 1);
});

test("missing or unsafe configuration aborts before ANY network request", async () => {
  let calls = 0;
  const fetchSpy = async () => {
    calls++;
    return reply();
  };
  for (const bad of [
    {},
    { ...env, EXPO_PUBLIC_EAZICART_API_BASE_URL: "https://eazicart.com/api" },
    {
      ...env,
      EXPO_PUBLIC_EAZICART_API_BASE_URL: "http://qa.internal.example.test/api",
    },
    {
      ...env,
      EXPO_PUBLIC_EAZICART_API_BASE_URL:
        "https://qa.internal.example.test/api?x=1",
    },
    { ...env, EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "1" },
    { ...env, EXPO_PUBLIC_KORAPAY_SECRET: "forbidden" },
    { ...env, EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD: "0" },
  ])
    assert.equal(
      (await checkAndroidQaStagingIdentity(bad, fetchSpy)).ok,
      false,
    );
  assert.equal(calls, 0);
});

test("bad or missing environment marker, cache, JSON or HTTP success fails closed", async () => {
  const unsafe = [
    reply(identity, { status: 503 }),
    reply(identity, { marker: "production" }),
    reply(identity, { cacheControl: "public, max-age=60" }),
    reply(identity, { contentType: "text/html" }),
    reply({ service: "eazicart-native-staging" }),
    reply({ data: { ...identity.data, nativeCheckoutEnabled: true } }),
    reply({ data: { ...identity.data, paymentMode: "live" } }),
    reply({ data: { ...identity.data, databaseMode: "production" } }),
    reply({ data: { ...identity.data, contractVersion: 2 } }),
    reply({ data: { ...identity.data, service: "spoofed" } }),
    reply({ data: { ...identity.data, environment: "production" } }),
    reply({ data: { ...identity.data, big: "a".repeat(4000) } }),
  ];
  for (const bad of unsafe)
    assert.equal(
      (await checkAndroidQaStagingIdentity(env, async () => bad)).ok,
      false,
    );
});

test("network error or timeout returns a failure without retrying", async () => {
  let calls = 0;
  const result = await checkAndroidQaStagingIdentity(env, async () => {
    calls++;
    throw new Error("synthetic network error");
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 1);
});

test("redirected response URL cannot be accepted as staging proof", async () => {
  const response = reply();
  Object.defineProperty(response, "url", {
    value: "https://eazicart.com/api/preview/staging/identity",
  });
  assert.equal(
    (await checkAndroidQaStagingIdentity(env, async () => response)).ok,
    false,
  );
});

test("preflight does not trust a successful HTML page with an identity-looking body", async () => {
  const result = await checkAndroidQaStagingIdentity(
    env,
    async () =>
      new Response("<html>isolated staging</html>", {
        status: 200,
        headers: {
          "x-eazicart-qa-environment": "disposable-fixture",
          "cache-control": "private, no-store",
          "content-type": "text/html",
        },
      }),
  );
  assert.equal(result.ok, false);
});
