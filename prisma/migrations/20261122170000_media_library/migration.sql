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
    "status" TEXT NOT NULL DEFAULT 'ready',
    "bytes" BYTEA,
    "alt_text" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_asset_id_check" CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
    CONSTRAINT "media_asset_tenant_id_check" CHECK ("tenant_id" ~ '^[A-Za-z0-9_-]{1,100}$'),
    CONSTRAINT "media_asset_kind_check" CHECK ("kind" IN ('photo', 'logo')),
    CONSTRAINT "media_asset_content_type_check" CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT "media_asset_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 8388608 AND "width" > 0 AND "height" > 0),
    CONSTRAINT "media_asset_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "media_asset_alt_text_check" CHECK ("alt_text" IS NULL OR char_length("alt_text") <= 300),
    -- The object key is always derived from the tenant and the row id (src/lib/media-store/index.ts).
    CONSTRAINT "media_asset_storage_key_check" CHECK ("storage_key" = 'media/' || "tenant_id" || '/' || "id"),
    -- `pending` while the bytes are on their way to an object store; the sweep removes one left behind.
    CONSTRAINT "media_asset_status_check" CHECK ("status" IN ('pending', 'ready')),
    -- The Postgres store keeps the bytes in the row and is ready at once; the S3 store keeps none there.
    CONSTRAINT "media_asset_storage_check" CHECK (
        ("storage" = 'postgres' AND "bytes" IS NOT NULL AND "status" = 'ready') OR ("storage" = 's3' AND "bytes" IS NULL)),
    -- Only a logo is published, by saving the booking page that uses it.
    CONSTRAINT "media_asset_published_check" CHECK ("published_at" IS NULL OR ("kind" = 'logo' AND "status" = 'ready'))
);

CREATE INDEX "media_asset_tenant_id_kind_created_at_idx" ON "media_asset"("tenant_id", "kind", "created_at");

-- At most one published logo per business, and at most one uploaded but not yet saved with the page.
CREATE UNIQUE INDEX "media_asset_one_logo_idx" ON "media_asset"("tenant_id") WHERE "kind" = 'logo' AND "deleted_at" IS NULL AND "published_at" IS NOT NULL;
CREATE UNIQUE INDEX "media_asset_one_staged_logo_idx" ON "media_asset"("tenant_id") WHERE "kind" = 'logo' AND "deleted_at" IS NULL AND "published_at" IS NULL;

-- The same picture is stored once per business and kind while it is not deleted.
CREATE UNIQUE INDEX "media_asset_dedupe_idx" ON "media_asset"("tenant_id", "kind", "sha256") WHERE "deleted_at" IS NULL;

-- The media sweep finds deleted rows by age, and pending rows left behind.
CREATE INDEX "media_asset_deleted_at_idx" ON "media_asset"("deleted_at") WHERE "deleted_at" IS NOT NULL;
CREATE INDEX "media_asset_pending_idx" ON "media_asset"("created_at") WHERE "status" = 'pending';
