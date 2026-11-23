-- Two-step sign-in (TOTP with recovery codes) for owner accounts. Additive only:
-- nullable columns and a new table, so existing accounts keep signing in with a
-- password alone. Run prisma/grants/roles.sql afterwards for the new table.
ALTER TABLE "owner_account"
    ADD COLUMN "totp_secret_enc" TEXT,
    ADD COLUMN "totp_pending_enc" TEXT,
    ADD COLUMN "totp_pending_expires_at" TIMESTAMPTZ(3),
    ADD COLUMN "totp_enabled_at" TIMESTAMPTZ(3),
    ADD COLUMN "totp_last_step" BIGINT;

CREATE TABLE "owner_recovery_code" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMPTZ(3),

    CONSTRAINT "owner_recovery_code_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "owner_recovery_code_account_id_idx" ON "owner_recovery_code"("account_id");

ALTER TABLE "owner_recovery_code" ADD CONSTRAINT "owner_recovery_code_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "owner_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A session records that its sign-in passed the second step. A session of an
-- account with two-step sign-in is refused without it, so a password-only
-- session (for example from an older worker during a deploy) never counts.
ALTER TABLE "owner_session" ADD COLUMN "mfa_verified_at" TIMESTAMPTZ(3);

-- Outstanding password challenges: one row per correct password that still
-- needs the second step, keyed by the SHA-256 of the cookie's nonce. Opening
-- the session deletes it in the same transaction, so a challenge works once;
-- "sign out everywhere" and password resets delete them all.
CREATE TABLE "owner_mfa_challenge" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "credential_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "owner_mfa_challenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "owner_mfa_challenge_account_id_idx" ON "owner_mfa_challenge"("account_id");
CREATE INDEX "owner_mfa_challenge_expires_at_idx" ON "owner_mfa_challenge"("expires_at");

ALTER TABLE "owner_mfa_challenge" ADD CONSTRAINT "owner_mfa_challenge_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "owner_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
