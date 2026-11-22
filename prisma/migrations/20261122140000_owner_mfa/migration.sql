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
