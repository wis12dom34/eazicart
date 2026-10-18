CREATE TABLE "ChatConversation" (
 "id" TEXT NOT NULL,
 "buyerId" TEXT NOT NULL,
 "sellerId" TEXT NOT NULL,
 "lastMessageAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChatMessage" (
 "id" TEXT NOT NULL,
 "body" TEXT NOT NULL,
 "conversationId" TEXT NOT NULL,
 "senderId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "readAt" TIMESTAMP(3),
 CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChatConversation_buyerId_sellerId_key" ON "ChatConversation"("buyerId", "sellerId");
CREATE INDEX "ChatConversation_buyerId_lastMessageAt_idx" ON "ChatConversation"("buyerId", "lastMessageAt");
CREATE INDEX "ChatConversation_sellerId_lastMessageAt_idx" ON "ChatConversation"("sellerId", "lastMessageAt");
CREATE INDEX "ChatMessage_conversationId_createdAt_id_idx" ON "ChatMessage"("conversationId", "createdAt", "id");
CREATE INDEX "ChatMessage_conversationId_readAt_idx" ON "ChatMessage"("conversationId", "readAt");
CREATE INDEX "ChatMessage_senderId_createdAt_idx" ON "ChatMessage"("senderId", "createdAt");
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]