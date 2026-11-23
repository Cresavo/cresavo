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
-- Second result: problems, one per row; no rows means none. The runtime logins
-- are found, not named: every login that reaches one of the runtime group roles
-- through memberships that grant INHERIT or SET, directly or through other
-- roles (an ADMIN-only grant, such as the one a CREATEROLE creator receives,
-- does not make a runtime login). For each, and for the definer of
-- erase_subject: no superuser, createrole, replication or BYPASSRLS attribute;
-- no SET ROLE to such a role or to a store table's owner; no inherited
-- ownership; no ADMIN OPTION on any role. Any of these would see every row
-- however the policies read. verify-roles.sql checks the named logins' grants.
WITH expected(tbl, policy, digest) AS (VALUES
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
  ('tenant_state', 'store_salon_slug_lookup', '75bb90c499297a854b9b948966bad46a'),
  ('tenant_state', 'store_sandbox_lookup', 'ebcc6e29a0b9b581e6ac00c0fe4c1b22'),
  ('tenant_state', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
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

WITH RECURSIVE groups AS (
  SELECT oid FROM pg_roles WHERE rolname IN ('cresavo_app', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox')
),
up(member) AS (
  SELECT m.member FROM pg_auth_members m JOIN groups g ON g.oid = m.roleid WHERE m.inherit_option OR m.set_option
  UNION
  SELECT m.member FROM pg_auth_members m JOIN up ON m.roleid = up.member WHERE m.inherit_option OR m.set_option
),
runtime AS (
  SELECT DISTINCT 'login ' || r.rolname AS who, r.rolname AS login FROM up JOIN pg_roles r ON r.oid = up.member WHERE r.rolcanlogin
),
store AS (
  SELECT c.relname, c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema() AND c.relname IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect')
),
definer AS (
  SELECT 'erase_subject definer ' || o.rolname AS who, o.rolname AS login
  FROM pg_proc f JOIN pg_namespace fn ON fn.oid = f.pronamespace JOIN pg_roles o ON o.oid = f.proowner
  WHERE fn.nspname = current_schema() AND f.proname = 'erase_subject'
),
checked AS (SELECT who, login FROM runtime UNION SELECT who, login FROM definer)
SELECT DISTINCT problem FROM (
SELECT x.who || ' is superuser, createrole, replication or bypasses row-level security' AS problem
FROM checked x JOIN pg_roles r ON r.rolname = x.login
WHERE r.rolsuper OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
UNION ALL
-- SET ROLE: what a login can switch to is what it can do (with or without INHERIT).
SELECT x.who || ' can SET ROLE to ' || r.rolname || ', which is superuser, createrole or bypasses row-level security'
FROM checked x JOIN pg_roles l ON l.rolname = x.login JOIN pg_roles r ON r.oid <> l.oid AND NOT l.rolsuper
WHERE pg_has_role(l.oid, r.oid, 'SET') AND (r.rolsuper OR r.rolcreaterole OR r.rolbypassrls)
UNION ALL
SELECT x.who || ' can SET ROLE to the owner of ' || s.relname
FROM checked x JOIN pg_roles l ON l.rolname = x.login, store s
WHERE NOT l.rolsuper AND pg_has_role(l.oid, s.relowner, 'SET')
UNION ALL
-- Inherited ownership: the owner's rights without any SET ROLE.
SELECT x.who || ' inherits the owner of ' || s.relname
FROM checked x JOIN pg_roles l ON l.rolname = x.login, store s
WHERE NOT l.rolsuper AND pg_has_role(l.oid, s.relowner, 'USAGE')
UNION ALL
-- ADMIN: a login that may grant a role may grant it to itself. A creator's automatic admin-only grant is the
-- admin's, not a runtime login's, and an admin is never a runtime login here.
SELECT x.who || ' holds ADMIN OPTION on ' || g.rolname
FROM checked x JOIN pg_roles l ON l.rolname = x.login
JOIN pg_auth_members m ON m.admin_option AND (pg_has_role(l.oid, m.member, 'USAGE') OR pg_has_role(l.oid, m.member, 'SET'))
JOIN pg_roles g ON g.oid = m.roleid
WHERE NOT l.rolsuper
) problems
ORDER BY 1;
