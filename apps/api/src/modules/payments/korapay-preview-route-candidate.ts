import type { FastifyInstance } from "fastify";
import {
  handleKoraWebhookCandidate,
  type KoraWebhookStore,
} from "./korapay-webhook-candidate.js";
import type { KoraFetcher } from "./korapay-api-adapter-candidate.js";

// Unregistered candidate. Inject isolated preview dependencies; never register in production.
export function registerKoraPreviewWebhook(
  app: FastifyInstance,
  deps: { secret: string; store: KoraWebhookStore; fetcher: KoraFetcher },
) {
  if (!deps.secret) throw new Error("Preview webhook secret required");
  app.post(
    "/preview/korapay/webhook",
    { bodyLimit: 32768 },
    async (request, reply) => {
      const signature = request.headers["x-korapay-signature"];
      if (typeof signature !== "string") return reply.code(401).send();
      try {
        const outcome = await handleKoraWebhookCandidate(
          request.body,
          signature,
          deps.secret,
          deps.store,
          deps.fetcher,
        );
        if (outcome === "REJECTED") return reply.code(401).send();
        // Retry when provider verification or settlement could not complete.
        if (outcome === "PENDING" || outcome === "UNAVAILABLE")
          return reply.code(503).send();
        return reply.code(200).send();
      } catch {
        return reply.code(503).send();
      }
    },
  );
}
