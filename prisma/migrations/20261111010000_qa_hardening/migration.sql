ALTER TABLE "Booking" ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Booking_businessId_idempotencyKey_key" ON "Booking"("businessId", "idempotencyKey");
CREATE INDEX "Booking_businessId_customerEmail_createdAt_idx" ON "Booking"("businessId", "customerEmail", "createdAt");
ALTER TABLE "Campaign" ADD CONSTRAINT campaign_valid_dates CHECK ("validFrom" <= "validUntil");
