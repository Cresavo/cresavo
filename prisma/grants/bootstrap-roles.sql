-- Creates the five NOLOGIN group roles of a Cresavo installation. Roles belong
-- to the cluster, not to one database, and migration store_rls_policies names
-- them in its policies and grants, so an ADMIN runs this once per cluster
-- BEFORE the first `prisma migrate deploy`, and on a fresh cluster before a
-- pg_restore (docs/operations/BACKUP_RESTORE.md). The migration credential needs
-- no role privileges. Safe to run again: an existing role is checked, never
-- altered. One transaction.
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/bootstrap-roles.sql
--
-- WHO RUNS IT: a superuser, the managed provider's admin role, or any role
-- with CREATEROLE. It creates no logins and sets no passwords; roles.sql grants
-- the privileges afterwards and documents the logins. The local Docker database
-- runs it on first start (docker-compose.yml).

BEGIN;

DO $roles$
DECLARE
  r text;
  bad text;
BEGIN
  FOREACH r IN ARRAY ARRAY['cresavo_app', 'cresavo_eraser', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', r);
    END IF;
    -- An existing role is checked, not altered: someone made it more powerful than a group role may be.
    SELECT string_agg(attr, ', ') INTO bad FROM pg_roles p,
      LATERAL (VALUES ('LOGIN', p.rolcanlogin), ('SUPERUSER', p.rolsuper), ('CREATEROLE', p.rolcreaterole),
                      ('CREATEDB', p.rolcreatedb), ('REPLICATION', p.rolreplication), ('BYPASSRLS', p.rolbypassrls)) AS a(attr, on_)
    WHERE p.rolname = r AND a.on_;
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'role % must be a plain NOLOGIN group role but has: %', r, bad;
    END IF;
  END LOOP;
END
$roles$;

COMMIT;
