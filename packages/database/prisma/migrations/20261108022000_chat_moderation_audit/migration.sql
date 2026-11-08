-- Additive moderator action audit; do not apply to production without approval.
CREATE TABLE "ChatModerationAction" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" VARCHAR(16) NOT NULL,
  "toStatus" VARCHAR(16) NOT NULL,
  "note" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatModerationAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatModerationAction_reportId_createdAt_idx"
  ON "ChatModerationAction"("reportId", "createdAt");
ALTER TABLE "ChatModerationAction" ADD CONSTRAINT "ChatModerationAction_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "ChatReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatModerationAction" ADD CONSTRAINT "ChatModerationAction_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
