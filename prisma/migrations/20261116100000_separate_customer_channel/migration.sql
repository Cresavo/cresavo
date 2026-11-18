-- Preserve the delivery profile of new local synthetic proposals across config changes.
-- Existing proposals remain the explicitly legacy lab contract.
BEGIN;
ALTER TABLE "AgentProposal" ADD COLUMN "consentDelivery" TEXT;
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_consentDelivery_check"
  CHECK ("consentDelivery" IS NULL OR ("consentDelivery" = 'separate-lab-v1' AND NOT "smsOtpRequired"));

-- Add one explicitly synthetic verification method, retaining the original
-- customer-consent origin requirement and the existing simulated OTP method.
ALTER TABLE "AgentMandate" DROP CONSTRAINT "AgentMandate_verifiedVia_check";
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_verifiedVia_check"
  CHECK ("verifiedVia" IS NULL OR (
    "verifiedVia" IN ('sms-otp', 'separate-lab-v1') AND "origin" = 'customer-consent'));
COMMIT;
