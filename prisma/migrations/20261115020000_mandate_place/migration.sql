BEGIN;
ALTER TABLE "AgentMandate" ADD COLUMN "locationId" TEXT NOT NULL DEFAULT 'demo-location';
ALTER TABLE "AgentMandate" ADD COLUMN "scheduleId" TEXT;
-- Old grants already pin one Staff and thus that Staff's only existing schedule.
-- Preserve this implicit scope explicitly; do not add new venues or permissions.
UPDATE "AgentMandate" SET "scheduleId" = 'staff-schedule:' || "staffId";
ALTER TABLE "AgentMandate" ALTER COLUMN "scheduleId" SET NOT NULL;
ALTER TABLE "AgentMandate" ADD CONSTRAINT "mandate_place_not_empty"
  CHECK (length("locationId") BETWEEN 1 AND 128 AND length("scheduleId") BETWEEN 1 AND 160);
COMMIT;
