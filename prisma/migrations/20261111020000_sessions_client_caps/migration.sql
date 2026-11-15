ALTER TABLE "Booking" ADD COLUMN "clientKey" TEXT, ADD COLUMN "emailCapKey" TEXT;
UPDATE "Booking" SET "emailCapKey" = split_part(split_part(lower("customerEmail"), '@', 1), '+', 1) || '@' || split_part(lower("customerEmail"), '@', 2);
CREATE INDEX "Booking_businessId_clientKey_createdAt_idx" ON "Booking"("businessId", "clientKey", "createdAt");
CREATE INDEX "Booking_businessId_emailCapKey_createdAt_idx" ON "Booking"("businessId", "emailCapKey", "createdAt");
CREATE TABLE "AdminSession" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3)
);
