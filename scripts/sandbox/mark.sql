-- Apply only to a newly created, dedicated database before prisma migrate deploy.
-- psql -v ON_ERROR_STOP=1 -v installation_id=<uuid> -f scripts/sandbox/mark.sql
BEGIN;
SELECT pg_advisory_xact_lock(64119332);
DO $sandbox$
BEGIN
  IF current_database() IN ('postgres', 'template0', 'template1') OR EXISTS (
    SELECT 1 FROM pg_namespace
    WHERE nspname NOT IN ('public', 'information_schema', 'pg_catalog')
      AND nspname !~ '^pg_(toast|temp)'
  ) OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  ) OR EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ) THEN
    RAISE EXCEPTION 'SANDBOX_REQUIRES_A_FRESH_DATABASE';
  END IF;
END;
$sandbox$;
CREATE SCHEMA cresavo_sandbox;
CREATE TABLE cresavo_sandbox.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  id uuid NOT NULL UNIQUE,
  revision integer NOT NULL CHECK (revision = 1)
);
CREATE TABLE cresavo_sandbox.generation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  generation integer NOT NULL DEFAULT 1 CHECK (generation > 0),
  reset_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO cresavo_sandbox.installation (id, revision) VALUES (:'installation_id', 1);
INSERT INTO cresavo_sandbox.generation DEFAULT VALUES;
COMMIT;
