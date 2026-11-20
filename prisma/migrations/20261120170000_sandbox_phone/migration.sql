BEGIN;
CREATE TABLE "SandboxPhone" (
  "sessionId" UUID PRIMARY KEY REFERENCES "SandboxSession"("id") ON DELETE CASCADE,
  "linkHash" TEXT NOT NULL UNIQUE CHECK ("linkHash" ~ '^[a-f0-9]{64}$'),
  "browserHash" TEXT UNIQUE CHECK ("browserHash" IS NULL OR "browserHash" ~ '^[a-f0-9]{64}$'),
  "redeemedAt" TIMESTAMPTZ(3),
  "requests" INTEGER NOT NULL DEFAULT 0 CHECK ("requests" BETWEEN 0 AND 128),
  CHECK (("browserHash" IS NULL) = ("redeemedAt" IS NULL))
);
CREATE TABLE "SandboxPairBudget" (
  "day" DATE NOT NULL,
  "ipDigest" TEXT NOT NULL CHECK ("ipDigest" ~ '^[a-f0-9]{64}$'),
  "count" INTEGER NOT NULL CHECK ("count" BETWEEN 1 AND 3),
  PRIMARY KEY ("day", "ipDigest")
);
COMMIT;
