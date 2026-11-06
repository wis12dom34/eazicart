-- Additive review-only migration. Never run against production without approval.
-- Deliberately no lease timeout or automatic reset; provider calls can be
-- ambiguous after network failures. Require manual/provider reconciliation.
CREATE TABLE "KoraCheckoutAttempt" (
  "paymentId" TEXT NOT NULL,
  "reference" VARCHAR(128) NOT NULL,
  "state" VARCHAR(24) NOT NULL DEFAULT 'INITIATING',
  "authorizationUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KoraCheckoutAttempt_pkey" PRIMARY KEY ("paymentId"),
  CONSTRAINT "KoraCheckoutAttempt_state_check"
    CHECK ("state" IN ('INITIATING', 'READY', 'UNKNOWN'))
);
CREATE INDEX "KoraCheckoutAttempt_state_createdAt_idx"
  ON "KoraCheckoutAttempt"("state", "createdAt");
ALTER TABLE "KoraCheckoutAttempt"
  ADD CONSTRAINT "KoraCheckoutAttempt_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
