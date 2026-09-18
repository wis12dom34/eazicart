import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppConfig } from "../../config.js";
import { AppError } from "../../errors.js";
import { protectedRoute, requireDatabase, userId } from "../shared.js";

const initializeBody = z.object({ orderId: z.string().min(1) });
const referenceParams = z.object({ reference: z.string().min(1) });
const webhookEvent = z
  .object({
    event: z.string(),
    data: z.object({ reference: z.string() }).passthrough(),
  })
  .passthrough();

type PaystackInitialize = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerify = {
  status: boolean;
  message: string;
  data?: {
    id: number | string;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string | null;
  };
};

type RequestWithRawBody = { rawBody?: Buffer };

class InventoryConflict extends Error {}

const paymentOutput = (payment: {
  id: string;
  orderId: string;
  reference: string;
  status: string;
  amount: { toString(): string };
  currency: string;
  authorizationUrl: string | null;
  paidAt: Date | null;
  failureReason: string | null;
}) => ({
  id: payment.id,
  orderId: payment.orderId,
  reference: payment.reference,
  status: payment.status,
  amount: payment.amount.toString(),
  currency: payment.currency,
  authorizationUrl: payment.authorizationUrl,
  paidAt: payment.paidAt,
  failureReason: payment.failureReason,
});

const requireSecret = (config: AppConfig) => {
  if (!config.PAYSTACK_SECRET_KEY)
    throw new AppError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Payments are not configured",
    );
  return config.PAYSTACK_SECRET_KEY;
};

const paystackRequest = async <T>(
  config: AppConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const secret = requireSecret(config);
  let response: Response;
  try {
    response = await fetch(`${config.PAYSTACK_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_UNAVAILABLE",
      "Payment provider is unavailable",
    );
  }

  let body: T;
  try {
    body = (await response.json()) as T;
  } catch {
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_INVALID_RESPONSE",
      "Payment provider returned an invalid response",
    );
  }

  if (!response.ok)
    throw new AppError(
      502,
      "PAYMENT_PROVIDER_ERROR",
      "Payment provider rejected the request",
    );
  return body;
};

const initializePaystack = async (
  config: AppConfig,
  input: {
    email: string;
    amount: Prisma.Decimal;
    reference: string;
    orderId: string;
  },
) => {
  const response = await paystackRequest<PaystackInitialize>(
    config,
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amount.mul(100).toFixed(0),
        currency: "NGN",
        reference: input.reference,
        callback_url: `${config.WEB_ORIGIN}/payment-pending`,
        metadata: { orderId: input.orderId },
      }),
    },
  );
  if (!response.status || !response.data)
    throw new AppError(
      502,
      "PAYMENT_INITIALIZATION_FAILED",
      response.message || "Could not initialize payment",
    );
  if (response.data.reference !== input.reference)
    throw new AppError(
      502,
      "PAYMENT_REFERENCE_MISMATCH",
      "Payment provider returned an unexpected reference",
    );
  return response.data;
};

const verifyPaystack = async (config: AppConfig, reference: string) => {
  const response = await paystackRequest<PaystackVerify>(
    config,
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  if (!response.status || !response.data)
    throw new AppError(
      502,
      "PAYMENT_VERIFICATION_FAILED",
      response.message || "Could not verify payment",
    );
  if (response.data.reference !== reference)
    throw new AppError(
      502,
      "PAYMENT_REFERENCE_MISMATCH",
      "Payment provider returned an unexpected reference",
    );
  return response.data;
};

const markNonSuccess = async (
  db: PrismaClient,
  reference: string,
  providerStatus: string,
) => {
  const payment = await db.payment.findUnique({ where: { reference } });
  if (!payment || payment.status === "SUCCESS") return payment;
  const terminal = ["failed", "abandoned", "reversed"].includes(
    providerStatus,
  );
  if (!terminal) return payment;
  return db.payment.update({
    where: { reference },
    data: {
      status: "FAILED",
      failureReason: `Paystack status: ${providerStatus}`,
    },
  });
};

const finalizeVerifiedPayment = async (
  db: PrismaClient,
  verified: NonNullable<PaystackVerify["data"]>,
) => {
  const current = await db.payment.findUnique({
    where: { reference: verified.reference },
  });
  if (!current)
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  if (current.status === "SUCCESS" || current.status === "REVIEW_REQUIRED")
    return current;

  const expectedSubunits = current.amount.mul(100);
  if (!expectedSubunits.equals(new Prisma.Decimal(verified.amount)))
    throw new AppError(
      409,
      "PAYMENT_AMOUNT_MISMATCH",
      "Verified payment amount does not match the order",
    );
  if (verified.currency !== current.currency)
    throw new AppError(
      409,
      "PAYMENT_CURRENCY_MISMATCH",
      "Verified payment currency does not match the order",
    );

  try {
    return await db.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { reference: verified.reference },
          include: {
            order: {
              include: {
                items: {
                  include: { product: { select: { sellerId: true } } },
                },
              },
            },
          },
        });
        if (!payment)
          throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
        if (
          payment.status === "SUCCESS" ||
          payment.status === "REVIEW_REQUIRED"
        )
          return payment;

        for (const item of payment.order.items) {
          const changed = await tx.product.updateMany({
            where: {
              id: item.productId,
              active: true,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (changed.count !== 1) throw new InventoryConflict();
        }

        const sellerIds = Array.from(
          new Set(payment.order.items.map((item) => item.product.sellerId)),
        );
        await tx.sellerFulfillment.createMany({
          data: sellerIds.map((sellerId) => ({
            orderId: payment.orderId,
            sellerId,
          })),
          skipDuplicates: true,
        });

        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCESS",
            paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
            providerTransactionId: String(verified.id),
            failureReason: null,
          },
        });
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: "CONFIRMED" },
        });
        await tx.notification.create({
          data: {
            userId: payment.order.userId,
            type: "ORDER",
            title: "Payment confirmed",
            body: "Your payment was confirmed and your order is ready for seller processing.",
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (!(error instanceof InventoryConflict)) throw error;
    const reviewed = await db.payment.update({
      where: { reference: verified.reference },
      data: {
        status: "REVIEW_REQUIRED",
        paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
        providerTransactionId: String(verified.id),
        failureReason: "Inventory became unavailable after payment confirmation",
      },
      include: { order: true },
    });
    await db.notification.create({
      data: {
        userId: reviewed.order.userId,
        type: "SYSTEM",
        title: "Payment needs review",
        body: "Your payment was received, but an item became unavailable. Support review is required before fulfillment.",
      },
    });
    return reviewed;
  }
};

const verifyAndSync = async (
  db: PrismaClient,
  config: AppConfig,
  reference: string,
) => {
  const verified = await verifyPaystack(config, reference);
  if (verified.status === "success")
    return finalizeVerifiedPayment(db, verified);
  const payment = await markNonSuccess(db, reference, verified.status);
  if (!payment)
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  return payment;
};

const signatureMatches = (
  secret: string,
  rawBody: Buffer | undefined,
  signature: string | undefined,
) => {
  if (!signature || !rawBody) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(signature, "utf8");
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
};

export function registerPayments(
  app: FastifyInstance,
  config: AppConfig,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client);
  const auth = protectedRoute(app);

  app.post("/payments/initialize", auth, async (r, reply) => {
    const { orderId } = initializeBody.parse(r.body);
    const order = await db().order.findFirst({
      where: { id: orderId, userId: userId(r) },
      include: { user: { select: { email: true } }, payment: true },
    });
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    if (order.payment?.status === "SUCCESS")
      return { data: paymentOutput(order.payment) };
    if (
      order.payment?.status === "PENDING" &&
      order.payment.authorizationUrl
    )
      return { data: paymentOutput(order.payment) };

    const reference = `EC-${randomUUID()}`;
    const payment = order.payment
      ? await db().payment.update({
          where: { id: order.payment.id },
          data: {
            reference,
            status: "PENDING",
            amount: order.total,
            currency: "NGN",
            authorizationUrl: null,
            accessCode: null,
            providerTransactionId: null,
            failureReason: null,
            paidAt: null,
          },
        })
      : await db().payment.create({
          data: {
            orderId: order.id,
            reference,
            amount: order.total,
            currency: "NGN",
          },
        });

    const initialized = await initializePaystack(config, {
      email: order.user.email,
      amount: order.total,
      reference: payment.reference,
      orderId: order.id,
    });
    const updated = await db().payment.update({
      where: { id: payment.id },
      data: {
        authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code,
      },
    });
    return reply.code(201).send({ data: paymentOutput(updated) });
  });

  app.get("/payments/:reference/verify", auth, async (r) => {
    const { reference } = referenceParams.parse(r.params);
    const payment = await db().payment.findFirst({
      where: { reference, order: { userId: userId(r) } },
    });
    if (!payment)
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    const updated = await verifyAndSync(db(), config, reference);
    return { data: paymentOutput(updated) };
  });

  app.post(
    "/payments/paystack/webhook",
    {
      preParsing: async (request, _reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload)
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const rawBody = Buffer.concat(chunks);
        (request as typeof request & RequestWithRawBody).rawBody = rawBody;
        return Readable.from(rawBody);
      },
    },
    async (r, reply) => {
      const secret = requireSecret(config);
      const signature = r.headers["x-paystack-signature"];
      const rawBody = (r as typeof r & RequestWithRawBody).rawBody;
      if (
        !signatureMatches(
          secret,
          rawBody,
          typeof signature === "string" ? signature : undefined,
        )
      )
        throw new AppError(
          401,
          "INVALID_PAYMENT_SIGNATURE",
          "Invalid payment signature",
        );

      const event = webhookEvent.parse(r.body);
      if (event.event === "charge.success") {
        const known = await db().payment.findUnique({
          where: { reference: event.data.reference },
        });
        if (known) await verifyAndSync(db(), config, event.data.reference);
      }
      return reply.code(200).send({ received: true });
    },
  );
}
