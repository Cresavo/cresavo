-- Agent API v1: per-agent keys with a responsible owner. Hash only, never plaintext.
CREATE TABLE "AgentApiKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "ownerContact" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL CHECK ("keyHash" ~ '^[0-9a-f]{64}$'),
  "scopes" TEXT[],
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3)
);
CREATE UNIQUE INDEX "AgentApiKey_keyPrefix_key" ON "AgentApiKey"("keyPrefix");
CREATE UNIQUE INDEX "AgentApiKey_keyHash_key" ON "AgentApiKey"("keyHash");
CREATE INDEX "AgentApiKey_businessId_revokedAt_idx" ON "AgentApiKey"("businessId", "revokedAt");
