-- Turns on row-level security for the four studio store tables and the
-- server-side journal table journal_entry (docs/design/STUDIO_STORE.md,
-- "Row-level security" and "Server-side journals"): the operator step.
-- Documentation for operators, NOT a migration; the migrations name no role and
-- create no policy. Rollback: rls-disable.sql. State: verify-rls.sql.
--
-- Run it as the owner of the tables (only an owner or a superuser may ALTER
-- them), after bootstrap-roles.sql (or roles.sql) and the rest of the order in
-- roles.sql's header, and only once the deployed application sets its scope in
-- every store transaction (src/concept/store/tenant-scope.ts). Safe to run
-- again. One transaction: either all five tables are enforced or none.
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/rls-enable.sql
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql
--
-- In order:
--   1. the five group roles must exist (the policies name them);
--   2. the five tables are locked in ACCESS EXCLUSIVE mode, so nothing can
--      change them or their policies until COMMIT (the step waits for running
--      transactions on them);
--   3. the policies below are created (an earlier copy of each is replaced);
--   4. the exact policy set is checked: every expected policy, no other
--      (permissive or restrictive), each one's command, permissive flag, roles
--      and predicates by a digest of how the server shows them in pg_policies.
--      The digests are PostgreSQL 16's rendering with the default search_path;
--      on another major version the step refuses and names the policies:
--      compare them by hand with the statements here and update the list here
--      and in verify-rls.sql (tests/store-rls-files.test.ts keeps them equal);
--   5. RLS is enabled and forced.
--
-- Scopes (set transaction-local by src/concept/store/tenant-scope.ts):
--   cresavo.tenant_id    one tenant, for cresavo_app and cresavo_eraser (store_tenant);
--                        the only policy besides the owner's on journal_entry: no support read
--   cresavo.sandbox_key  cresavo_app resolving a sandbox token: that row only, read
-- A booking address resolves through the function store_salon_by_slug (a tenant id only), not a policy.
-- cresavo_support reads its diagnostic columns across tenants. The poller
-- (cresavo_outbox) and the sweeper (cresavo_sweeper) have no policy and no
-- table privilege: they use the store_outbox_* and store_sweep_* functions.
--
-- FORCE makes the policies apply to the table owner as well; `store_owner`
-- keeps the owner's full access, so migrations, the admin CLI, operator scripts
-- and the SECURITY DEFINER store functions (owned by it) are unaffected.
-- Superusers and BYPASSRLS roles are never subject to row-level security: no
-- runtime login may be or become one (verify-roles.sql and verify-rls.sql).

BEGIN;

DO $roles$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(r, ', ') INTO missing
  FROM unnest(ARRAY['cresavo_app', 'cresavo_eraser', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox']) r
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'roles % are missing: run prisma/grants/bootstrap-roles.sql (and roles.sql) first', missing;
  END IF;
END
$roles$;

LOCK TABLE "tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect", "journal_entry" IN ACCESS EXCLUSIVE MODE;

DROP POLICY IF EXISTS "store_owner" ON "tenant_state";
DROP POLICY IF EXISTS "store_tenant" ON "tenant_state";
DROP POLICY IF EXISTS "store_support_read" ON "tenant_state";
DROP POLICY IF EXISTS "store_sandbox_lookup" ON "tenant_state";
DROP POLICY IF EXISTS "store_owner" ON "tenant_action";
DROP POLICY IF EXISTS "store_tenant" ON "tenant_action";
DROP POLICY IF EXISTS "store_support_read" ON "tenant_action";
DROP POLICY IF EXISTS "store_owner" ON "tenant_idempotency";
DROP POLICY IF EXISTS "store_tenant" ON "tenant_idempotency";
DROP POLICY IF EXISTS "store_support_read" ON "tenant_idempotency";
DROP POLICY IF EXISTS "store_owner" ON "tenant_effect";
DROP POLICY IF EXISTS "store_tenant" ON "tenant_effect";
DROP POLICY IF EXISTS "store_support_read" ON "tenant_effect";
DROP POLICY IF EXISTS "store_owner" ON "journal_entry";
DROP POLICY IF EXISTS "store_tenant" ON "journal_entry";

CREATE POLICY "store_owner" ON "tenant_state" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_state'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_state'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_state" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
-- Read-only diagnostics across tenants; the column grants of roles.sql keep documents out.
CREATE POLICY "store_support_read" ON "tenant_state" FOR SELECT TO cresavo_support USING (true);
-- A sandbox token resolves to its own tenant only: the key is the full sbx_ + 32-hex hash of the token.
CREATE POLICY "store_sandbox_lookup" ON "tenant_state" FOR SELECT TO cresavo_app
  USING ("kind" = 'sandbox' AND current_setting('cresavo.sandbox_key', true) ~ '^sbx_[0-9a-f]{32}$'
    AND ("tenant_id" = current_setting('cresavo.sandbox_key', true)
      OR starts_with("tenant_id", current_setting('cresavo.sandbox_key', true) || '_')));
CREATE POLICY "store_owner" ON "tenant_action" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_action'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_action'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_action" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_action" FOR SELECT TO cresavo_support USING (true);

CREATE POLICY "store_owner" ON "tenant_idempotency" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_idempotency'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_idempotency'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_idempotency" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_idempotency" FOR SELECT TO cresavo_support USING (true);

CREATE POLICY "store_owner" ON "tenant_effect" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_effect" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_effect" FOR SELECT TO cresavo_support USING (true);

-- Server-side journals: the owner, and the app and the eraser in a tenant's scope. Nobody reads across tenants.
CREATE POLICY "store_owner" ON "journal_entry" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'journal_entry'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'journal_entry'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "journal_entry" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));

DO $check$
DECLARE
  drift text;
BEGIN
  WITH expected(tbl, policy, digest) AS (VALUES
    ('journal_entry', 'store_owner', 'b96a8908fae28d7ec5bb5802493d157c'),
    ('journal_entry', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
    ('tenant_action', 'store_owner', 'e9faebba0398f4bf24a080070171835a'),
    ('tenant_action', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
    ('tenant_action', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
    ('tenant_effect', 'store_owner', '7b48fbc8c2f0c46f67befa959f7e9a53'),
    ('tenant_effect', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
    ('tenant_effect', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
    ('tenant_idempotency', 'store_owner', 'ba91ae228026bd121c6b7d4c27d1d904'),
    ('tenant_idempotency', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
    ('tenant_idempotency', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
    ('tenant_state', 'store_owner', '03899db0eb95846adb21ec3cfbb63e0e'),
    ('tenant_state', 'store_sandbox_lookup', 'ebcc6e29a0b9b581e6ac00c0fe4c1b22'),
    ('tenant_state', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
    ('tenant_state', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d')
  ),
  actual AS (
    SELECT p.tablename AS tbl, p.policyname AS policy, md5(p.cmd || '|' || p.permissive || '|' || array_to_string(p.roles, ',') || '|' || coalesce(p.qual, '') || '|' || coalesce(p.with_check, '')) AS digest
    FROM pg_policies p
    WHERE p.schemaname = current_schema() AND p.tablename IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect', 'journal_entry')
  )
  SELECT string_agg(coalesce(a.tbl, e.tbl) || '.' || coalesce(a.policy, e.policy) || ' ('
    || CASE WHEN a.policy IS NULL THEN 'missing' WHEN e.policy IS NULL THEN 'unexpected' ELSE 'changed' END || ')', ', ')
  INTO drift
  FROM expected e FULL JOIN actual a ON a.tbl = e.tbl AND a.policy = e.policy
  WHERE a.policy IS NULL OR e.policy IS NULL OR a.digest <> e.digest;
  IF drift IS NOT NULL THEN
    RAISE EXCEPTION 'the store policies are not exactly the expected set: %', drift;
  END IF;
END
$check$;

ALTER TABLE "tenant_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_state" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entry" FORCE ROW LEVEL SECURITY;

COMMIT;
