-- Customer consent has one profile: the one-time e-mail code (ADR 7, issue #187). The bearer
-- approval link, the separate synthetic channel and the SMS code lab are gone, so their columns
-- and checks go too. Older rows keep their consentDelivery and mandate verifiedVia values, which
-- the checks below still accept; no new row can use them.
BEGIN;
ALTER TABLE "AgentProposal" DROP CONSTRAINT IF EXISTS "AgentProposal_sms_snapshot_check";
ALTER TABLE "AgentProposal" DROP CONSTRAINT "AgentProposal_consentDelivery_check";
DROP INDEX "AgentProposal_tokenHash_key";
ALTER TABLE "AgentProposal"
  DROP COLUMN "tokenHash",
  DROP COLUMN "smsOtpRequired",
  DROP COLUMN "phoneHash",
  DROP COLUMN "phoneMask";
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_consentDelivery_check" CHECK (
  "consentDelivery" IS NULL OR
  ("consentDelivery" IN ('separate-lab-v1', 'email-code-v1') AND "businessId" NOT LIKE 'sandbox-%') OR
  ("consentDelivery" = 'sandbox-demo-phone-v1' AND "businessId" LIKE 'sandbox-%')
);
COMMIT;
