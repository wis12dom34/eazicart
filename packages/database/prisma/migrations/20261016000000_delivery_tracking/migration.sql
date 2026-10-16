-- CreateEnum
CREATE TYPE "DeliveryTrackingStatus" AS ENUM ('ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVING_SOON', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DeliveryTracking" (
    "id" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "status" "DeliveryTrackingStatus" NOT NULL DEFAULT 'ASSIGNED',
    "riderName" TEXT,
    "riderPhone" TEXT,
    "vehicleLabel" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "speedMps" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "etaSeconds" INTEGER,
    "distanceMeters" INTEGER,
    "locationUpdatedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTracking_fulfillmentId_key" ON "DeliveryTracking"("fulfillmentId");
CREATE INDEX "DeliveryTracking_active_locationUpdatedAt_idx" ON "DeliveryTracking"("active", "locationUpdatedAt");
CREATE INDEX "DeliveryTracking_status_updatedAt_idx" ON "DeliveryTracking"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "DeliveryTracking" ADD CONSTRAINT "DeliveryTracking_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "SellerFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
