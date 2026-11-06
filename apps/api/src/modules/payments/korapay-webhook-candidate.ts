import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  confirmKoraCheckoutCandidate,
  type KoraStore,
} from "./korapay-checkout-flow-candidate.js";
import type { KoraFetcher } from "./korapay-api-adapter-candidate.js";

// Unregistered webhook candidate. Verify signature before any provider lookup.
// NEVER settle from webhook payload alone: always requery Kora's charge API.
const eventShape = z.object({
  event: z.enum(["charge.success", "charge.failed"]),
  data: z
    .object({
      reference: z.string().min(1),
      status: z.enum(["success", "failed"]),
      currency: z.string(),
      amount: z.union([z.number(), z.string()]),
    })
    .passthrough(),
});
export type KoraWebhookOutcome =
  | "IGNORED"
  | "REJECTED"
  | "PENDING"
  | "CONFIRMED"
  | "REVIEW_REQUIRED"
  | "UNAVAILABLE";
export function parseSignedKoraWebhook(
  body: unknown,
  signature: string | undefined,
  secret: string,
): { reference: string; event: "charge.success" | "charge.failed" } | null {
  if (!secret || !signature || !/^[a-f\d]{64}$/i.test(signature)) return null;
  const parsed = eventShape.safeParse(body);
  if (!parsed.success) return null;
  // Hash the original parsed data object: schema parsing can reorder its keys.
  const originalData = (body as { data: unknown }).data;
  const digest = createHmac("sha256", secret)
    .update(JSON.stringify(originalData))
    .digest();
  const supplied = Buffer.from(signature, "hex");
  if (supplied.length !== digest.length || !timingSafeEqual(supplied, digest))
    return null;
  if (
    parsed.data.event === "charge.success" &&
    parsed.data.data.status !== "success"
  )
    return null;
  if (
    parsed.data.event === "charge.failed" &&
    parsed.data.data.status !== "failed"
  )
    return null;
  return { reference: parsed.data.data.reference, event: parsed.data.event };
}
// Resolve reference against an actual KoraPay payment in the database; never use
// client-supplied order or buyer IDs to authorize webhook processing.
export type KoraWebhookStore = KoraStore & {
  findByKoraReference(
    reference: string,
  ): Promise<{ orderId: string; buyerId: string } | null>;
};
export async function handleKoraWebhookCandidate(
  body: unknown,
  signature: string | undefined,
  secret: string,
  store: KoraWebhookStore,
  fetcher: KoraFetcher,
): Promise<KoraWebhookOutcome> {
  const event = parseSignedKoraWebhook(body, signature, secret);
  if (!event) return "REJECTED";
  if (event.event !== "charge.success") return "IGNORED";
  const owner = await store.findByKoraReference(event.reference);
  if (!owner) return "IGNORED";
  const payment = await store.findOwned(owner.orderId, owner.buyerId);
  if (
    !payment ||
    payment.reference !== event.reference ||
    payment.provider !== "KORAPAY"
  )
    return "IGNORED";
  const result = await confirmKoraCheckoutCandidate(
    owner.orderId,
    owner.buyerId,
    store,
    secret,
    fetcher,
  );
  return result.status === "CHECKOUT_READY" ? "UNAVAILABLE" : result.status;
}
