-- CreateEnum
CREATE TYPE "ReelSource" AS ENUM ('EAZICART', 'YOUTUBE', 'TIKTOK', 'PARTNER');

-- CreateEnum
CREATE TYPE "ReelStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateTable
CREATE TABLE "Reel" (
    "id" TEXT NOT NULL,
    "source" "ReelSource" NOT NULL DEFAULT 'EAZICART',
    "status" "ReelStatus" NOT NULL DEFAULT 'PUBLISHED',
    "caption" TEXT,
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "attribution" TEXT,
    "sellerId" TEXT,
    "productId" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelLike" (
    "userId" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelLike_pkey" PRIMARY KEY ("userId","reelId")
);

-- CreateTable
CREATE TABLE "ReelSave" (
    "userId" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelSave_pkey" PRIMARY KEY ("userId","reelId")
);

-- CreateTable
CREATE TABLE "ReelView" (
    "id" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "userId" TEXT,
    "watchMs" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReelComment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReelComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Reel_source_externalId_key" ON "Reel"("source", "externalId");

-- CreateIndex
CREATE INDEX "Reel_status_publishedAt_idx" ON "Reel"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Reel_source_publishedAt_idx" ON "Reel"("source", "publishedAt");

-- CreateIndex
CREATE INDEX "Reel_sellerId_publishedAt_idx" ON "Reel"("sellerId", "publishedAt");

-- CreateIndex
CREATE INDEX "Reel_productId_idx" ON "Reel"("productId");

-- CreateIndex
CREATE INDEX "ReelLike_reelId_createdAt_idx" ON "ReelLike"("reelId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelSave_reelId_createdAt_idx" ON "ReelSave"("reelId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelView_reelId_createdAt_idx" ON "ReelView"("reelId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelView_userId_createdAt_idx" ON "ReelView"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReelComment_reelId_createdAt_idx" ON "ReelComment"("reelId", "createdAt");

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelLike" ADD CONSTRAINT "ReelLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelLike" ADD CONSTRAINT "ReelLike_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelSave" ADD CONSTRAINT "ReelSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelSave" ADD CONSTRAINT "ReelSave_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelView" ADD CONSTRAINT "ReelView_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelView" ADD CONSTRAINT "ReelView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelComment" ADD CONSTRAINT "ReelComment_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelComment" ADD CONSTRAINT "ReelComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
