import Fastify from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "./config.js";
import { AppError } from "./errors.js";
import { registerAuth } from "./modules/auth/index.js";
import { MemoryAuthStore, type AuthStore } from "./modules/auth/store.js";
import { registerAddresses } from "./modules/addresses/index.js";
import { registerCart } from "./modules/cart/index.js";
import { registerCategories } from "./modules/categories/index.js";
import { registerFollows } from "./modules/follows/index.js";
import { registerNotifications } from "./modules/notifications/index.js";
import { registerOrders } from "./modules/orders/index.js";
import { registerProducts } from "./modules/products/index.js";
import { registerSavedProducts } from "./modules/saved-products/index.js";
import { registerSellerProfiles } from "./modules/seller-profiles/index.js";
import { registerUsers } from "./modules/users.js";
import type { PrismaClient } from "@eazicart/database";

export function buildApp(
  config: AppConfig,
  dependencies: { authStore?: AuthStore; database?: PrismaClient } = {},
) {
  const app = Fastify({
    logger: config.NODE_ENV !== "test",
    requestIdHeader: "x-request-id",
  });
  const store = dependencies.authStore ?? new MemoryAuthStore();
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues,
        },
        requestId: request.id,
      });
    if (error instanceof AppError)
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message },
        requestId: request.id,
      });
    request.log.error(error);
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      requestId: request.id,
    });
  });
  app.get("/health", () => ({ status: "ok", service: "eazicart-api" }));
  registerAuth(app, config, store);
  registerUsers(app, store, dependencies.database);
  registerSellerProfiles(app, dependencies.database);
  registerCategories(app, dependencies.database);
  registerProducts(app, dependencies.database);
  registerCart(app, dependencies.database);
  registerOrders(app, dependencies.database);
  registerAddresses(app, dependencies.database);
  registerSavedProducts(app, dependencies.database);
  registerFollows(app, dependencies.database);
  registerNotifications(app, dependencies.database);
  return app;
}
