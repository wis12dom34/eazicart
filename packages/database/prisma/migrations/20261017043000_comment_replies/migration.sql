ALTER TABLE "ProductComment" ADD COLUMN "parentId" TEXT;
CREATE INDEX "ProductComment_parentId_createdAt_id_idx" ON "ProductComment"("parentId", "createdAt", "id");
ALTER TABLE "ProductComment" ADD CONSTRAINT "ProductComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;