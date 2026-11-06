import { Prisma, type PrismaClient } from "@eazicart/database";
import { AppError } from "../../errors.js";
import {
  beginKoraCheckoutCandidate,
  type OwnedKoraPayment,
  type KoraStore,
} from "./korapay-checkout-flow-candidate.js";
import type { KoraFetcher } from "./korapay-api-adapter-candidate.js";

/**
 * Unregistered, disposable-staging KoraPay provider initialization guard.
 *
 * Claim is committed BEFORE the outbound provider request. Even if process
 * crashes after that outbound call, another process cannot blindly reinitialize
 * the same order/reference. UNKNOWN and orphaned INITIATING require manual
 * provider reconciliation. We intentionally do not expire the claim.
 */
export function createKoraCheckoutOnce(
  db: PrismaClient,
  store: KoraStore,
  options: {
    secret: string;
    fetcher: KoraFetcher;
    redirectUrl: string;
    notificationUrl: string;
  },
) {
  const unavailable = () =>
    new AppError(
      503,
      "KORAPAY_INITIATION_UNCERTAIN",
      "Checkout initiation needs reconciliation. Do not retry with a different order or payment reference.",
    );

  const trustedUrl = (value: unknown): string | null => {
    if (typeof value !== "string" || value.length > 4096) return null;
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        (url.hostname !== "checkout.korapay.com" &&
          !url.hostname.endsWith(".checkout.korapay.com")) ||
        url.port !== "" ||
        url.username !== "" ||
        url.password !== "" ||
        url.hash !== ""
      )
        return null;
      return url.toString();
    } catch {
      return null;
    }
  };

  async function start(
    owned: OwnedKoraPayment,
    buyerId: string,
  ): Promise<{ checkoutUrl: string; replayed: boolean }> {
    if (
      owned.buyerId !== buyerId ||
      owned.provider !== "KORAPAY" ||
      owned.currency !== "NGN" ||
      owned.status !== "PENDING"
    )
      throw new AppError(409, "PAYMENT_NOT_PENDING", "Order is not payable");

    const payment = await db.payment.findFirst({
      where: {
        orderId: owned.orderId,
        provider: "KORAPAY",
        reference: owned.reference,
        status: "PENDING",
        order: { userId: buyerId },
      },
      select: { id: true, reference: true },
    });
    if (!payment)
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");

    let claimed = false;
    try {
      await db.koraCheckoutAttempt.create({
        data: {
          paymentId: payment.id,
          reference: payment.reference,
          state: "INITIATING",
        },
      });
      claimed = true;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
    }

    if (!claimed) {
      const existing = await db.koraCheckoutAttempt.findUnique({
        where: { paymentId: payment.id },
      });
      if (!existing || existing.reference !== payment.reference)
        throw unavailable();
      const reused =
        existing.state === "READY"
          ? trustedUrl(existing.authorizationUrl)
          : null;
      if (!reused) throw unavailable();
      return { checkoutUrl: reused, replayed: true };
    }

    // At this point, this process is the single owner of a durable claim.
    // All ambiguous outbound/provider/storage failures remain fail-closed.
    try {
      const result = await beginKoraCheckoutCandidate(
        owned.orderId,
        buyerId,
        store,
        options.secret,
        options.redirectUrl,
        options.fetcher,
        options.notificationUrl,
      );
      const url =
        result.status === "CHECKOUT_READY"
          ? trustedUrl(result.checkoutUrl)
          : null;
      if (!url) throw unavailable();

      const saved = await db.koraCheckoutAttempt.updateMany({
        where: {
          paymentId: payment.id,
          reference: payment.reference,
          state: "INITIATING",
        },
        data: { state: "READY", authorizationUrl: url },
      });
      if (saved.count !== 1) throw unavailable();
      return { checkoutUrl: url, replayed: false };
    } catch {
      // If this update fails as well, the original INITIATING claim remains.
      // Neither case should auto-trigger a second provider initialization.
      await db.koraCheckoutAttempt
        .updateMany({
          where: { paymentId: payment.id, state: "INITIATING" },
          data: { state: "UNKNOWN" },
        })
        .catch(() => undefined);
      throw unavailable();
    }
  }

  return { start };
}
