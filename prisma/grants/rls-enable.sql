-- Turns on row-level security for the four studio store tables: the operator
-- step that enforces the policies of migration 20261122160000_store_rls_policies
-- (docs/design/STUDIO_STORE.md, "Row-level security"). Documentation for
-- operators, NOT a migration. Rollback: rls-disable.sql. State: verify-rls.sql.
--
-- Run it as the owner of the tables (only an owner or a superuser may ALTER
-- them), after the order in roles.sql's header, and only once the deployed
-- application sets its scope in every store transaction (src/concept/store/
-- tenant-scope.ts). One transaction: either all four tables are enforced or none.
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/rls-enable.sql
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql
--
-- FORCE makes the policies apply to the table owner as well; the migration's
-- `store_owner` policy keeps the owner's full access, so migrations, the admin
-- CLI and operator scripts are unaffected. Superusers and BYPASSRLS roles are
-- never subject to row-level security: the application's login must be neither
-- (verify-roles.sql checks that).

BEGIN;

DO $check$
DECLARE
  t text;
  missing text;
BEGIN
  -- Without its policies a table would refuse every row to the application: stop instead.
  FOREACH t IN ARRAY ARRAY['tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect'] LOOP
    SELECT string_agg(p, ', ') INTO missing FROM unnest(ARRAY['store_owner', 'store_tenant', 'store_support_read']) p
    WHERE NOT EXISTS (SELECT 1 FROM pg_policies x WHERE x.schemaname = current_schema() AND x.tablename = t AND x.policyname = p);
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'table % lacks policies %: run prisma migrate deploy first', t, missing;
    END IF;
  END LOOP;
  -- The cross-tenant scopes name these group roles (roles.sql); without them the poller and sweeps would see nothing.
  SELECT string_agg(r, ', ') INTO missing FROM unnest(ARRAY['cresavo_app', 'cresavo_sweeper', 'cresavo_support']) r
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'roles % are missing: run prisma/grants/roles.sql first', missing;
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

COMMIT;
