-- Additive review-only migration; never apply to production without approval.
ALTER TABLE "Conversation" ADD COLUMN "buyerReadAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "sellerReadAt" TIMESTAMP(3);
ALTER TABLE "ChatMessage" ADD COLUMN "productId" TEXT;
CREATE INDEX "ChatMessage_productId_idx" ON "ChatMessage"("productId");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
