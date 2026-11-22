-- The business's own photos and its logo. Additive only: one new table. The
-- bytes are in `bytes` for the default Postgres store, or in an S3-compatible
-- bucket under `storage_key` (MEDIA_STORE=s3). Run prisma/grants/roles.sql
-- afterwards for the grants of the new table.
CREATE TABLE "media_asset" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "bytes" BYTEA,
    "alt_text" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_asset_kind_check" CHECK ("kind" IN ('photo', 'logo')),
    CONSTRAINT "media_asset_content_type_check" CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "media_asset_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 8388608 AND "width" > 0 AND "height" > 0),
    CONSTRAINT "media_asset_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "media_asset_alt_text_check" CHECK ("alt_text" IS NULL OR char_length("alt_text") <= 300),
    -- The Postgres store keeps the bytes in the row; the S3 store keeps none there.
    CONSTRAINT "media_asset_storage_check" CHECK (
        ("storage" = 'postgres' AND "bytes" IS NOT NULL) OR ("storage" = 's3' AND "bytes" IS NULL))
);

CREATE INDEX "media_asset_tenant_id_kind_created_at_idx" ON "media_asset"("tenant_id", "kind", "created_at");

-- At most one active logo per business.
CREATE UNIQUE INDEX "media_asset_one_logo_idx" ON "media_asset"("tenant_id") WHERE "kind" = 'logo' AND "deleted_at" IS NULL;

-- The same picture is stored once per business and kind while it is active.
CREATE UNIQUE INDEX "media_asset_dedupe_idx" ON "media_asset"("tenant_id", "kind", "sha256") WHERE "deleted_at" IS NULL;

-- The media sweep finds deleted rows by age.
CREATE INDEX "media_asset_deleted_at_idx" ON "media_asset"("deleted_at") WHERE "deleted_at" IS NOT NULL;
