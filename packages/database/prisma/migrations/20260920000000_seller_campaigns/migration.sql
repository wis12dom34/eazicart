CREATE TYPE "CampaignObjective" AS ENUM ('PRODUCT_VIEWS', 'STORE_VISITS', 'ORDERS', 'FOLLOWERS');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" "CampaignObjective" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceCountry" TEXT NOT NULL DEFAULT 'Nigeria',
    "audienceAgeMin" INTEGER NOT NULL DEFAULT 18,
    "audienceAgeMax" INTEGER NOT NULL DEFAULT 44,
    "audienceInterests" TEXT,
    "dailyBudget" DECIMAL(12,2) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Campaign_sellerId_status_createdAt_idx" ON "Campaign"("sellerId", "status", "createdAt");
CREATE INDEX "Campaign_productId_idx" ON "Campaign"("productId");

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
