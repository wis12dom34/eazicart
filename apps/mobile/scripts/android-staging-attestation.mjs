#!/usr/bin/env node
/**
 * Run only on an authorized isolated Android QA machine.
 *
 * Before an APK build, verify that the configured hostname serves EaziCart's
 * *disposable synthetic* staging service. Never silently fall back to the
 * live eazicart.com API, and never send a token or payment request.
 */
import { fileURLToPath } from "node:url";
import { checkAndroidQaApiEnvironment } from "./android-qa-api-preflight.mjs";

const EXPECTED = Object.freeze({
  status: "ok",
  service: "eazicart-api",
  environment: "DISPOSABLE_FIXTURE",
  databaseScope: "EPHEMERAL_POSTGRESQL",
  paymentProvider: "SYNTHETIC",
  realPaymentsEnabled: false,
});

export function matchesDisposableStagingAttestation(body) {
  const data = body?.data;
  return Boolean(
    data &&
    typeof data === "object" &&
    Object.entries(EXPECTED).every(([key, value]) => data[key] === value),
  );
}

export async function probeDisposableStagingApi(
  env,
  fetcher = fetch,
  timeoutMs = 8_000,
) {
  const preflight = checkAndroidQaApiEnvironment(env);
  if (!preflight.ok) return { ok: false, reason: "STAGING_CONFIG_REJECTED" };

  const base = new URL(env.EXPO_PUBLIC_EAZICART_API_BASE_URL);
  const requested = new URL(base.toString() + "/preview/staging/health");
  const controller = new AbortController();
  const boundedTimeout = Math.max(100, Math.min(15_000, timeoutMs));
  const timer = setTimeout(() => controller.abort(), boundedTimeout);
  try {
    const response = await fetcher(requested.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    // Reject redirects even if the injected client ignores redirect: "error".
    if (response.redirected)
      return { ok: false, reason: "UNEXPECTED_REDIRECT" };
    if (response.url && response.url !== requested.toString()) {
      return { ok: false, reason: "UNEXPECTED_RESPONSE_URL" };
    }
    if (!response.ok) return { ok: false, reason: "STAGING_UNAVAILABLE" };
    const type = response.headers.get("content-type") ?? "";
    if (!/^application\/json(?:\s*;|$)/i.test(type)) {
      return { ok: false, reason: "INVALID_STAGING_RESPONSE" };
    }
    const json = await response.json();
    if (!matchesDisposableStagingAttestation(json)) {
      return { ok: false, reason: "NOT_DISPOSABLE_STAGING" };
    }
    return { ok: true, reason: "ISOLATED_STAGING_VERIFIED" };
  } catch {
    return { ok: false, reason: "STAGING_NETWORK_UNAVAILABLE" };
  } finally {
    clearTimeout(timer);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await probeDisposableStagingApi(process.env);
  if (!result.ok) {
    console.error("REFUSED: " + result.reason);
    process.exitCode = 23;
  } else {
    console.log(
      "PASS: isolated synthetic staging API attested; no live payment capability.",
    );
  }
}
