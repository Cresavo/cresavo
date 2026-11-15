-- Preserve every native link and its composite business FK. Partner links have
-- no native Booking/Service/Staff row and cannot affect native availability.
ALTER TABLE "AgentBooking" ADD COLUMN "nativeBookingId" TEXT;
UPDATE "AgentBooking" SET "nativeBookingId" = "bookingId";
ALTER TABLE "AgentBooking" DROP CONSTRAINT "AgentBooking_businessId_bookingId_fkey";
CREATE UNIQUE INDEX "AgentBooking_nativeBookingId_key" ON "AgentBooking"("nativeBookingId");
CREATE UNIQUE INDEX "AgentBooking_businessId_nativeBookingId_key" ON "AgentBooking"("businessId", "nativeBookingId");
ALTER TABLE "AgentBooking" ADD CONSTRAINT "AgentBooking_businessId_nativeBookingId_fkey"
 FOREIGN KEY ("businessId", "nativeBookingId") REFERENCES "Booking"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentBooking" ADD CONSTRAINT "AgentBooking_native_or_lab_check" CHECK (
 ("businessId" = 'lab-partner' AND "nativeBookingId" IS NULL) OR
 ("businessId" <> 'lab-partner' AND "nativeBookingId" = "bookingId" AND "nativeBookingId" IS NOT NULL));
CREATE TABLE "PartnerBookingAttempt" (
 "idempotencyKey" TEXT PRIMARY KEY, "mandateId" TEXT NOT NULL UNIQUE,
 "businessId" TEXT NOT NULL, "clientId" TEXT NOT NULL, "providerId" TEXT NOT NULL,
 "bodyHash" TEXT NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PartnerBookingAttempt_mandate_fk" FOREIGN KEY ("businessId", "mandateId", "clientId")
 REFERENCES "AgentMandate"("businessId", "id", "clientId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "PartnerBookingAttempt_lab_check" CHECK ("businessId" = 'lab-partner' AND "providerId" = 'mock-partner')
);
CREATE UNIQUE INDEX "PartnerBookingAttempt_businessId_mandateId_clientId_key" ON "PartnerBookingAttempt"("businessId", "mandateId", "clientId");
