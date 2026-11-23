-- CreateTable
CREATE TABLE "BrowserDevice" (
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "activeUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserAccount" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserDevice_secretHash_key" ON "BrowserDevice"("secretHash");

-- CreateIndex
CREATE INDEX "BrowserAccount_userId_idx" ON "BrowserAccount"("userId");

-- CreateIndex
CREATE INDEX "BrowserAccount_refreshTokenHash_idx" ON "BrowserAccount"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "BrowserAccount_deviceId_userId_key" ON "BrowserAccount"("deviceId", "userId");

-- AddForeignKey
ALTER TABLE "BrowserAccount" ADD CONSTRAINT "BrowserAccount_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BrowserDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowserAccount" ADD CONSTRAINT "BrowserAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
