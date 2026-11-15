ALTER TABLE "AgentProposal"
 ADD COLUMN "smsOtpRequired" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "phoneHash" TEXT,
 ADD COLUMN "phoneMask" TEXT,
 ADD COLUMN "otpHash" TEXT,
 ADD COLUMN "otpExpiresAt" TIMESTAMPTZ(3),
 ADD COLUMN "otpAttempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "otpLastSentAt" TIMESTAMPTZ(3),
 ADD COLUMN "otpVerifiedAt" TIMESTAMPTZ(3);
ALTER TABLE "AgentMandate" ADD COLUMN "verifiedVia" TEXT;
ALTER TABLE "AgentMandate" ADD CONSTRAINT "AgentMandate_verifiedVia_check"
 CHECK ("verifiedVia" IS NULL OR ("verifiedVia" = 'sms-otp' AND "origin" = 'customer-consent'));
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_otpAttempts_check" CHECK ("otpAttempts" BETWEEN 0 AND 5);
ALTER TABLE "AgentProposal" ADD CONSTRAINT "AgentProposal_sms_snapshot_check" CHECK (
 NOT "smsOtpRequired" OR (
 "phoneHash" ~ '^[a-f0-9]{64}$' AND "phoneHash" IS NOT NULL AND
 "phoneMask" = '+46700*****' AND "phoneMask" IS NOT NULL AND
 "otpHash" ~ '^[a-f0-9]{64}$' AND "otpHash" IS NOT NULL AND
 "otpExpiresAt" IS NOT NULL AND "otpLastSentAt" IS NOT NULL));
