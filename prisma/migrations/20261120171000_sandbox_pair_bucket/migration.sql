BEGIN;
-- One live sandbox session per pairing bucket: the HMAC digest of the client's address bucket.
ALTER TABLE "SandboxSession" ADD COLUMN "pairDigest" TEXT CHECK ("pairDigest" IS NULL OR "pairDigest" ~ '^[a-f0-9]{64}$');
CREATE INDEX "SandboxSession_generation_pairDigest_idx" ON "SandboxSession" ("generation", "pairDigest");
COMMIT;
