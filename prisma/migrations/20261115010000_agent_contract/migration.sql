CREATE TABLE "AgentClient" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  UNIQUE ("businessId", "id")
);
-- One stable identity per existing key preserves its historical namespace.
INSERT INTO "AgentClient" ("id", "businessId") SELECT "id", "businessId" FROM "AgentApiKey";
ALTER TABLE "AgentApiKey" ADD COLUMN "clientId" TEXT;
UPDATE "AgentApiKey" SET "clientId" = "id";
ALTER TABLE "AgentApiKey" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "AgentApiKey" ADD FOREIGN KEY ("businessId", "clientId") REFERENCES "AgentClient" ("businessId", "id") ON DELETE RESTRICT;

CREATE TABLE "AgentMandate" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "validFrom" TIMESTAMPTZ(3) NOT NULL,
  "validUntil" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "maxPriceOre" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SEK',
  "origin" TEXT NOT NULL,
  "originReference" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(3),
  FOREIGN KEY ("businessId", "clientId") REFERENCES "AgentClient" ("businessId", "id") ON DELETE RESTRICT,
  CHECK ("validFrom" < "validUntil" AND "maxPriceOre" >= 0 AND "currency" = 'SEK'),
  CHECK ("origin" = 'synthetic-operator' AND length("originReference") BETWEEN 1 AND 128),
  UNIQUE ("businessId", "id", "clientId")
);
CREATE INDEX "AgentMandate_businessId_clientId_createdAt_idx" ON "AgentMandate" ("businessId", "clientId", "createdAt");

ALTER TABLE "AgentBooking" ADD COLUMN "clientId" TEXT;
ALTER TABLE "AgentBooking" ADD COLUMN "mandateId" TEXT;
UPDATE "AgentBooking" AS b SET "clientId" = k."clientId"
FROM "AgentApiKey" AS k WHERE b."keyId" = k."id" AND b."businessId" = k."businessId";
-- Refuse orphaned historical links; never silently delete or reassign them.
ALTER TABLE "AgentBooking" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "AgentBooking" ADD FOREIGN KEY ("businessId", "clientId") REFERENCES "AgentClient" ("businessId", "id") ON DELETE RESTRICT;
ALTER TABLE "AgentBooking" ADD FOREIGN KEY ("businessId", "bookingId") REFERENCES "Booking" ("businessId", "id") ON DELETE RESTRICT;
ALTER TABLE "AgentBooking" ADD FOREIGN KEY ("businessId", "mandateId", "clientId") REFERENCES "AgentMandate" ("businessId", "id", "clientId") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "AgentBooking_mandateId_key" ON "AgentBooking" ("mandateId");
CREATE UNIQUE INDEX "AgentBooking_businessId_bookingId_key" ON "AgentBooking" ("businessId", "bookingId");
CREATE UNIQUE INDEX "AgentBooking_businessId_mandateId_clientId_key" ON "AgentBooking" ("businessId", "mandateId", "clientId");
CREATE INDEX "AgentBooking_businessId_clientId_createdAt_idx" ON "AgentBooking" ("businessId", "clientId", "createdAt");
