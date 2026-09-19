CREATE TYPE "SellerPlanCode" AS ENUM ('BASIC', 'PRO', 'BUSINESS');
CREATE TYPE "SellerSubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED', 'EXPIRED');

CREATE TABLE "SellerPlan" (
    "code" "SellerPlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(12,2),
    "productLimit" INTEGER,
    "campaignLimit" INTEGER,
    "advancedAnalytics" BOOLEAN,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerPlan_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "SellerSubscription" (
    "id" TEXT NOT NULL,
    "status" "SellerSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "sellerId" TEXT NOT NULL,
    "planCode" "SellerPlanCode" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SellerPlan_published_displayOrder_idx" ON "SellerPlan"("published", "displayOrder");
CREATE INDEX "SellerSubscription_sellerId_status_idx" ON "SellerSubscription"("sellerId", "status");
CREATE INDEX "SellerSubscription_planCode_status_idx" ON "SellerSubscription"("planCode", "status");

ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_planCode_fkey"
FOREIGN KEY ("planCode") REFERENCES "SellerPlan"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SellerPlan" (
    "code", "name", "monthlyPrice", "productLimit", "campaignLimit",
    "advancedAnalytics", "published", "displayOrder", "createdAt", "updatedAt"
) VALUES
    ('BASIC', 'Basic', NULL, NULL, NULL, NULL, false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('PRO', 'Pro', NULL, NULL, NULL, NULL, false, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('BUSINESS', 'Business', NULL, NULL, NULL, NULL, false, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
