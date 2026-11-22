-- Reports row-level security on the four studio store tables: one row per
-- table with whether RLS is enabled and forced, the policies it has and the
-- expected policies it lacks. Read only; run as any role that can read the
-- catalogs:
--
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql
--
-- After rls-enable.sql every row must say enabled = t, forced = t and an empty
-- `missing`. After the migration alone (or rls-disable.sql) enabled and forced
-- are f: the policies are prepared but not enforced.
WITH expected(tbl, policy) AS (VALUES
  ('tenant_state', 'store_owner'), ('tenant_state', 'store_tenant'), ('tenant_state', 'store_support_read'),
  ('tenant_state', 'store_outbox_read'), ('tenant_state', 'store_sweep_read'), ('tenant_state', 'store_sweep_lock'),
  ('tenant_state', 'store_sweep_delete'), ('tenant_state', 'store_sandbox_lookup'), ('tenant_state', 'store_salon_slug_lookup'),
  ('tenant_action', 'store_owner'), ('tenant_action', 'store_tenant'), ('tenant_action', 'store_support_read'),
  ('tenant_action', 'store_sweep_read'), ('tenant_action', 'store_sweep_update'), ('tenant_action', 'store_sweep_delete'),
  ('tenant_idempotency', 'store_owner'), ('tenant_idempotency', 'store_tenant'), ('tenant_idempotency', 'store_support_read'),
  ('tenant_idempotency', 'store_sweep_read'), ('tenant_idempotency', 'store_sweep_lock'), ('tenant_idempotency', 'store_sweep_delete'),
  ('tenant_effect', 'store_owner'), ('tenant_effect', 'store_tenant'), ('tenant_effect', 'store_support_read'),
  ('tenant_effect', 'store_outbox_read'), ('tenant_effect', 'store_outbox_update'), ('tenant_effect', 'store_sweep_read'),
  ('tenant_effect', 'store_sweep_update'), ('tenant_effect', 'store_sweep_delete')
)
SELECT c.relname AS "table",
  c.relrowsecurity AS enabled,
  c.relforcerowsecurity AS forced,
  coalesce((SELECT string_agg(p.policyname, ', ' ORDER BY p.policyname) FROM pg_policies p
    WHERE p.schemaname = n.nspname AND p.tablename = c.relname), '') AS policies,
  coalesce((SELECT string_agg(e.policy, ', ' ORDER BY e.policy) FROM expected e
    WHERE e.tbl = c.relname AND NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname AND p.policyname = e.policy)), '') AS missing
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relname IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect')
ORDER BY c.relname;
