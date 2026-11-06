#!/usr/bin/env node
/**
 * Fail-closed Android QA configuration check. This program does not fetch
 * anything, build, upload artifacts, or contact any payment service.
 */
import { fileURLToPath } from "node:url";

export function checkAndroidQaApiEnvironment(env) {
  const errors = [];
  const explicitApi = env.EXPO_PUBLIC_EAZICART_API_BASE_URL;
  const allowHost = env.EAZICART_ANDROID_QA_ALLOWED_API_HOST;
  if (!explicitApi || !allowHost) {
    return {
      ok: false,
      errors: [
        "Explicit staging API URL and approved QA hostname are required.",
      ],
    };
  }
  let url;
  try {
    url = new URL(explicitApi);
  } catch {
    return { ok: false, errors: ["Invalid staging API URL."] };
  }

  const host = url.hostname.toLowerCase();
  const allow = allowHost.toLowerCase();
  if (
    host !== allow ||
    !/^[a-z0-9.-]+$/.test(allow) ||
    allow.includes("eazicart.com") ||
    allow.includes("korapay.com") ||
    host.includes("eazicart.com") ||
    host.includes("korapay.com") ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "10.0.2.2" ||
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api"
  )
    errors.push(
      "Only the explicitly allowlisted HTTPS staging API at /api is permitted.",
    );

  if (env.EXPO_PUBLIC_EAZICART_ENABLE_ADMIN_AUDIT_PREVIEW === "1") {
    errors.push(
      "The admin audit preview must remain disabled for build artifacts.",
    );
  }
  if (env.EXPO_PUBLIC_EAZICART_ADMIN_AUDIT_PREVIEW_BASE_URL) {
    errors.push(
      "Do not configure an audit preview URL in shared Android QA builds.",
    );
  }
  if (env.EAZICART_ANDROID_QA_ALLOW_DEBUG_BUILD !== "1") {
    errors.push("Explicit debug-build authorization flag is missing.");
  }
  for (const [key, value] of Object.entries(env)) {
    if (
      key.startsWith("EXPO_PUBLIC_") &&
      /(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|KORAPAY_KEY|PAYSTACK_KEY)/i.test(
        key,
      ) &&
      typeof value === "string" &&
      value.trim() !== ""
    )
      errors.push(
        "A public mobile environment variable looks like a secret: " + key,
      );
  }
  return { ok: errors.length === 0, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = checkAndroidQaApiEnvironment(process.env);
  if (!result.ok) {
    for (const error of result.errors) console.error("REFUSED: " + error);
    process.exitCode = 23;
  } else {
    console.log(
      "QA preflight passed: approved staging host, HTTPS and disabled admin preview.",
    );
  }
}
