import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors.js";
import {
  EmailAlreadyExistsError,
  type AuthStore,
  type StoredUser,
} from "./store.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

const REFRESH_COOKIE_NAME = "eazicart_refresh";
const credentials = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});
const registration = credentials.extend({
  name: z.string().trim().min(2).max(100),
});
const refreshBody = z.object({ refreshToken: z.string().min(1).optional() });
const publicUser = ({ id, email, name }: StoredUser) => ({ id, email, name });
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function refreshTokenFromCookie(request: FastifyRequest) {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== REFRESH_COOKIE_NAME) continue;
    const value = rawValue.join("=");
    if (!value) return undefined;
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function setRefreshCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  secure: boolean,
) {
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );
  reply.header(
    "Set-Cookie",
    [
      `${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      secure ? "Secure" : "",
      `Max-Age=${maxAge}`,
      `Expires=${expiresAt.toUTCString()}`,
    ]
      .filter(Boolean)
      .join("; "),
  );
}

function clearRefreshCookie(reply: FastifyReply, secure: boolean) {
  reply.header(
    "Set-Cookie",
    [
      `${REFRESH_COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      secure ? "Secure" : "",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]
      .filter(Boolean)
      .join("; "),
  );
}

export function registerAuth(
  app: FastifyInstance,
  config: AppConfig,
  store: AuthStore,
) {
  const secret = new TextEncoder().encode(config.JWT_SECRET);
  const secureCookie = config.NODE_ENV === "production";
  const issueTokens = async (userId: string) => {
    const accessToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(config.ACCESS_TOKEN_TTL)
      .sign(secret);
    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(
      Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    );
    await store.saveRefreshToken({
      hash: hashToken(refreshToken),
      userId,
      expiresAt,
    });
    return { accessToken, refreshToken, expiresAt };
  };

  const issueSession = async (reply: FastifyReply, userId: string) => {
    const tokens = await issueTokens(userId);
    setRefreshCookie(reply, tokens.refreshToken, tokens.expiresAt, secureCookie);
    return {
      accessToken: tokens.accessToken,
      // Kept temporarily for backwards compatibility while old web sessions migrate.
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString(),
    };
  };

  const requestRefreshToken = (request: FastifyRequest) => {
    const cookieToken = refreshTokenFromCookie(request);
    if (cookieToken) return cookieToken;
    const body = refreshBody.parse(request.body ?? {});
    return body.refreshToken;
  };

  app.decorate("authenticate", async (request: FastifyRequest) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token)
      throw new AppError(401, "UNAUTHORIZED", "A bearer token is required");
    try {
      const subject = (await jwtVerify(token, secret)).payload.sub;
      if (!subject) throw new Error("Access token has no subject");
      request.userId = subject;
    } catch {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "The access token is invalid or expired",
      );
    }
  });

  app.post("/auth/register", async (request, reply) => {
    const input = registration.parse(request.body);
    if (await store.findUserByEmail(input.email))
      throw new AppError(
        409,
        "EMAIL_IN_USE",
        "An account already exists for this email",
      );
    let user: StoredUser;
    try {
      user = await store.createUser({
        email: input.email,
        name: input.name,
        passwordHash: await argon2.hash(input.password),
      });
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError)
        throw new AppError(
          409,
          "EMAIL_IN_USE",
          "An account already exists for this email",
        );
      throw error;
    }
    return reply.code(201).send({
      user: publicUser(user),
      tokens: await issueSession(reply, user.id),
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const input = credentials.parse(request.body);
    const user = await store.findUserByEmail(input.email);
    if (!user || !(await argon2.verify(user.passwordHash, input.password)))
      throw new AppError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
      );
    return {
      user: publicUser(user),
      tokens: await issueSession(reply, user.id),
    };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const refreshToken = requestRefreshToken(request);
    if (!refreshToken)
      throw new AppError(
        401,
        "INVALID_REFRESH_TOKEN",
        "The refresh token is invalid or expired",
      );
    const userId = await store.consumeRefreshToken(hashToken(refreshToken));
    if (!userId)
      throw new AppError(
        401,
        "INVALID_REFRESH_TOKEN",
        "The refresh token is invalid or expired",
      );
    return { tokens: await issueSession(reply, userId) };
  });

  app.post("/auth/logout", async (request, reply) => {
    const refreshToken = requestRefreshToken(request);
    if (refreshToken) await store.consumeRefreshToken(hashToken(refreshToken));
    clearRefreshCookie(reply, secureCookie);
    return reply.code(204).send();
  });
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<void>;
  }
}
