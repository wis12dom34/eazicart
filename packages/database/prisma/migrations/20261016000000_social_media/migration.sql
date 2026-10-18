CREATE TABLE "SocialMedia" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialMedia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SocialMedia_storageName_key" ON "SocialMedia"("storageName");
CREATE INDEX "SocialMedia_userId_kind_createdAt_idx" ON "SocialMedia"("userId", "kind", "createdAt");
CREATE INDEX "SocialMedia_kind_expiresAt_idx" ON "SocialMedia"("kind", "expiresAt");
ALTER TABLE "SocialMedia" ADD CONSTRAINT "SocialMedia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;