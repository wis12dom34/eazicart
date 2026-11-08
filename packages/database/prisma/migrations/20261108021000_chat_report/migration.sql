-- Additive, review-only; never deploy without separate approval.
CREATE TABLE "ChatReport" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" VARCHAR(32) NOT NULL,
  "details" VARCHAR(1000),
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChatReport_conversationId_reporterId_key"
  ON "ChatReport"("conversationId", "reporterId");
CREATE INDEX "ChatReport_status_createdAt_idx"
  ON "ChatReport"("status", "createdAt");
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
