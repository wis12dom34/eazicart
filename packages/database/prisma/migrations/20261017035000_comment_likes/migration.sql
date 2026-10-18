CREATE TABLE "ProductCommentLike" (
  "userId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCommentLike_pkey" PRIMARY KEY ("userId", "commentId"),
  CONSTRAINT "ProductCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ProductComment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ProductCommentLike_commentId_idx" ON "ProductCommentLike"("commentId");

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]