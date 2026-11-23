-- The SMS consent lab now accepts only the PTS fictional mobile series +46701740605 to +46701740699,
-- masked as '+46701740***'. Rows from before keep the old lab mask, so both stay valid.
ALTER TABLE "AgentProposal" DROP CONSTRAINT "AgentProposal_sms_snapshot_check";
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_sms_snapshot_check" CHECK (
 NOT "smsOtpRequired" OR (
 "phoneHash" ~ '^[a-f0-9]{64}$' AND "phoneHash" IS NOT NULL AND
 "phoneMask" IN ('+46701740***', '+46700*****') AND "phoneMask" IS NOT NULL AND
 "otpHash" ~ '^[a-f0-9]{64}$' AND "otpHash" IS NOT NULL AND
 "otpExpiresAt" IS NOT NULL AND "otpLastSentAt" IS NOT NULL));
