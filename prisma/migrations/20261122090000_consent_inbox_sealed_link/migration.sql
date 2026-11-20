-- The staging inbox stores the approval link sealed (docs/CUSTOMER_CONSENT_CHANNEL.md).
-- A plaintext link in this table reaches PostgreSQL's server log on any error with the
-- default settings (log_min_error_statement = error logs the failing statement's DETAIL,
-- for example "Failing row contains (...)") and in bind values when statement logging is
-- on. The salon now writes only an AES-256-GCM sealed value whose key the database never
-- sees, so neither bind values, rows nor error details can carry the secret.
BEGIN;
-- Earlier staging links (fictional recipient only) are removed, not converted: they are the
-- exposure this migration ends. Their proposals can no longer be approved.
DELETE FROM "ConsentInboxMessage";
ALTER TABLE "ConsentInboxMessage" DROP CONSTRAINT "ConsentInboxMessage_link_check";
ALTER TABLE "ConsentInboxMessage" RENAME COLUMN "approvalLink" TO "sealedLink";
-- Version, 96-bit IV and ciphertext with its tag, each base64url. No link-shaped value fits.
-- (The length is checked apart: PostgreSQL regex repetition counts stop at 255.)
ALTER TABLE "ConsentInboxMessage" ADD CONSTRAINT "ConsentInboxMessage_sealed_check"
  CHECK ("sealedLink" ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$' AND length("sealedLink") BETWEEN 80 AND 620);
COMMIT;
