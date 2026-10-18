CREATE TABLE "SellerFulfillmentEvent" (
  "id" TEXT NOT NULL,
  "fulfillmentId" TEXT NOT NULL,
  "status" "SellerFulfillmentStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerFulfillmentEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerFulfillmentEvent_fulfillmentId_status_key" ON "SellerFulfillmentEvent"("fulfillmentId", "status");
CREATE INDEX "SellerFulfillmentEvent_fulfillmentId_createdAt_id_idx" ON "SellerFulfillmentEvent"("fulfillmentId", "createdAt", "id");
ALTER TABLE "SellerFulfillmentEvent" ADD CONSTRAINT "SellerFulfillmentEvent_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "SellerFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]