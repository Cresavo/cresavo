-- Server-side journals (JOURNALS_ON_SERVER, docs/design/STUDIO_STORE.md
-- "Server-side journals"). Additive only: one new table. Each row is one
-- version of one journal entry, its content encrypted with AES-256-GCM by the
-- application (src/concept/store/journal-crypto.ts); the salon document keeps
-- only a stub naming its versions. Versions are append-only: the application
-- may insert rows and mark them trashed (`deleted_at`), never rewrite one.
-- `replaces` is set only on the scrubbed copy an erasure makes of a version
-- that named the erased customer; the erasure then deletes the version it
-- replaced. Role grants and the row-level security policy are operator steps:
-- run prisma/grants/roles.sql, erase-subject.sql and rls-enable.sql afterwards.
CREATE TABLE "journal_entry" (
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" TEXT NOT NULL DEFAULT 'owner',
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL,
    "replaces" INTEGER,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("tenant_id", "id", "version"),
    -- The ids the studio makes; never a `|`, which separates the parts of the associated data.
    CONSTRAINT "journal_entry_ids_check" CHECK ("tenant_id" ~ '^[A-Za-z0-9_.:-]{1,200}$' AND "customer_id" ~ '^[A-Za-z0-9_.:-]{1,80}$' AND "id" ~ '^[A-Za-z0-9_.:-]{1,80}$'),
    CONSTRAINT "journal_entry_version_check" CHECK ("version" >= 1 AND "key_version" >= 1),
    CONSTRAINT "journal_entry_author_check" CHECK ("author" IN ('owner')),
    -- A 12-byte IV and at least the 16-byte tag; one version is at most 64 KiB of ciphertext.
    CONSTRAINT "journal_entry_crypto_check" CHECK (octet_length("iv") = 12 AND octet_length("ciphertext") BETWEEN 16 AND 65536),
    CONSTRAINT "journal_entry_replaces_check" CHECK ("replaces" IS NULL OR ("replaces" >= 1 AND "replaces" < "version"))
);

-- One customer's entries (the journal route, erasure).
CREATE INDEX "journal_entry_customer_idx" ON "journal_entry" ("tenant_id", "customer_id");
