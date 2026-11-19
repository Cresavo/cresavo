BEGIN;
CREATE TABLE "PairGrant" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL REFERENCES "PairWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "subject" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "codeHash" TEXT UNIQUE,
    "revoked" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "PairGrant_workspaceId_idx" ON "PairGrant"("workspaceId");

CREATE TABLE "PairGrantToken" (
    "accessHash" TEXT PRIMARY KEY,
    "refreshHash" TEXT NOT NULL UNIQUE,
    "grantId" TEXT NOT NULL REFERENCES "PairGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "rotated" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PairGrantToken_grantId_idx" ON "PairGrantToken"("grantId");

-- Copy both sides from the same set of legacy credentials.
LOCK TABLE "PairToken" IN SHARE MODE;
INSERT INTO "PairGrant" ("id", "workspaceId", "subject", "clientId", "clientName", "scopes", "audience")
SELECT DISTINCT "family", "workspaceId", 'demo-owner:' || "workspaceId", "clientId", "clientName", "scopes", "audience"
FROM "PairToken";
INSERT INTO "PairGrantToken" ("accessHash", "refreshHash", "grantId", "rotated", "expiresAt")
SELECT "accessHash", "refreshHash", "family", "rotated", "expiresAt" FROM "PairToken";
COMMIT;
