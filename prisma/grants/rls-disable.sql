-- Rollback of rls-enable.sql: row-level security off on the four studio store
-- tables and journal_entry and its policies dropped, so the tables are as the migrations left
-- them; isolation rests on the application's tenant_id conditions alone, as
-- before. A policy someone added by hand is left for verify-rls.sql to report.
-- Run as the owner of the tables:
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/rls-disable.sql
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql

BEGIN;

LOCK TABLE "tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect", "journal_entry" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "tenant_state" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_state" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_entry" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "journal_entry" DISABLE ROW LEVEL SECURITY;

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

COMMIT;
