-- Rollback of rls-enable.sql: row-level security off on the four studio store
-- tables. The policies stay (they are the migration's) and have no effect
-- again; isolation rests on the application's tenant_id conditions alone, as
-- before. Run as the owner of the tables:
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/rls-disable.sql
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql

BEGIN;

ALTER TABLE "tenant_state" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_state" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" DISABLE ROW LEVEL SECURITY;

COMMIT;
