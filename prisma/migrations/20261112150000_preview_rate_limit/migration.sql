CREATE TABLE "RateLimitBucket" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "generation" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL CHECK ("count" >= 0)
);
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
