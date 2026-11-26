-- Email one-time code on the consent page (ADR 7). The customer types their own address on a
-- consent page without a secret in its link, gets a code there and approves with it. Only the
-- address's digest and a mask are stored, and the mandate is bound to that digest at booking.
BEGIN;
ALTER TABLE "AgentProposal"
  ADD COLUMN "contactEmailHash" TEXT,
  ADD COLUMN "contactEmailMask" TEXT,
  ADD COLUMN "otpSends" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_otpSends_check" CHECK ("otpSends" BETWEEN 0 AND 5);
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_email_code_check" CHECK (
  ("contactEmailHash" IS NULL AND "contactEmailMask" IS NULL) OR (
    "consentDelivery" = 'email-code-v1' AND
    "contactEmailHash" ~ '^[a-f0-9]{64}$' AND "contactEmailMask" ~ '^[a-z0-9]\*\*\*@example\.test$' AND
    "otpHash" ~ '^[a-f0-9]{64}$' AND "otpExpiresAt" IS NOT NULL AND "otpLastSentAt" IS NOT NULL));

ALTER TABLE "AgentProposal" DROP CONSTRAINT "AgentProposal_consentDelivery_check";
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_consentDelivery_check" CHECK (
  "consentDelivery" IS NULL OR (
    NOT "smsOtpRequired" AND (
      ("consentDelivery" IN ('separate-lab-v1', 'email-code-v1') AND "businessId" NOT LIKE 'sandbox-%') OR
      ("consentDelivery" = 'sandbox-demo-phone-v1' AND "businessId" LIKE 'sandbox-%')
    )
  )
);
ALTER TABLE "AgentMandate" DROP CONSTRAINT "AgentMandate_verifiedVia_check";
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_verifiedVia_check" CHECK (
  "verifiedVia" IS NULL OR (
    "origin" = 'customer-consent' AND (
      ("verifiedVia" IN ('sms-otp', 'separate-lab-v1', 'email-code-v1') AND "businessId" NOT LIKE 'sandbox-%') OR
      ("verifiedVia" = 'sandbox-demo-phone-v1' AND "businessId" LIKE 'sandbox-%')
    )
  )
);
COMMIT;
