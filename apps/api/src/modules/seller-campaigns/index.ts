import { Prisma, type PrismaClient } from "@eazicart/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../../errors.js";
import { money, protectedRoute, requireDatabase, userId } from "../shared.js";

const params = z.object({ id: z.string().min(1) });
const objective = z.enum([
  "PRODUCT_VIEWS",
  "STORE_VISITS",
  "ORDERS",
  "FOLLOWERS",
]);
const campaignBody = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2).max(160).optional(),
  objective,
  audienceCountry: z.string().trim().min(2).max(100).default("Nigeria"),
  audienceAgeMin: z.number().int().min(13).max(100).default(18),
  audienceAgeMax: z.number().int().min(13).max(100).default(44),
  audienceInterests: z.string().trim().max(500).nullable().optional(),
  dailyBudget: z.coerce.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  durationDays: z.number().int().min(1).max(90),
});

const campaignInclude = {
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      active: true,
      images: {
        orderBy: { position: "asc" as const },
        take: 1,
        select: { url: true, altText: true },
      },
    },
  },
};

function serializeCampaign<
  T extends {
    dailyBudget: {
      toString(): string;
      mul(value: number): { toString(): string };
    };
    durationDays: number;
    product: { price: { toString(): string } };
  },
>(campaign: T) {
  return {
    ...campaign,
    dailyBudget: money(campaign.dailyBudget),
    totalBudget: money(campaign.dailyBudget.mul(campaign.durationDays)),
    product: {
      ...campaign.product,
      price: money(campaign.product.price),
    },
    delivery: {
      enabled: false,
      reason: "Campaign delivery is not configured yet.",
    },
    metrics: {
      spend: null,
      revenue: null,
      impressions: null,
      productVisits: null,
      orders: null,
      conversionRate: null,
      roas: null,
    },
  };
}

async function sellerForRequest(db: PrismaClient, requestUserId: string) {
  const seller = await db.sellerProfile.findUnique({
    where: { userId: requestUserId },
    select: { id: true },
  });
  if (!seller) {
    throw new AppError(403, "SELLER_REQUIRED", "Create a seller profile first");
  }
  return seller;
}

export function registerSellerCampaigns(
  app: FastifyInstance,
  client?: PrismaClient,
) {
  const db = () => requireDatabase(client);

  app.get("/seller/campaigns", protectedRoute(app), async (request) => {
    const seller = await sellerForRequest(db(), userId(request));
    const campaigns = await db().campaign.findMany({
      where: { sellerId: seller.id },
      include: campaignInclude,
      orderBy: { createdAt: "desc" },
    });
    return {
      data: campaigns.map(serializeCampaign),
      delivery: {
        enabled: false,
        reason: "Campaign delivery is not configured yet.",
      },
    };
  });

  app.get("/seller/campaigns/:id", protectedRoute(app), async (request) => {
    const { id } = params.parse(request.params);
    const seller = await sellerForRequest(db(), userId(request));
    const campaign = await db().campaign.findFirst({
      where: { id, sellerId: seller.id },
      include: campaignInclude,
    });
    if (!campaign) {
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    }
    return { data: serializeCampaign(campaign) };
  });

  app.post("/seller/campaigns", protectedRoute(app), async (request, reply) => {
    const input = campaignBody.parse(request.body);
    if (input.audienceAgeMin > input.audienceAgeMax) {
      throw new AppError(
        400,
        "INVALID_AUDIENCE_AGE_RANGE",
        "Minimum audience age cannot exceed maximum audience age",
      );
    }
    const budget = new Prisma.Decimal(input.dailyBudget);
    if (budget.lte(0)) {
      throw new AppError(
        400,
        "INVALID_CAMPAIGN_BUDGET",
        "Daily budget must be greater than zero",
      );
    }

    const seller = await sellerForRequest(db(), userId(request));
    const product = await db().product.findFirst({
      where: { id: input.productId, sellerId: seller.id, active: true },
      select: { id: true, name: true },
    });
    if (!product) {
      throw new AppError(
        404,
        "PRODUCT_NOT_FOUND",
        "Choose an active product from your store",
      );
    }

    const campaign = await db().campaign.create({
      data: {
        sellerId: seller.id,
        productId: product.id,
        name: input.name ?? `${product.name} Campaign`,
        objective: input.objective,
        status: "DRAFT",
        audienceCountry: input.audienceCountry,
        audienceAgeMin: input.audienceAgeMin,
        audienceAgeMax: input.audienceAgeMax,
        audienceInterests: input.audienceInterests,
        dailyBudget: budget,
        durationDays: input.durationDays,
      },
      include: campaignInclude,
    });

    return reply.code(201).send({ data: serializeCampaign(campaign) });
  });

  app.patch("/seller/campaigns/:id", protectedRoute(app), async (request) => {
    const { id } = params.parse(request.params);
    const input = campaignBody.partial().parse(request.body);
    const seller = await sellerForRequest(db(), userId(request));
    const existing = await db().campaign.findFirst({
      where: { id, sellerId: seller.id },
      select: {
        id: true,
        status: true,
        productId: true,
        audienceAgeMin: true,
        audienceAgeMax: true,
      },
    });
    if (!existing) {
      throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(
        409,
        "CAMPAIGN_NOT_EDITABLE",
        "Only draft campaigns can be edited",
      );
    }
    const audienceAgeMin = input.audienceAgeMin ?? existing.audienceAgeMin;
    const audienceAgeMax = input.audienceAgeMax ?? existing.audienceAgeMax;
    if (audienceAgeMin > audienceAgeMax) {
      throw new AppError(
        400,
        "INVALID_AUDIENCE_AGE_RANGE",
        "Minimum audience age cannot exceed maximum audience age",
      );
    }

    if (input.productId && input.productId !== existing.productId) {
      const product = await db().product.findFirst({
        where: { id: input.productId, sellerId: seller.id, active: true },
        select: { id: true },
      });
      if (!product) {
        throw new AppError(
          404,
          "PRODUCT_NOT_FOUND",
          "Choose an active product from your store",
        );
      }
    }

    const dailyBudget =
      input.dailyBudget === undefined
        ? undefined
        : new Prisma.Decimal(input.dailyBudget);
    if (dailyBudget?.lte(0)) {
      throw new AppError(
        400,
        "INVALID_CAMPAIGN_BUDGET",
        "Daily budget must be greater than zero",
      );
    }

    const campaign = await db().campaign.update({
      where: { id },
      data: {
        ...input,
        dailyBudget,
      },
      include: campaignInclude,
    });
    return { data: serializeCampaign(campaign) };
  });

  app.delete(
    "/seller/campaigns/:id",
    protectedRoute(app),
    async (request, reply) => {
      const { id } = params.parse(request.params);
      const seller = await sellerForRequest(db(), userId(request));
      const existing = await db().campaign.findFirst({
        where: { id, sellerId: seller.id },
        select: { id: true, status: true },
      });
      if (!existing) {
        throw new AppError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
      }
      if (existing.status !== "DRAFT") {
        throw new AppError(
          409,
          "CAMPAIGN_NOT_DELETABLE",
          "Only draft campaigns can be deleted",
        );
      }
      await db().campaign.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
}
