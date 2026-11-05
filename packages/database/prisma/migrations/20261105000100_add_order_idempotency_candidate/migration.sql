-- ADDITIVE DRAFT ONLY: do not apply on production without approval.
CREATE TABLE "OrderIdempotency" (
  "buyerId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "addressId" TEXT NOT NULL,
  "expectedTotal" DECIMAL(12,2) NOT NULL,
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderIdempotency_pkey" PRIMARY KEY ("buyerId","key")
);
CREATE UNIQUE INDEX "OrderIdempotency_orderId_key" ON "OrderIdempotency"("orderId");
ALTER TABLE "OrderIdempotency"
  ADD CONSTRAINT "OrderIdempotency_buyerId_fkey" FOREIGN KEY ("buyerId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderIdempotency"
  ADD CONSTRAINT "OrderIdempotency_orderId_fkey" FOREIGN KEY ("orderId")
  REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
