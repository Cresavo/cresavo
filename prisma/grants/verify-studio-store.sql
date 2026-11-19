-- Verifies the effective privileges of the studio store's application role.
-- Run it after studio-store.sql, as any role that can read the catalogs:
--
--   psql "$DATABASE_URL" -v app_role=cresavo_app -f prisma/grants/verify-studio-store.sql
--
-- Every row is a problem; no rows means the role can only read and append to
-- the audit log. has_table_privilege follows role membership with INHERIT, so
-- privileges granted to a parent role, to PUBLIC or through default privileges
-- are caught as well; ownership (direct or through a role the app may become)
-- and superuser/BYPASSRLS are checked separately because they override grants.
WITH target AS (SELECT :'app_role'::text AS role),
privileges AS (
  SELECT unnest(ARRAY['UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS privilege
)
SELECT 'can ' || p.privilege || ' tenant_action' AS problem
FROM target t, privileges p
WHERE has_table_privilege(t.role, 'tenant_action', p.privilege)
UNION ALL
SELECT 'owns tenant_action'
FROM target t, pg_tables c
WHERE c.schemaname = current_schema() AND c.tablename = 'tenant_action' AND pg_has_role(t.role, c.tableowner, 'USAGE')
UNION ALL
SELECT 'cannot ' || p.privilege || ' tenant_action'
FROM target t, (VALUES ('SELECT'), ('INSERT')) AS p(privilege)
WHERE NOT has_table_privilege(t.role, 'tenant_action', p.privilege)
UNION ALL
SELECT 'is superuser or bypasses row security'
FROM target t JOIN pg_roles r ON r.rolname = t.role
WHERE r.rolsuper OR r.rolbypassrls
UNION ALL
SELECT 'owns schema ' || n.nspname
FROM target t, pg_namespace n
WHERE n.nspname = current_schema() AND pg_has_role(t.role, n.nspowner, 'USAGE');
