CREATE TYPE "SellerFulfillmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED');

CREATE TABLE "SellerFulfillment" (
    "id" TEXT NOT NULL,
    "status" "SellerFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "orderId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SellerFulfillment_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SellerFulfillment" ("id", "status", "orderId", "sellerId", "createdAt", "updatedAt")
SELECT
    'sf_' || md5(o."id" || ':' || p."sellerId"),
    CASE o."status"::text
      WHEN 'CONFIRMED' THEN 'CONFIRMED'::"SellerFulfillmentStatus"
      WHEN 'FULFILLED' THEN 'FULFILLED'::"SellerFulfillmentStatus"
      WHEN 'CANCELLED' THEN 'CANCELLED'::"SellerFulfillmentStatus"
      ELSE 'PENDING'::"SellerFulfillmentStatus"
    END,
    o."id",
    p."sellerId",
    o."createdAt",
    o."updatedAt"
FROM "Order" o
JOIN "OrderItem" oi ON oi."orderId" = o."id"
JOIN "Product" p ON p."id" = oi."productId"
GROUP BY o."id", o."status", o."createdAt", o."updatedAt", p."sellerId";

CREATE UNIQUE INDEX "SellerFulfillment_orderId_sellerId_key" ON "SellerFulfillment"("orderId", "sellerId");
CREATE INDEX "SellerFulfillment_sellerId_status_idx" ON "SellerFulfillment"("sellerId", "status");
CREATE INDEX "SellerFulfillment_orderId_idx" ON "SellerFulfillment"("orderId");

ALTER TABLE "SellerFulfillment" ADD CONSTRAINT "SellerFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerFulfillment" ADD CONSTRAINT "SellerFulfillment_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
