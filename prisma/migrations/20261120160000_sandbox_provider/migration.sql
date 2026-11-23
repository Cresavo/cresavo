BEGIN;
CREATE TABLE "SandboxSession" (
  "id" UUID PRIMARY KEY,
  "businessId" TEXT NOT NULL UNIQUE CHECK ("businessId" = 'sandbox-' || "id"::text),
  "clientId" TEXT NOT NULL UNIQUE,
  "generation" INTEGER NOT NULL CHECK ("generation" > 0),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "apiRequests" INTEGER NOT NULL DEFAULT 0 CHECK ("apiRequests" BETWEEN 0 AND 256),
  CONSTRAINT "SandboxSession_client_scope_key" UNIQUE ("businessId", "clientId"),
  FOREIGN KEY ("businessId", "clientId") REFERENCES "AgentClient"("businessId", "id") ON DELETE RESTRICT
);
CREATE INDEX "SandboxSession_generation_expiresAt_idx" ON "SandboxSession" ("generation", "expiresAt");
CREATE TABLE "SandboxAudit" (
  "id" TEXT PRIMARY KEY,
  "sessionId" UUID NOT NULL REFERENCES "SandboxSession"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "event" TEXT NOT NULL,
  "outcome" TEXT NOT NULL
);
CREATE INDEX "SandboxAudit_sessionId_idx" ON "SandboxAudit" ("sessionId");

ALTER TABLE "AgentApiKey" DROP CONSTRAINT "AgentApiKey_kind_check";
ALTER TABLE "AgentApiKey" ADD CONSTRAINT "AgentApiKey_kind_check" CHECK (
  ("kind" IN ('demo-script', 'registered-client', 'verified-agent-proof') AND "businessId" NOT LIKE 'sandbox-%') OR
  ("kind" = 'sandbox-demo' AND "businessId" LIKE 'sandbox-%')
);
ALTER TABLE "AgentProposal" DROP CONSTRAINT "AgentProposal_consentDelivery_check";
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_consentDelivery_check" CHECK (
  "consentDelivery" IS NULL OR (
    NOT "smsOtpRequired" AND (
      ("consentDelivery" = 'separate-lab-v1' AND "businessId" NOT LIKE 'sandbox-%') OR
      ("consentDelivery" = 'sandbox-demo-phone-v1' AND "businessId" LIKE 'sandbox-%')
    )
  )
);
ALTER TABLE "AgentMandate" DROP CONSTRAINT "AgentMandate_verifiedVia_check";
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_verifiedVia_check" CHECK (
  "verifiedVia" IS NULL OR (
    "origin" = 'customer-consent' AND (
      ("verifiedVia" IN ('sms-otp','separate-lab-v1') AND "businessId" NOT LIKE 'sandbox-%') OR
      ("verifiedVia" = 'sandbox-demo-phone-v1' AND "businessId" LIKE 'sandbox-%')
    )
  )
);
COMMIT;
