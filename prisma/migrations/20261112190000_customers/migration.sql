-- Additive only. Existing booking snapshots and links remain untouched.
CREATE TABLE "Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "Customer_businessId_id_key" ON "Customer"("businessId", "id");
CREATE INDEX "Customer_businessId_archived_name_id_idx" ON "Customer"("businessId", "archived", "name", "id");
ALTER TABLE "Booking" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_customerId_fkey"
  FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Booking_businessId_customerId_startsAt_id_idx" ON "Booking"("businessId", "customerId", "startsAt", "id");
