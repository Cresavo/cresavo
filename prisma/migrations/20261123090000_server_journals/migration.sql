-- Server-side journals (JOURNALS_ON_SERVER, docs/design/STUDIO_STORE.md
-- "Server-side journals"). Additive only: two new tables, one new column and one function. Each row is one
-- version of one journal entry, its content encrypted with AES-256-GCM by the
-- application (src/concept/store/journal-crypto.ts); the salon document keeps
-- only a stub naming its versions. Versions are append-only: the application
-- may insert rows and mark them trashed (`deleted_at`), never rewrite one.
-- `replaces` is set only on the scrubbed copy an erasure makes of a version
-- that named the erased customer, by the erasure itself (erase-subject.sql:
-- the application may not write the column), which deletes the replaced
-- version in the same step. Role grants and the row-level security policy are operator steps:
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

-- Set once a salon's journals live only in journal_entry: the document, the stored replays and the audit log hold
-- no journal text any more (src/concept/store/postgres-studio-store.ts). Cleared again if journal text is written
-- while the flag is off, so the next start moves it again.
ALTER TABLE "tenant_state" ADD COLUMN "journals_sealed_at" TIMESTAMPTZ(3);

-- One known value per key version, encrypted under that key: a key that does not decrypt its own version's
-- verifier is refused before it writes anything (src/concept/store/journal-crypto.ts). No personal data.
CREATE TABLE "journal_key" (
    "key_version" INTEGER NOT NULL,
    "verifier" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_key_pkey" PRIMARY KEY ("key_version"),
    CONSTRAINT "journal_key_check" CHECK ("key_version" >= 1 AND octet_length("iv") = 12 AND octet_length("verifier") BETWEEN 16 AND 256)
);

-- The journal text of one tenant's audit rows from before its journals moved to the server: `journal/add` keeps
-- its entry without the text fields (an entry id only where the original commit recorded one; none is guessed), and
-- `journal/edit` keeps only its id and day. Nothing else in the row and no other action type is touched. The
-- application calls it in its tenant's own scope, under the tenant's row lock, while moving the journals
-- (studio-store.sql grants EXECUTE to cresavo_app); the table owner may always call it.
CREATE FUNCTION store_journal_redact_audit(p_tenant text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
DECLARE
  v_text constant text[] := ARRAY['treatment', 'observations', 'advice', 'nextVisit', 'photos', 'versions'];
  v_count integer;
BEGIN
  IF NOT ((p_tenant = nullif(current_setting('cresavo.tenant_id', true), '')) IS TRUE
      AND (store_caller_owns() OR store_caller_in('cresavo_app'))) THEN
    RAISE EXCEPTION 'store_journal_redact_audit: not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE tenant_action a SET action = CASE a.action ->> 'type'
      WHEN 'journal/add' THEN jsonb_build_object('type', 'journal/add', 'entry', (a.action -> 'entry') - v_text)
      ELSE jsonb_build_object('type', 'journal/edit', 'id', a.action -> 'id', 'on', a.action -> 'on') END
  WHERE a.tenant_id = p_tenant
    AND ((a.action ->> 'type' = 'journal/add' AND jsonb_typeof(a.action -> 'entry') = 'object' AND (a.action -> 'entry') ?| v_text)
      OR (a.action ->> 'type' = 'journal/edit' AND (a.action ? 'content' OR a.action - ARRAY['type', 'id', 'on'] <> '{}'::jsonb)));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

REVOKE ALL ON FUNCTION store_journal_redact_audit(text) FROM PUBLIC;
