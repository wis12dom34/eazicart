import assert from "node:assert/strict";
import { test } from "node:test";
import {
  matchesDisposableStagingAttestation,
  probeDisposableStagingApi,
} from "./android-staging-attestation.mjs";

const url = "https://qa.internal.example.test/api/preview/staging/health";
const env = Object.freeze({
  EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD: "1",
  EAZICART_ANDROID_QA_ALLOWED_API_HOST: "qa.internal.example.test",
  EXPO_PUBLIC_EAZICART_API_BASE_URL: "https://qa.internal.example.test/api",
  EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "0",
});
const attested = {
  data: {
    status: "ok",
    service: "eazicart-api",
    environment: "DISPOSABLE_FIXTURE",
    databaseScope: "EPHEMERAL_POSTGRESQL",
    paymentProvider: "SYNTHETIC",
    realPaymentsEnabled: false,
  },
};
const reply = (data = attested, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

test("accepts exact synthetic staging proof with a GET-only HTTPS request", async () => {
  let calls = 0;
  const r = await probeDisposableStagingApi(env, async (target, init) => {
    calls++;
    assert.equal(target, url);
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.body, undefined);
    return reply();
  });
  assert.deepEqual(r, { ok: true, reason: "ISOLATED_STAGING_VERIFIED" });
  assert.equal(calls, 1);
});

test("refuses to make a network request for missing or production API config", async () => {
  let called = false;
  const spy = async () => {
    called = true;
    return reply();
  };
  for (const override of [
    {},
    { ...env, EXPO_PUBLIC_EAZICART_API_BASE_URL: "https://eazicart.com/api" },
    {
      ...env,
      EXPO_PUBLIC_EAZICART_API_BASE_URL: "http://qa.internal.example.test/api",
    },
    { ...env, EAZICART_ANDROID_QA_ALLOWED_API_HOST: "evil.example.test" },
    { ...env, EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW: "1" },
  ]) {
    assert.equal((await probeDisposableStagingApi(override, spy)).ok, false);
  }
  assert.equal(called, false);
});

test("rejects ordinary healthy APIs, live-payment mode, nonfixture databases", async () => {
  for (const data of [
    { status: "ok", service: "eazicart-api" },
    { data: { ...attested.data, realPaymentsEnabled: true } },
    { data: { ...attested.data, paymentProvider: "KORAPAY" } },
    { data: { ...attested.data, databaseScope: "PRODUCTION" } },
    { data: { ...attested.data, environment: "PRODUCTION" } },
    { data: { ...attested.data, service: "other-api" } },
    null,
  ]) {
    assert.equal(matchesDisposableStagingAttestation(data), false);
    const result = await probeDisposableStagingApi(env, async () =>
      reply(data),
    );
    assert.deepEqual(result, { ok: false, reason: "NOT_DISPOSABLE_STAGING" });
  }
});

test("rejects redirects, foreign response origins, non-JSON and 503", async () => {
  const redirected = reply();
  Object.defineProperty(redirected, "redirected", { value: true });
  assert.equal(
    (await probeDisposableStagingApi(env, async () => redirected)).reason,
    "UNEXPECTED_REDIRECT",
  );
  const wrongOrigin = reply();
  Object.defineProperty(wrongOrigin, "url", {
    value: "https://eazicart.com/api/health",
  });
  assert.equal(
    (await probeDisposableStagingApi(env, async () => wrongOrigin)).reason,
    "UNEXPECTED_RESPONSE_URL",
  );
  const html = new Response("<html>Login</html>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });
  assert.equal(
    (await probeDisposableStagingApi(env, async () => html)).reason,
    "INVALID_STAGING_RESPONSE",
  );
  assert.equal(
    (await probeDisposableStagingApi(env, async () => reply({}, 503))).reason,
    "STAGING_UNAVAILABLE",
  );
});

test("unreachable and aborted connections fail closed", async () => {
  const broken = await probeDisposableStagingApi(env, async () => {
    throw new Error("synthetic DNS failure");
  });
  assert.deepEqual(broken, {
    ok: false,
    reason: "STAGING_NETWORK_UNAVAILABLE",
  });
});
