-- OAuth 2.1 for customers' agents (ADR 7, issue #183). Public clients with PKCE; one grant is one
-- agent client at one salon. Codes and tokens are stored only as SHA-256 digests.
BEGIN;
CREATE TABLE "AgentOAuthClient" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "redirects" TEXT[],
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AgentOAuthClient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AgentOAuthClient_expiresAt_idx" ON "AgentOAuthClient"("expiresAt");

CREATE TABLE "AgentOAuthCode" (
  "hash" TEXT NOT NULL,
  "consent" BOOLEAN NOT NULL,
  "businessId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "scopes" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AgentOAuthCode_pkey" PRIMARY KEY ("hash"),
  CONSTRAINT "AgentOAuthCode_hash_check" CHECK ("hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "AgentOAuthCode_challenge_check" CHECK ("challenge" ~ '^[A-Za-z0-9_-]{43}$')
);
CREATE INDEX "AgentOAuthCode_expiresAt_idx" ON "AgentOAuthCode"("expiresAt");

CREATE TABLE "AgentGrant" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "oauthClientId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "scopes" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(3),
  CONSTRAINT "AgentGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentGrant_businessId_clientId_fkey" FOREIGN KEY ("businessId", "clientId")
    REFERENCES "AgentClient"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AgentGrant_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "AgentApiKey"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "AgentGrant_keyId_key" ON "AgentGrant"("keyId");
CREATE UNIQUE INDEX "AgentGrant_codeHash_key" ON "AgentGrant"("codeHash");
CREATE INDEX "AgentGrant_businessId_revokedAt_idx" ON "AgentGrant"("businessId", "revokedAt");

CREATE TABLE "AgentGrantToken" (
  "accessHash" TEXT NOT NULL,
  "refreshHash" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "rotated" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "refreshExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AgentGrantToken_pkey" PRIMARY KEY ("accessHash"),
  CONSTRAINT "AgentGrantToken_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "AgentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AgentGrantToken_refreshHash_key" ON "AgentGrantToken"("refreshHash");
CREATE INDEX "AgentGrantToken_grantId_idx" ON "AgentGrantToken"("grantId");

-- The credential row kind for a grant.
ALTER TABLE "AgentApiKey" DROP CONSTRAINT "AgentApiKey_kind_check";
ALTER TABLE "AgentApiKey" ADD CONSTRAINT "AgentApiKey_kind_check" CHECK (
  ("kind" IN ('demo-script', 'registered-client', 'verified-agent-proof', 'oauth-grant') AND "businessId" NOT LIKE 'sandbox-%') OR
  ("kind" = 'sandbox-demo' AND "businessId" LIKE 'sandbox-%')
);
COMMIT;
