ALTER TABLE "Customer" ADD COLUMN "contactRemovedAt" TIMESTAMPTZ(3);
ALTER TABLE "Booking" ADD COLUMN "contactRemovedAt" TIMESTAMPTZ(3);
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_removed_contact_check" CHECK (
  "contactRemovedAt" IS NULL OR
  ("archived" AND "name" = 'Kontaktuppgifter borttagna' AND "email" = 'removed@example.test' AND "phone" IS NULL)
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_removed_contact_check" CHECK (
  "contactRemovedAt" IS NULL OR
  ("customerName" = 'Kontaktuppgifter borttagna' AND "customerEmail" = 'removed@example.test')
);
CREATE UNIQUE INDEX "AdminUser_businessId_id_key" ON "AdminUser"("businessId", "id");
CREATE TABLE "CustomerDataAction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL CHECK ("action" IN ('export', 'remove_contact')),
  "bookingCount" INTEGER NOT NULL CHECK ("bookingCount" >= 0),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerDataAction_customer_fk" FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerDataAction_actor_fk" FOREIGN KEY ("businessId", "actorId") REFERENCES "AdminUser"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomerDataAction_businessId_customerId_createdAt_id_idx" ON "CustomerDataAction"("businessId", "customerId", "createdAt", "id");
