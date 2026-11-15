BEGIN;
ALTER TABLE "AgentMandate" ADD COLUMN "proposalHash" TEXT;
-- Replace only the historical operator-only origin check. Historical SQL stays intact.
DO $$
DECLARE origin_check text;
BEGIN
  SELECT conname INTO STRICT origin_check FROM pg_constraint
    WHERE conrelid = '"AgentMandate"'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%synthetic-operator%';
  EXECUTE format('ALTER TABLE "AgentMandate" DROP CONSTRAINT %I', origin_check);
END $$;
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_origin_authority_check" CHECK (
  "origin" IN ('synthetic-operator', 'customer-consent')
  AND length("originReference") BETWEEN 1 AND 128
  AND ("origin" <> 'customer-consent' OR ("proposalHash" IS NOT NULL AND "proposalHash" ~ '^[a-f0-9]{64}$'))
);
CREATE TABLE "AgentProposal" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "businessId" TEXT NOT NULL,
 "clientId" TEXT NOT NULL,
 "serviceId" TEXT NOT NULL,
 "serviceVersion" INTEGER NOT NULL,
 "serviceName" TEXT NOT NULL,
 "staffId" TEXT NOT NULL,
 "staffName" TEXT NOT NULL,
 "locationId" TEXT NOT NULL,
 "scheduleId" TEXT NOT NULL,
 "startsAt" TIMESTAMPTZ(3) NOT NULL,
 "duration" INTEGER NOT NULL CHECK ("duration" > 0),
 "priceOre" INTEGER NOT NULL CHECK ("priceOre" >= 0),
 "proposalHash" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
 "status" TEXT NOT NULL DEFAULT 'pending',
 "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 "mandateId" TEXT,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("status" IN ('pending', 'approved', 'declined')),
 CHECK (("status" = 'approved') = ("mandateId" IS NOT NULL)),
 CONSTRAINT "AgentProposal_mandate_fk" FOREIGN KEY ("businessId", "mandateId", "clientId") REFERENCES "AgentMandate"("businessId", "id", "clientId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "AgentProposal_client_fk" FOREIGN KEY ("businessId", "clientId") REFERENCES "AgentClient"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AgentProposal_tokenHash_key" ON "AgentProposal"("tokenHash");
CREATE UNIQUE INDEX "AgentProposal_mandateId_key" ON "AgentProposal"("mandateId");
CREATE INDEX "AgentProposal_businessId_clientId_createdAt_idx" ON "AgentProposal"("businessId", "clientId", "createdAt");
CREATE UNIQUE INDEX "AgentProposal_businessId_mandateId_clientId_key" ON "AgentProposal"("businessId", "mandateId", "clientId");
COMMIT;
