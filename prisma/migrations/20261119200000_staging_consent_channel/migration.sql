-- Split-mode staging customer channel (docs/CUSTOMER_CONSENT_CHANNEL.md).
-- Adds one more server-selected delivery profile and verification method, and a
-- private inbox for the fixed fictional recipient. Existing values stay valid.
BEGIN;
ALTER TABLE "AgentProposal" DROP CONSTRAINT "AgentProposal_consentDelivery_check";
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_consentDelivery_check"
  CHECK ("consentDelivery" IS NULL OR (
    "consentDelivery" IN ('separate-lab-v1', 'separate-staging-v1') AND NOT "smsOtpRequired"));

ALTER TABLE "AgentMandate" DROP CONSTRAINT "AgentMandate_verifiedVia_check";
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_verifiedVia_check"
  CHECK ("verifiedVia" IS NULL OR (
    "verifiedVia" IN ('sms-otp', 'separate-lab-v1', 'separate-staging-v1') AND "origin" = 'customer-consent'));

-- Only these five columns. The link carries the one-time secret in its fragment;
-- the operator reads it through the database, no HTTP route exposes it.
CREATE TABLE "ConsentInboxMessage" (
    "proposalId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "approvalLink" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ConsentInboxMessage_pkey" PRIMARY KEY ("proposalId"),
    CONSTRAINT "ConsentInboxMessage_recipient_check" CHECK ("recipientId" = 'staging-customer-v1'),
    CONSTRAINT "ConsentInboxMessage_link_check" CHECK (
      "approvalLink" ~ '^https://[^/?#@]+/consent/[a-f0-9-]{36}#[A-Za-z0-9_-]{43}$' AND
      strpos("approvalLink", '/consent/' || "proposalId" || '#') > 0)
);

ALTER TABLE "ConsentInboxMessage" ADD CONSTRAINT "ConsentInboxMessage_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "AgentProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only proposals of the staging channel can have an inbox message.
CREATE FUNCTION "ConsentInboxMessage_channel_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AgentProposal" WHERE "id" = NEW."proposalId" AND "consentDelivery" = 'separate-staging-v1') THEN
    RAISE EXCEPTION 'CONSENT_INBOX_CHANNEL_INVALID';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ConsentInboxMessage_channel_guard" BEFORE INSERT OR UPDATE ON "ConsentInboxMessage"
  FOR EACH ROW EXECUTE FUNCTION "ConsentInboxMessage_channel_guard"();
COMMIT;
