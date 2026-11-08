-- Additive migration; NOT approved for production.
ALTER TABLE "Conversation" ADD COLUMN "buyerBlockedAt" TIMESTAMP(3);
ALTER TABLE "Conversation" ADD COLUMN "sellerBlockedAt" TIMESTAMP(3);
