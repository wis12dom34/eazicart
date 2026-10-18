ALTER TABLE "ProductComment" ADD COLUMN "parentId" TEXT;
CREATE INDEX "ProductComment_parentId_createdAt_id_idx" ON "ProductComment"("parentId", "createdAt", "id");
ALTER TABLE "ProductComment" ADD CONSTRAINT "ProductComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]