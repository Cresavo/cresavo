CREATE UNIQUE INDEX "Booking_businessId_id_key" ON "Booking"("businessId", "id");
CREATE INDEX "Booking_businessId_status_startsAt_id_idx" ON "Booking"("businessId", "status", "startsAt", "id");
CREATE UNIQUE INDEX "Campaign_businessId_id_key" ON "Campaign"("businessId", "id");
CREATE TABLE "CapacityDecision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL CHECK ("sourceVersion" > 0),
  "outcome" TEXT NOT NULL CHECK ("outcome" IN ('dismissed', 'draft')),
  "campaignId" TEXT,
  "payloadHash" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapacityDecision_campaign_outcome_check" CHECK (
    ("outcome" = 'dismissed' AND "campaignId" IS NULL AND "payloadHash" IS NULL) OR
    ("outcome" = 'draft' AND "campaignId" IS NOT NULL AND "payloadHash" IS NOT NULL)
  ),
  CONSTRAINT "CapacityDecision_booking_fk" FOREIGN KEY ("businessId", "bookingId") REFERENCES "Booking"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CapacityDecision_campaign_fk" FOREIGN KEY ("businessId", "campaignId") REFERENCES "Campaign"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CapacityDecision_campaignId_key" ON "CapacityDecision"("campaignId");
CREATE UNIQUE INDEX "CapacityDecision_businessId_campaignId_key" ON "CapacityDecision"("businessId", "campaignId");
CREATE UNIQUE INDEX "CapacityDecision_businessId_bookingId_sourceVersion_key" ON "CapacityDecision"("businessId", "bookingId", "sourceVersion");
