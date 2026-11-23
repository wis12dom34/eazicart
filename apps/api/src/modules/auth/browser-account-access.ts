import type { FastifyRequest } from "fastify";
import type { JWTPayload } from "jose";
import type { BrowserAccountStore } from "./browser-account-store.js";
import {
  DEVICE_COOKIE,
  digestSecret,
  equalDigests,
  validDeviceSecret,
} from "./browser-account-security.js";

export function readBrowserDeviceHash(
  request: Pick<FastifyRequest, "headers">,
) {
  const matches = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(DEVICE_COOKIE + "="));
  if (matches?.length !== 1) return undefined;
  const secret = matches[0]?.slice(DEVICE_COOKIE.length + 1);
  return validDeviceSecret(secret) ? digestSecret(secret) : undefined;
}

export async function verifyBrowserAccountAccess(
  request: FastifyRequest,
  payload: JWTPayload,
  store?: BrowserAccountStore,
) {
  if (
    payload.browserDevice === undefined &&
    payload.browserGeneration === undefined
  )
    return;
  if (
    !store ||
    !payload.sub ||
    typeof payload.browserDevice !== "string" ||
    typeof payload.browserGeneration !== "string"
  ) {
    throw new Error("Invalid browser account claims");
  }

  const hash = readBrowserDeviceHash(request);
  const generation = hash
    ? await store.findActiveGeneration(payload.browserDevice, hash, payload.sub)
    : undefined;
  if (
    !generation ||
    !equalDigests(payload.browserGeneration, digestSecret(generation))
  ) {
    throw new Error("Browser account is no longer active");
  }
}
