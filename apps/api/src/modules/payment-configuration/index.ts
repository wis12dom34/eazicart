import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../config.js";

export function registerPaymentConfiguration(
  app: FastifyInstance,
  config: AppConfig,
) {
  app.get("/payments/configuration", () =>
    Promise.resolve({
      data: { available: Boolean(config.PAYSTACK_SECRET_KEY) },
    }),
  );
}
