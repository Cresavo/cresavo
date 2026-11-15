CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "credentialVersion" INTEGER NOT NULL DEFAULT 1 CHECK ("credentialVersion" > 0)
);
ALTER TABLE "AdminSession" ADD COLUMN "userId" TEXT;
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AdminSession_userId_idx" ON "AdminSession"("userId");
