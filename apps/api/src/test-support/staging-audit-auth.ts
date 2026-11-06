import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { AppError } from "../errors.js";

/**
 * Disposable-test-only finance audit authenticator. NOT a production auth
 * provider. Tokens die on process restart and cannot access EaziCart's regular
 * buyer API. The reconciliation routes still check User.role in PostgreSQL
 * on every request.
 */
const AUDIENCE = "eazicart-disposable-finance-audit";
const VERSION = 1;
type Claims = {
  version: number;
  audience: string;
  sub: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
type Clock = () => number;

function permitted() {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.EAZICART_IDEM_DISPOSABLE === "1" &&
    process.env.EAZICART_KORA_FIXTURE_ONLY === "1"
  );
}

export function createDisposableAuditAuth(clock: Clock = Date.now) {
  if (!permitted()) {
    throw new Error("Disposable finance audit authentication is test-only");
  }
  const secret = randomBytes(32);
  const signing = (data: string) =>
    createHmac("sha256", secret).update(data).digest();

  const issueForTest = (principal: string, lifetimeSeconds = 120) => {
    if (
      !/^[A-Za-z0-9_-]{3,128}$/.test(principal) ||
      !Number.isInteger(lifetimeSeconds) ||
      lifetimeSeconds < 1 ||
      lifetimeSeconds > 300
    )
      throw new Error("Invalid test principal or session duration");
    const issuedAt = Math.floor(clock() / 1000);
    const payload: Claims = {
      version: VERSION,
      audience: AUDIENCE,
      sub: principal,
      issuedAt,
      expiresAt: issuedAt + lifetimeSeconds,
      nonce: randomBytes(16).toString("base64url"),
    };
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    return body + "." + signing(body).toString("base64url");
  };

  const verify = (token: string): string | null => {
    if (!permitted() || token.length < 80 || token.length > 4096) return null;
    const pieces = token.split(".");
    if (pieces.length !== 2) return null;
    const [body, signature] = pieces;
    if (
      !body ||
      !signature ||
      !/^[A-Za-z0-9_-]+$/.test(body) ||
      !/^[A-Za-z0-9_-]+$/.test(signature)
    )
      return null;
    try {
      const candidate = Buffer.from(signature, "base64url");
      const expected = signing(body);
      if (
        candidate.length !== expected.length ||
        !timingSafeEqual(candidate, expected)
      )
        return null;
      const decoded = Buffer.from(body, "base64url").toString("utf8");
      const payload = JSON.parse(decoded) as Partial<Claims>;
      const now = Math.floor(clock() / 1000);
      if (
        payload.version !== VERSION ||
        payload.audience !== AUDIENCE ||
        typeof payload.sub !== "string" ||
        !/^[A-Za-z0-9_-]{3,128}$/.test(payload.sub) ||
        typeof payload.issuedAt !== "number" ||
        typeof payload.expiresAt !== "number" ||
        !Number.isSafeInteger(payload.issuedAt) ||
        !Number.isSafeInteger(payload.expiresAt) ||
        payload.issuedAt > now ||
        payload.expiresAt <= now ||
        payload.expiresAt - payload.issuedAt > 300 ||
        typeof payload.nonce !== "string" ||
        !/^[A-Za-z0-9_-]{20,64}$/.test(payload.nonce)
      )
        return null;
      return payload.sub;
    } catch {
      return null;
    }
  };

  const authenticate = (request: FastifyRequest) => {
    if (!permitted()) {
      throw new AppError(401, "UNAUTHORIZED", "Staging session unavailable");
    }
    const header = request.headers.authorization;
    const match =
      typeof header === "string"
        ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header)
        : null;
    const principal = match ? verify(match[1] ?? "") : null;
    if (!principal)
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Staging authentication required",
      );
    request.userId = principal;
    return Promise.resolve();
  };

  return { issueForTest, verify, authenticate };
}
