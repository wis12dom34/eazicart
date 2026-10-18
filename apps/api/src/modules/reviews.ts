import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../errors.js";
import { protectedRoute, requireDatabase, userId } from "./shared.js";

const id = z.string().min(1).max(100);
const input = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(2000),
});
const pageQuery = z.object({
  cursor: id.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const productSelect = {
  id: true,
  name: true,
  active: true,
  images: {
    orderBy: { position: "asc" as const },
    take: 1,
    select: { url: true },
  },
} as const;
const select = {
  id: true,
  rating: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  orderItemId: true,
  user: { select: { id: true, name: true } },
  product: { select: productSelect },
} as const satisfies Prisma.ProductReviewSelect;
type ReviewRow = Prisma.ProductReviewGetPayload<{ select: typeof select }>;
const dto = (row: ReviewRow, own = false) => ({
  id: row.id,
  rating: row.rating,
  body: row.body,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  user: { id: row.user.id, name: row.user.name },
  product: {
    id: row.product.id,
    name: row.product.name,
    active: row.product.active,
    imageUrl: row.product.images[0]?.url ?? null,
  },
  ...(own ? { orderItemId: row.orderItemId } : {}),
});

export function registerReviews(app: FastifyInstance, client?: PrismaClient) {
  const db = () => requireDatabase(client),
    auth = protectedRoute(app);
  const eligible = (uid: string): Prisma.OrderItemWhereInput => ({
    review: null,
    product: { seller: { userId: { not: uid } } },
    order: {
      userId: uid,
      status: "FULFILLED",
      payment: { status: "SUCCESS", paidAt: { not: null } },
    },
  });
  const list = async (
    where: Prisma.ProductReviewWhereInput,
    query: z.infer<typeof pageQuery>,
    own = false,
  ) => {
    const cursor = query.cursor
      ? await db().productReview.findFirst({
          where: { AND: [where, { id: query.cursor }] },
          select: { id: true, createdAt: true },
        })
      : null;
    if (query.cursor && !cursor)
      throw new AppError(400, "INVALID_CURSOR", "Invalid reviews cursor");
    const rows = await db().productReview.findMany({
      where: {
        AND: [
          where,
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit,
      data = rows.slice(0, query.limit);
    return {
      data: data.map((row) => dto(row, own)),
      pagination: {
        hasMore,
        nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
      },
    };
  };
  const summary = async (where: Prisma.ProductReviewWhereInput) => {
    const result = await db().productReview.aggregate({
      where,
      _count: { _all: true },
      _avg: { rating: true },
    });
    return { count: result._count._all, average: result._avg.rating };
  };
  app.get("/products/:id/reviews", async (request, reply) => {
    const params = z.object({ id }).parse(request.params);
    if (
      !(await db().product.findFirst({
        where: { id: params.id, active: true },
        select: { id: true },
      }))
    )
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    const where = { productId: params.id };
    const [page, totals] = await Promise.all([
      list(where, pageQuery.parse(request.query)),
      summary(where),
    ]);
    reply.header("Cache-Control", "no-store");
    return { ...page, summary: totals };
  });
  app.get("/sellers/:id/reviews", async (request, reply) => {
    const params = z.object({ id }).parse(request.params);
    if (
      !(await db().sellerProfile.findUnique({
        where: { id: params.id },
        select: { id: true },
      }))
    )
      throw new AppError(404, "SELLER_NOT_FOUND", "Seller not found");
    // Retain seller feedback even when the seller removes the original listing.
    const where = { product: { sellerId: params.id } };
    const [page, totals] = await Promise.all([
      list(where, pageQuery.parse(request.query)),
      summary(where),
    ]);
    reply.header("Cache-Control", "no-store");
    return { ...page, summary: totals };
  });
  app.get("/reviews/mine", auth, async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    return list(
      { userId: userId(request) },
      pageQuery.parse(request.query),
      true,
    );
  });
  app.get("/reviews/eligible", auth, async (request, reply) => {
    const query = pageQuery.parse(request.query),
      uid = userId(request);
    // OrderItem has no createdAt; its unique ID supplies deterministic keyset pagination.
    const rows = await db().orderItem.findMany({
      where: {
        AND: [
          eligible(uid),
          ...(query.cursor ? [{ id: { lt: query.cursor } }] : []),
        ],
      },
      select: {
        id: true,
        orderId: true,
        productName: true,
        product: { select: productSelect },
      },
      orderBy: { id: "desc" },
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit,
      data = rows.slice(0, query.limit);
    reply.header("Cache-Control", "private, no-store");
    return {
      data: data.map((row) => ({
        orderItemId: row.id,
        orderId: row.orderId,
        product: {
          id: row.product.id,
          name: row.productName,
          active: row.product.active,
          imageUrl: row.product.images[0]?.url ?? null,
        },
      })),
      pagination: {
        hasMore,
        nextCursor: hasMore ? (data.at(-1)?.id ?? null) : null,
      },
    };
  });
  app.post("/reviews", auth, async (request, reply) => {
    const body = input.extend({ orderItemId: id }).parse(request.body),
      uid = userId(request);
    let row: ReviewRow;
    try {
      row = await db().$transaction(async (tx) => {
        const item = await tx.orderItem.findFirst({
          where: { id: body.orderItemId, order: { userId: uid } },
          include: {
            product: {
              select: { id: true, seller: { select: { userId: true } } },
            },
            order: {
              select: {
                status: true,
                payment: { select: { status: true, paidAt: true } },
              },
            },
          },
        });
        if (!item)
          throw new AppError(
            404,
            "ORDER_ITEM_NOT_FOUND",
            "Order item not found",
          );
        if (item.product.seller.userId === uid)
          throw new AppError(
            403,
            "SELF_REVIEW",
            "You cannot review your own products",
          );
        if (
          item.order.status !== "FULFILLED" ||
          item.order.payment?.status !== "SUCCESS" ||
          !item.order.payment.paidAt
        )
          throw new AppError(
            409,
            "REVIEW_NOT_ELIGIBLE",
            "Reviews become available after confirmed payment and order fulfillment",
          );
        // A unique order item makes retries and concurrent submissions one review.
        const review = await tx.productReview.upsert({
          where: { orderItemId: item.id },
          create: {
            userId: uid,
            productId: item.product.id,
            orderItemId: item.id,
            rating: body.rating,
            body: body.body,
          },
          update: {},
          select,
        });
        if (
          review.user.id !== uid ||
          review.rating !== body.rating ||
          review.body !== body.body
        )
          throw new AppError(
            409,
            "ALREADY_REVIEWED",
            "This purchase already has a review. Edit it from My Reviews.",
          );
        return review;
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      const previous = await db().productReview.findFirst({
        where: { orderItemId: body.orderItemId, userId: uid },
        select,
      });
      if (
        !previous ||
        previous.rating !== body.rating ||
        previous.body !== body.body
      )
        throw new AppError(
          409,
          "ALREADY_REVIEWED",
          "This purchase already has a review. Edit it from My Reviews.",
        );
      row = previous;
    }
    reply.header("Cache-Control", "private, no-store");
    return reply.code(201).send({ data: dto(row, true) });
  });
  app.patch("/reviews/:id", auth, async (request, reply) => {
    const params = z.object({ id }).parse(request.params),
      body = input.parse(request.body),
      uid = userId(request);
    // Scope the write itself to the author; another user's ID is never sufficient.
    const result = await db().productReview.updateMany({
      where: { id: params.id, userId: uid },
      data: body,
    });
    if (!result.count)
      throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");
    const row = await db().productReview.findFirst({
      where: { id: params.id, userId: uid },
      select,
    });
    if (!row) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");
    reply.header("Cache-Control", "private, no-store");
    return { data: dto(row, true) };
  });
  app.delete("/reviews/:id", auth, async (request, reply) => {
    const params = z.object({ id }).parse(request.params);
    const result = await db().productReview.deleteMany({
      where: { id: params.id, userId: userId(request) },
    });
    if (!result.count)
      throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found");
    return reply.header("Cache-Control", "private, no-store").code(204).send();
  });
}