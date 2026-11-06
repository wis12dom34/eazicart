#!/usr/bin/env node
/**
 * A fail-closed, GET-only staging identity check before dependency installation.
 * No secrets, writes, charge initiation, deployment or privileged operations.
 */
import { fileURLToPath } from "node:url";
import { checkAndroidQaApiEnvironment } from "./android-qa-api-preflight.mjs";

const REQUIRED = Object.freeze({
  service: "eazicart-native-staging",
  environment: "disposable-fixture",
  contractVersion: 1,
  nativeCheckoutEnabled: false,
  paymentMode: "synthetic-only",
  databaseMode: "temporary-postgresql",
});

export async function checkAndroidQaStagingIdentity(
  env,
  fetchImpl = globalThis.fetch,
) {
  const config = checkAndroidQaApiEnvironment(env);
  if (!config.ok) return { ok: false, errors: config.errors };
  const base = env.EXPO_PUBLIC_EAZICART_API_BASE_URL;
  const endpoint = base + "/preview/staging/identity";
  let result;
  try {
    result = await fetchImpl(endpoint, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    return {
      ok: false,
      errors: [
        "The approved isolated staging API could not be reached securely.",
      ],
    };
  }

  if (
    result.status !== 200 ||
    (result.url && result.url !== endpoint) ||
    result.headers.get("x-eazicart-qa-environment") !== "disposable-fixture" ||
    !result.headers.get("cache-control")?.includes("no-store") ||
    !result.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  ) {
    return {
      ok: false,
      errors: ["The approved API did not return an isolated staging identity."],
    };
  }

  try {
    const body = await result.text();
    // Do not accept a large HTML error page or unexpected remote payload.
    if (Buffer.byteLength(body, "utf8") > 2048)
      throw new Error("Oversized identity response");
    const value = JSON.parse(body);
    if (
      !value ||
      typeof value !== "object" ||
      !value.data ||
      typeof value.data !== "object" ||
      Object.entries(REQUIRED).some(
        ([key, expected]) => value.data[key] !== expected,
      )
    ) {
      throw new Error("Untrusted staging identity");
    }
    return { ok: true, errors: [] };
  } catch {
    return {
      ok: false,
      errors: [
        "The staging identity is invalid or checkout is not safely disabled.",
      ],
    };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await checkAndroidQaStagingIdentity(process.env);
  if (!result.ok) {
    for (const message of result.errors) console.error("REFUSED: " + message);
    process.exitCode = 23;
  } else {
    console.log(
      "PASS: isolated staging identity confirmed; synthetic payment mode and checkout disabled.",
    );
  }
}
