-- Reports row-level security on the four studio store tables. Read only; run
-- as any role that can read the catalogs:
--
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql
--
-- First result: one row per table with whether RLS is enabled and forced, and
-- the policies that are missing, unexpected (any other policy on the table,
-- permissive or restrictive) or changed (command, roles or predicates differ
-- from migration store_rls_policies, by the digests rls-enable.sql checks).
-- After rls-enable.sql every row must say enabled = t, forced = t and three
-- empty lists. After the migration alone (or rls-disable.sql) enabled and
-- forced are f: the policies are prepared but not enforced.
--
-- Second result: problems, one per row; no rows means none. For every login
-- that belongs to one of the runtime group roles, and for the definer of
-- erase_subject: a role it can SET ROLE to (MEMBER, with or without INHERIT)
-- that owns a store table, is superuser or bypasses row-level security. Any
-- of these would see every row however the policies read.
WITH expected(tbl, policy, digest) AS (VALUES
  ('tenant_action', 'store_owner', 'e9faebba0398f4bf24a080070171835a'),
  ('tenant_action', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_action', 'store_sweep_delete', '3fc6296f342fd22ca9ec2729bdcc5dcd'),
  ('tenant_action', 'store_sweep_read', '313d2a5e9ecb91bbb51ae1b01c445536'),
  ('tenant_action', 'store_sweep_update', '04281d4e254714828fd3509e67d2cdbe'),
  ('tenant_action', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
  ('tenant_effect', 'store_outbox_read', 'd36a751db5c124849300a81494527a2a'),
  ('tenant_effect', 'store_outbox_update', '254883bc81995a55b29dd49018a72aa3'),
  ('tenant_effect', 'store_owner', '7b48fbc8c2f0c46f67befa959f7e9a53'),
  ('tenant_effect', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_effect', 'store_sweep_delete', '31f2f4452b9eb10acce43e08515c4035'),
  ('tenant_effect', 'store_sweep_read', 'e9ffbe3644b4d9686af2e87d0efbf9e2'),
  ('tenant_effect', 'store_sweep_update', 'cba059844d66162846104d7f90daa66b'),
  ('tenant_effect', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
  ('tenant_idempotency', 'store_owner', 'ba91ae228026bd121c6b7d4c27d1d904'),
  ('tenant_idempotency', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_idempotency', 'store_sweep_delete', '36956963702d4c79ea73079ea7611063'),
  ('tenant_idempotency', 'store_sweep_lock', 'e23e492c2c674ab76d21e594cc08e831'),
  ('tenant_idempotency', 'store_sweep_read', 'aa730b849ab81f232bf23c905a16597b'),
  ('tenant_idempotency', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
  ('tenant_state', 'store_outbox_lock', '72c76bfc1d459da30466a4978735432c'),
  ('tenant_state', 'store_outbox_read', 'd36a751db5c124849300a81494527a2a'),
  ('tenant_state', 'store_owner', '03899db0eb95846adb21ec3cfbb63e0e'),
  ('tenant_state', 'store_salon_slug_lookup', '75bb90c499297a854b9b948966bad46a'),
  ('tenant_state', 'store_sandbox_lookup', 'ebcc6e29a0b9b581e6ac00c0fe4c1b22'),
  ('tenant_state', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_state', 'store_sweep_delete', '0e2816121f25d90cfd7281c4541b78ca'),
  ('tenant_state', 'store_sweep_lock', '6d320363ca1bb32d97a77f7f1401dc1b'),
  ('tenant_state', 'store_sweep_read', '463fa3fc8bf47a14a4eb60838cbe1ab3'),
  ('tenant_state', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d')
),
actual AS (
  SELECT p.tablename AS tbl, p.policyname AS policy, md5(p.cmd || '|' || p.permissive || '|' || array_to_string(p.roles, ',') || '|' || coalesce(p.qual, '') || '|' || coalesce(p.with_check, '')) AS digest
  FROM pg_policies p
  WHERE p.schemaname = current_schema() AND p.tablename IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect')
)
SELECT c.relname AS "table",
  c.relrowsecurity AS enabled,
  c.relforcerowsecurity AS forced,
  coalesce((SELECT string_agg(e.policy, ', ' ORDER BY e.policy) FROM expected e
    WHERE e.tbl = c.relname AND NOT EXISTS (SELECT 1 FROM actual a WHERE a.tbl = e.tbl AND a.policy = e.policy)), '') AS missing,
  coalesce((SELECT string_agg(a.policy, ', ' ORDER BY a.policy) FROM actual a
    WHERE a.tbl = c.relname AND NOT EXISTS (SELECT 1 FROM expected e WHERE e.tbl = a.tbl AND e.policy = a.policy)), '') AS unexpected,
  coalesce((SELECT string_agg(a.policy, ', ' ORDER BY a.policy) FROM actual a JOIN expected e ON e.tbl = a.tbl AND e.policy = a.policy
    WHERE a.tbl = c.relname AND a.digest <> e.digest), '') AS changed
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = current_schema() AND c.relname IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect')
ORDER BY c.relname;

WITH store AS (
  SELECT c.relname, c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema() AND c.relname IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect')
),
runtime AS (
  SELECT DISTINCT m.rolname AS login, 'login ' || m.rolname AS who
  FROM pg_auth_members am JOIN pg_roles g ON g.oid = am.roleid JOIN pg_roles m ON m.oid = am.member
  WHERE g.rolname IN ('cresavo_app', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox') AND m.rolcanlogin
  UNION
  SELECT o.rolname, 'erase_subject definer ' || o.rolname
  FROM pg_proc f JOIN pg_namespace fn ON fn.oid = f.pronamespace JOIN pg_roles o ON o.oid = f.proowner
  WHERE fn.nspname = current_schema() AND f.proname = 'erase_subject'
)
SELECT DISTINCT x.who || ' can become ' || r.rolname || ', which is superuser or bypasses row-level security' AS problem
FROM runtime x JOIN pg_roles r ON pg_has_role(x.login, r.oid, 'MEMBER')
WHERE r.rolsuper OR r.rolbypassrls
UNION ALL
SELECT DISTINCT x.who || ' owns or can become the owner of ' || s.relname
FROM runtime x, store s WHERE pg_has_role(x.login, s.relowner, 'MEMBER')
ORDER BY 1;
