CREATE TABLE "SellerMapLocation" (
    "sellerId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerMapLocation_pkey" PRIMARY KEY ("sellerId")
);

CREATE INDEX "SellerMapLocation_visible_updatedAt_idx" ON "SellerMapLocation"("visible", "updatedAt");

ALTER TABLE "SellerMapLocation" ADD CONSTRAINT "SellerMapLocation_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
