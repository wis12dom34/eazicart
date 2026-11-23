import { describe, expect, it } from "vitest";
import {
  DEVICE_COOKIE,
  deviceCookie,
  deviceSecret,
  digestSecret,
  equalDigests,
  requireSameOrigin,
  validDeviceSecret,
} from "../src/modules/auth/browser-account-security.js";
const origin = "https://eazicart.com";
const check = (
  headers: Pick<import("fastify").FastifyRequest, "headers">["headers"],
) =>
  requireSameOrigin(
    { headers } as Parameters<typeof requireSameOrigin>[0],
    origin,
  );
describe("browser-bound account security primitives", () => {
  it("generates unique 384-bit device credentials and fixed-length digests", () => {
    const a = deviceSecret(),
      b = deviceSecret();
    expect(a).not.toBe(b);
    expect(validDeviceSecret(a)).toBe(true);
    expect(digestSecret(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(equalDigests(digestSecret(a), digestSecret(a))).toBe(true);
    expect(equalDigests(digestSecret(a), digestSecret(b))).toBe(false);
  });
  it("rejects malformed credentials and digests", () => {
    expect(validDeviceSecret("short")).toBe(false);
    expect(equalDigests("oops", digestSecret(deviceSecret()))).toBe(false);
  });
  it("requires exact origin and same-origin fetch metadata", () => {
    expect(() =>
      check({ origin, "sec-fetch-site": "same-origin" }),
    ).not.toThrow();
    for (const headers of [
      {},
      { origin: "https://evil.example" },
      { origin, "sec-fetch-site": "cross-site" },
      { origin: "https://eazicart.com.evil.example" },
      { origin, "sec-fetch-site": "same-site" },
    ])
      expect(() => check(headers)).toThrow();
  });
  it("issues only secure host-scoped HttpOnly Strict cookies", () => {
    const cookie = deviceCookie(deviceSecret(), 86400);
    expect(cookie).toContain(`${DEVICE_COOKIE}=`);
    for (const flag of [
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Max-Age=86400",
    ])
      expect(cookie).toContain(flag);
    expect(cookie).not.toContain("Domain=");
  });
});
