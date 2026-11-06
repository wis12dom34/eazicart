-- Additive migration ONLY. Do not execute against production without approval.
-- Durable idempotency keys are scoped per buyer and are never cleared during
-- checkout retries. One key can point to only one order.
CREATE TABLE "OrderIdempotency" (
  "buyerId" TEXT NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "OrderIdempotency_pkey" PRIMARY KEY ("buyerId", "key")
);
CREATE UNIQUE INDEX "OrderIdempotency_orderId_key"
  ON "OrderIdempotency"("orderId");
CREATE INDEX "OrderIdempotency_createdAt_idx"
  ON "OrderIdempotency"("createdAt");
ALTER TABLE "OrderIdempotency" ADD CONSTRAINT "OrderIdempotency_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderIdempotency" ADD CONSTRAINT "OrderIdempotency_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
