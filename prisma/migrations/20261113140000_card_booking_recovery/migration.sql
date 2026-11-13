CREATE TABLE "CardBookingAttempt" (
  "businessId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "requestId" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "outcome" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardBookingAttempt_pkey" PRIMARY KEY ("businessId", "scope", "requestId"),
  CONSTRAINT "CardBookingAttempt_outcome_check" CHECK ("outcome" IN ('pending', 'saved', 'failed')),
  CONSTRAINT "CardBookingAttempt_scope_check" CHECK ("scope" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "CardBookingAttempt_businessId_scope_createdAt_requestId_idx"
  ON "CardBookingAttempt"("businessId", "scope", "createdAt", "requestId");
CREATE UNIQUE INDEX "CardBookingAttempt_one_pending"
  ON "CardBookingAttempt"("businessId", "scope") WHERE "outcome"='pending';
