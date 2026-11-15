-- Agent API v1 writes: provenance per key, booking ownership and a public-safe activity feed.
ALTER TABLE "AgentApiKey" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'registered-client'
  CHECK ("kind" IN ('demo-script', 'registered-client', 'verified-agent-proof'));

CREATE TABLE "AgentBooking" (
  "bookingId" TEXT NOT NULL PRIMARY KEY,
  "keyId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AgentBooking_keyId_createdAt_idx" ON "AgentBooking"("keyId", "createdAt");

CREATE TABLE "AgentApiEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "keyId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "action" TEXT NOT NULL CHECK ("action" IN ('book', 'cancel')),
  "outcome" TEXT NOT NULL,
  "serviceName" TEXT,
  "staffName" TEXT,
  "startsAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AgentApiEvent_businessId_createdAt_id_idx" ON "AgentApiEvent"("businessId", "createdAt", "id");

-- Allow the server-owned agent API channel in booking history.
ALTER TABLE "BookingEvent" DROP CONSTRAINT "BookingEvent_actorKind_check";
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_actorKind_check"
  CHECK ("actorKind" IN ('admin','local-mcp','public','agent-api'));
