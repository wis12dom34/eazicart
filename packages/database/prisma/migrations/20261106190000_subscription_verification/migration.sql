-- AlterTable
ALTER TABLE "User" ADD COLUMN     "verificationSuspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SellerSubscription" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ALTER COLUMN "sellerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "planCode" "SellerPlanCode" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerTransactionId" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_subscriptionId_key" ON "SubscriptionPayment"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_reference_key" ON "SubscriptionPayment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_provider_providerTransactionId_key" ON "SubscriptionPayment"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX "SellerSubscription_accountId_status_idx" ON "SellerSubscription"("accountId", "status");

-- AddForeignKey
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SellerSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing seller owners; account subscriptions have exactly one owner.
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_one_owner"
CHECK (num_nonnulls("sellerId", "accountId") = 1);
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_valid_period"
CHECK ("startsAt" IS NULL OR "currentPeriodEnd" IS NULL OR "startsAt" < "currentPeriodEnd") NOT VALID;
-- NOT VALID preserves legacy rows; a separate audit is required before validation.
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_positive_amount" CHECK ("amountMinor" > 0);
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_supported_provider" CHECK ("provider" IN ('PAYSTACK', 'KORAPAY'));
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_paid_tier" CHECK ("planCode" IN ('PRO', 'BUSINESS'));
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_settlement_evidence"
CHECK ("status" <> 'SUCCESS' OR ("settledAt" IS NOT NULL AND "providerTransactionId" IS NOT NULL));
