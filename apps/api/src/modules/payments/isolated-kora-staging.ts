import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import type { KoraFetcher } from "./korapay-api-adapter-candidate.js";
import {
  createKoraPreviewCheckoutStore,
  registerKoraPreviewCheckoutApi,
} from "./korapay-checkout-api-candidate.js";
import { registerKoraPreviewWebhook } from "./korapay-preview-route-candidate.js";
import { registerIdempotentOrderPreview } from "../orders/idempotent-preview.js";
import { createKoraCheckoutOnce } from "./korapay-checkout-once-candidate.js";
import { registerKoraReconciliationPreview } from "./korapay-reconciliation-preview.js";
import { stagingIdentity } from "./isolated-staging-identity.js";

/**
 * NEVER import in production startup.
 * This module is an opt-in bridge for disposable PostgreSQL integration tests,
 * where the fake Kora provider is always injected by the test harness.
 */
export async function registerIsolatedKoraStaging(
  app: FastifyInstance,
  db: PrismaClient,
  options: {
    fetcher: KoraFetcher;
    webhookSecret: string;
    redirectUrl: string;
    notificationUrl: string;
  },
) {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.EAZICART_IDEM_DISPOSABLE !== "1" ||
    process.env.EAZICART_KORA_FIXTURE_ONLY !== "1" ||
    !process.env.PGPORT ||
    Number(process.env.PGPORT) === 5432
  )
    throw new Error(
      "Kora preview integration requires an isolated test environment",
    );

  // Independently verify the actual connection is to the ephemeral cluster,
  // not just what environment variables claim.
  const row = await db.$queryRawUnsafe<Array<{ data_directory: string }>>(
    "SELECT current_setting('data_directory') AS data_directory",
  );
  if (!row[0]?.data_directory?.startsWith("/tmp/pg_virtualenv.")) {
    throw new Error(
      "Refusing to register Kora staging against a persistent database",
    );
  }
  if (!options.webhookSecret || !options.fetcher)
    throw new Error("Synthetic provider and webhook fixture required");

  // Test-only staging marker: a build runner can reject a wrong/prod API.
  // This is registered ONLY after checking the disposable PostgreSQL cluster.
  app.get("/preview/staging/identity", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    reply.header("X-EaziCart-QA-Environment", "disposable-fixture");
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send({ data: stagingIdentity });
  });

  // No production payment or order endpoint is changed. All namespaced.
  registerIdempotentOrderPreview(app, db);
  const store = createKoraPreviewCheckoutStore(db);
  const once = createKoraCheckoutOnce(db, store, {
    secret: options.webhookSecret,
    fetcher: options.fetcher,
    redirectUrl: options.redirectUrl,
    notificationUrl: options.notificationUrl,
  });
  registerKoraPreviewCheckoutApi(app, {
    store,
    initializeOnce: once.start,
    secret: options.webhookSecret,
    fetcher: options.fetcher,
    redirectUrl: options.redirectUrl,
    notificationUrl: options.notificationUrl,
  });
  registerKoraPreviewWebhook(app, {
    store,
    secret: options.webhookSecret,
    fetcher: options.fetcher,
  });
  // No production import. Only admin-gated GET routes, never settlement.
  await registerKoraReconciliationPreview(app, db, {
    secret: options.webhookSecret,
    fetcher: options.fetcher,
  });
}
