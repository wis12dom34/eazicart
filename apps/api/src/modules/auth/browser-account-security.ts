import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { AppError } from "../../errors.js";

// Browser device credentials are random, HttpOnly-cookie-only secrets. The
// database stores only their SHA-256 digests; never expose them to JavaScript.
export const DEVICE_COOKIE = "__Host-eazicart_device";
export const deviceSecret = () => randomBytes(48).toString("base64url");
export const digestSecret = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
export function validDeviceSecret(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{64}$/.test(value);
}
export function equalDigests(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right))
    return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
export function requireSameOrigin(
  request: Pick<FastifyRequest, "headers">,
  origin: string,
) {
  // Cookie-authenticated mutation endpoints must not accept missing Origin;
  // browsers send Origin on cross-site requests, including form POSTs.
  const actual = request.headers.origin;
  if (typeof actual !== "string" || actual !== origin)
    throw new AppError(
      403,
      "INVALID_ORIGIN",
      "This request must originate from EaziCart",
    );
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin")
    throw new AppError(
      403,
      "INVALID_FETCH_SITE",
      "Cross-site account actions are blocked",
    );
}
export function deviceCookie(secret: string, maxAgeSeconds: number) {
  if (!validDeviceSecret(secret))
    throw new Error("Invalid browser device credential");
  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds <= 0)
    throw new Error("Invalid cookie lifetime");
  return `${DEVICE_COOKIE}=${secret}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
}
