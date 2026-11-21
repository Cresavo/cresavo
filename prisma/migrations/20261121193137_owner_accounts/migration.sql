-- Owner accounts for real salons. Each account owns one tenant_state row.
CREATE TABLE "owner_account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "credential_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "owner_session" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "credential_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "owner_session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "owner_account_email_key" ON "owner_account"("email");
CREATE UNIQUE INDEX "owner_account_tenant_id_key" ON "owner_account"("tenant_id");
CREATE INDEX "owner_session_account_id_idx" ON "owner_session"("account_id");
CREATE INDEX "owner_session_expires_at_idx" ON "owner_session"("expires_at");

ALTER TABLE "owner_session" ADD CONSTRAINT "owner_session_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "owner_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
