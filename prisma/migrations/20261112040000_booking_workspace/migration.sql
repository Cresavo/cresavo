BEGIN;
LOCK TABLE "Booking" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "Service"
  ADD COLUMN "buffer" INTEGER NOT NULL DEFAULT 0 CHECK ("buffer" BETWEEN 0 AND 120),
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0);

CREATE TABLE "Staff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "serviceIds" TEXT[] NOT NULL,
  "weekly" JSONB NOT NULL,
  "exceptions" JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX "Staff_businessId_active_idx" ON "Staff"("businessId", "active");
INSERT INTO "Staff" ("id", "businessId", "name", "serviceIds", "weekly")
SELECT 'staff-demo', 'demo', 'Anna', COALESCE((SELECT array_agg("id") FROM "Service" WHERE "businessId"='demo'), ARRAY['fotvard','massage']),
  '[{"weekday":1,"periods":[{"start":"09:00","end":"17:00"}],"breaks":[]},{"weekday":2,"periods":[{"start":"09:00","end":"17:00"}],"breaks":[]},{"weekday":3,"periods":[{"start":"09:00","end":"17:00"}],"breaks":[]},{"weekday":4,"periods":[{"start":"09:00","end":"17:00"}],"breaks":[]},{"weekday":5,"periods":[{"start":"09:00","end":"17:00"}],"breaks":[]}]';

ALTER TABLE "Booking"
  ADD COLUMN "serviceName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "priceOre" INTEGER NOT NULL DEFAULT 0 CHECK ("priceOre" >= 0),
  ADD COLUMN "duration" INTEGER NOT NULL DEFAULT 0 CHECK ("duration" >= 0),
  ADD COLUMN "buffer" INTEGER NOT NULL DEFAULT 0 CHECK ("buffer" >= 0),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'confirmed' CHECK ("status" IN ('confirmed','cancelled')),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  ADD COLUMN "initialStartsAt" TIMESTAMPTZ(3),
  ADD COLUMN "initialEndsAt" TIMESTAMPTZ(3);

-- Earlier prices were not stored: this is the service data known at migration,
-- while booked start/end and the actual elapsed duration remain authoritative.
UPDATE "Booking" b SET
  "serviceName" = s."name", "priceOre" = s."priceOre",
  "duration" = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (b."endsAt"-b."startsAt"))/60)::integer),
  "initialStartsAt" = b."startsAt", "initialEndsAt" = b."endsAt"
FROM "Service" s WHERE s."id"=b."serviceId";

-- Legacy direct inserts retain their contract and receive a snapshot as well.
CREATE FUNCTION booking_service_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."serviceName" = '' THEN
    SELECT "name", "priceOre" INTO NEW."serviceName", NEW."priceOre"
      FROM "Service" WHERE "id"=NEW."serviceId";
    NEW."buffer" := 0;
    NEW."duration" := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (NEW."endsAt"-NEW."startsAt"))/60)::integer);
  END IF;
  NEW."initialStartsAt" := COALESCE(NEW."initialStartsAt", NEW."startsAt");
  NEW."initialEndsAt" := COALESCE(NEW."initialEndsAt", NEW."endsAt");
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_service_snapshot_before_insert BEFORE INSERT ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION booking_service_snapshot();

ALTER TABLE "Booking" DROP CONSTRAINT booking_no_overlap;
ALTER TABLE "Booking" ADD CONSTRAINT booking_no_overlap EXCLUDE USING gist
  ("businessId" WITH =, "staffId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" = 'confirmed');

CREATE TABLE "BookingEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "action" TEXT NOT NULL CHECK ("action" IN ('create','move','cancel')),
  "actorKind" TEXT NOT NULL CHECK ("actorKind" IN ('admin','local-mcp','public')),
  "actorId" TEXT NOT NULL,
  "previousStart" TIMESTAMPTZ(3), "previousEnd" TIMESTAMPTZ(3), "previousStaffId" TEXT,
  "nextStart" TIMESTAMPTZ(3), "nextEnd" TIMESTAMPTZ(3), "nextStaffId" TEXT
);
CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");
CREATE TABLE "WorkspaceRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WorkspaceRequest_businessId_key_key" ON "WorkspaceRequest"("businessId", "key");
COMMIT;
