import type { PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { protectedRoute, userId } from "../shared.js";
import {
  decodeReconciliationCursor,
  encodeReconciliationCursor,
  reconcileCsv,
} from "./korapay-reconciliation-csv.js";
import {
  verifyKoraChargeCandidate,
  type KoraFetcher,
} from "./korapay-api-adapter-candidate.js";

/**
 * READ-ONLY, UNREGISTERED, disposable-only admin reconciliation endpoints.
 *
 * These routes do not call confirmKoraCheckoutCandidate, settleOnce,
 * KoraPay's initialization API, Prisma mutations, or any wallet/order write.
 * The provider verifier uses ONLY an injected synthetic GET fetcher.
 * Provider success is evidence for manual review, never payment settlement.
 */
const listQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    state: z.enum(["INITIATING", "UNKNOWN"]).optional(),
  })
  .strict();
const exportQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(250).default(100),
    state: z.enum(["INITIATING", "UNKNOWN"]).optional(),
    cursor: z.string().min(2).max(512).optional(),
  })
  .strict();
const paymentParams = z
  .object({ paymentId: z.string().min(1).max(128) })
  .strict();

export async function registerKoraReconciliationPreview(
  app: FastifyInstance,
  db: PrismaClient,
  deps: { secret: string; fetcher: KoraFetcher },
) {
  if (
    process.env.NODE_ENV !== "test" ||
    process.env.EAZICART_IDEM_DISPOSABLE !== "1" ||
    process.env.EAZICART_KORA_FIXTURE_ONLY !== "1" ||
    !deps.secret ||
    !deps.fetcher ||
    !process.env.PGPORT ||
    Number(process.env.PGPORT) === 5432
  )
    throw new Error("Isolated reconciliation test configuration required");

  const cluster = await db.$queryRawUnsafe<Array<{ data_directory: string }>>(
    "SELECT current_setting('data_directory') AS data_directory",
  );
  if (!cluster[0]?.data_directory?.startsWith("/tmp/pg_virtualenv.")) {
    throw new Error(
      "Reconciliation requires a verified disposable PostgreSQL cluster",
    );
  }

  // Prevent future refactors from accidentally using POST or a non-KoraPay
  // endpoint in this strictly read-only reconciliation operation.
  const safeReadOnlyFetcher: KoraFetcher = (endpoint, options) => {
    const url = new URL(endpoint);
    if (
      options.method !== "GET" ||
      options.body !== undefined ||
      url.origin !== "https://api.korapay.com" ||
      !/^\/merchant\/api\/v1\/charges\/EC-[A-Za-z0-9-]{8,80}$/.test(
        url.pathname,
      ) ||
      url.search !== "" ||
      url.hash !== ""
    )
      throw new Error(
        "Reconciliation allows only trusted provider reference GET",
      );
    return deps.fetcher(endpoint, options);
  };

  const auth = protectedRoute(app);

  async function adminOnly(request: { userId?: string }) {
    const id = request.userId;
    if (!id) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    const user = await db.user.findUnique({
      where: { id },
      select: { role: true },
    });
    if (!user || user.role !== "ADMIN") {
      throw new AppError(403, "ADMIN_ONLY", "Administrator access required");
    }
  }

  app.get("/preview/admin/korapay/reconciliation", auth, async (request) => {
    await adminOnly({ userId: userId(request) });
    const { state, limit } = listQuery.parse(request.query);
    const claims = await db.koraCheckoutAttempt.findMany({
      where: {
        state: { in: state ? [state] : ["INITIATING", "UNKNOWN"] },
        payment: { provider: "KORAPAY" },
      },
      orderBy: [{ createdAt: "asc" }, { paymentId: "asc" }],
      take: limit,
      select: {
        paymentId: true,
        reference: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        payment: {
          select: {
            orderId: true,
            provider: true,
            reference: true,
            status: true,
            currency: true,
          },
        },
      },
    });
    // Minimal identifiers only: no customer details, bank accounts, credentials,
    // checkout URLs, or unmasked provider response bodies.
    return {
      data: claims.map((claim) => ({
        paymentId: claim.paymentId,
        orderId: claim.payment.orderId,
        reference: claim.reference,
        state: claim.state,
        paymentStatus: claim.payment.status,
        currency: claim.payment.currency,
        referenceMatches: claim.reference === claim.payment.reference,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
        action: "MANUAL_REVIEW_REQUIRED" as const,
      })),
    };
  });

  // Aggregated read-only dashboard summary; never exposes buyer PII.
  app.get(
    "/preview/admin/korapay/reconciliation/report",
    auth,
    async (request, reply) => {
      await adminOnly({ userId: userId(request) });
      reply.header("Cache-Control", "private, no-store");
      const rows = await db.koraCheckoutAttempt.groupBy({
        by: ["state"],
        where: {
          state: { in: ["INITIATING", "UNKNOWN"] },
          payment: { provider: "KORAPAY" },
        },
        _count: { _all: true },
      });
      const counts = { INITIATING: 0, UNKNOWN: 0 };
      for (const row of rows) {
        if (row.state === "INITIATING" || row.state === "UNKNOWN")
          counts[row.state] = row._count._all;
      }
      return {
        data: {
          generatedAt: new Date().toISOString(),
          uncertainTotal: counts.INITIATING + counts.UNKNOWN,
          counts,
          action: "MANUAL_REVIEW_REQUIRED" as const,
          automaticReinitializationAllowed: false,
          automaticSettlementAllowed: false,
        },
      };
    },
  );

  // Bounded, cursor-paginated CSV of *local* uncertain claims. No provider
  // requests and no writes. Each page is at most 250 records.
  app.get(
    "/preview/admin/korapay/reconciliation/export.csv",
    auth,
    async (request, reply) => {
      await adminOnly({ userId: userId(request) });
      const { state, limit, cursor } = exportQuery.parse(request.query);
      const where = {
        state: { in: state ? [state] : ["INITIATING", "UNKNOWN"] },
        payment: { provider: "KORAPAY" },
      };
      const cursorId = cursor ? decodeReconciliationCursor(cursor) : null;
      if (cursor && !cursorId) {
        throw new AppError(
          400,
          "INVALID_CURSOR",
          "Invalid audit export cursor",
        );
      }
      if (cursorId) {
        const matching = await db.koraCheckoutAttempt.findFirst({
          where: { ...where, paymentId: cursorId },
          select: { paymentId: true },
        });
        if (!matching)
          throw new AppError(
            400,
            "INVALID_CURSOR",
            "Cursor does not match this report",
          );
      }
      const records = await db.koraCheckoutAttempt.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { paymentId: "asc" }],
        ...(cursorId ? { cursor: { paymentId: cursorId }, skip: 1 } : {}),
        take: limit + 1,
        select: {
          paymentId: true,
          reference: true,
          state: true,
          createdAt: true,
          updatedAt: true,
          payment: {
            select: {
              orderId: true,
              reference: true,
              status: true,
              currency: true,
            },
          },
        },
      });
      const hasMore = records.length > limit;
      const page = records.slice(0, limit);
      const csv = reconcileCsv(
        page.map((row) => ({
          paymentId: row.paymentId,
          orderId: row.payment.orderId,
          reference: row.reference,
          initiationState: row.state,
          paymentStatus: row.payment.status,
          currency: row.payment.currency,
          referenceMatches: row.reference === row.payment.reference,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          action: "MANUAL_REVIEW_REQUIRED",
        })),
      );
      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="eazicart-korapay-reconciliation.csv"',
        )
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header("Referrer-Policy", "no-referrer")
        .header("X-Export-Has-More", String(hasMore));
      if (hasMore && page.length) {
        reply.header(
          "X-Export-Next-Cursor",
          encodeReconciliationCursor(page[page.length - 1]!.paymentId),
        );
      }
      return reply.send(csv);
    },
  );

  app.get(
    "/preview/admin/korapay/reconciliation/:paymentId/probe",
    auth,
    async (request) => {
      await adminOnly({ userId: userId(request) });
      const { paymentId } = paymentParams.parse(request.params);
      const claim = await db.koraCheckoutAttempt.findUnique({
        where: { paymentId },
        include: { payment: true },
      });
      if (
        !claim ||
        !["INITIATING", "UNKNOWN"].includes(claim.state) ||
        claim.payment.provider !== "KORAPAY"
      )
        throw new AppError(
          404,
          "CLAIM_NOT_FOUND",
          "Uncertain checkout not found",
        );

      const payment = claim.payment;
      if (
        claim.reference !== payment.reference ||
        payment.currency !== "NGN" ||
        payment.amount.lte(0)
      )
        throw new AppError(
          409,
          "PAYMENT_IDENTITY_MISMATCH",
          "Local payment identity needs manual review",
        );
      if (payment.status !== "PENDING") {
        throw new AppError(
          409,
          "PAYMENT_NOT_PENDING",
          "Payment status needs manual review",
        );
      }

      const provider = await verifyKoraChargeCandidate(
        {
          reference: payment.reference,
          currency: payment.currency,
          amountMinorUnits: payment.amount.mul(100).toFixed(0),
        },
        deps.secret,
        safeReadOnlyFetcher,
      );
      // This is deliberately only a provider observation, NOT a local status
      // transition. Even a VERIFIED response cannot settle the order.
      return {
        data: {
          paymentId: claim.paymentId,
          orderId: payment.orderId,
          reference: payment.reference,
          localStatus: payment.status,
          initiationState: claim.state,
          providerCheck: provider.status,
          providerReason: provider.reason,
          action: "MANUAL_REVIEW_REQUIRED" as const,
          mayInitializeAgain: false,
          localPaymentUpdated: false,
        },
      };
    },
  );
}
