import type { PrismaClient } from "@eazicart/database";
import type { FastifyRequest } from "fastify";
import { AppError } from "../errors.js";

export const protectedRoute = (app: {
  authenticate(request: FastifyRequest): Promise<void>;
}) => ({
  preHandler: (request: FastifyRequest) => app.authenticate(request),
});

export function userId(request: FastifyRequest) {
  if (!request.userId)
    throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  return request.userId;
}

export function requireDatabase(database?: PrismaClient): PrismaClient {
  if (!database)
    throw new AppError(503, "DATABASE_UNAVAILABLE", "Database is unavailable");
  return database;
}

export const money = (value: { toString(): string }) => value.toString();
