CREATE TABLE "ProductFeedEvent" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dwellMs" INTEGER NOT NULL DEFAULT 0,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductFeedEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductFeedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductFeedEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductFeedEvent_userId_createdAt_idx" ON "ProductFeedEvent"("userId", "createdAt");
CREATE INDEX "ProductFeedEvent_userId_productId_createdAt_idx" ON "ProductFeedEvent"("userId", "productId", "createdAt");
CREATE INDEX "ProductFeedEvent_productId_kind_createdAt_idx" ON "ProductFeedEvent"("productId", "kind", "createdAt");

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]