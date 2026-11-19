-- Intended privileges for the studio store tables (docs/design/STUDIO_STORE.md,
-- "Step 2 decisions", section 3). Documentation for operators, NOT a migration:
-- `prisma migrate deploy` runs as the schema owner and the repository's
-- migrations do not create roles. Run this once per environment as a role that
-- may create roles and grant on the tables, after the studio_store migration.
-- Role names are placeholders; passwords are set out of band, never here.

-- The application role used by PostgresStudioStore at runtime.
-- CREATE ROLE cresavo_app LOGIN;   -- password set by the operator

-- GRANT is additive: first remove whatever the role already has on these
-- tables (direct grants, or ones from operator ALTER DEFAULT PRIVILEGES), and
-- from PUBLIC. The role must not own the tables or the schema, nor be a member
-- of a role that does; ownership overrides every revoke below.
REVOKE ALL ON "tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect" FROM PUBLIC;
REVOKE ALL ON "tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect" FROM cresavo_app;

-- State: read, lock (SELECT ... FOR UPDATE needs UPDATE), write, create tenants.
GRANT SELECT, INSERT, UPDATE ON "tenant_state" TO cresavo_app;
-- Sweeper for expired sandbox tenants (item 9).
GRANT DELETE ON "tenant_state" TO cresavo_app;

-- The audit log is append-only for the application: no UPDATE, no DELETE.
-- Redaction goes through erase_subject(tenant, customerId) only (item 7), a
-- SECURITY DEFINER function owned by a separate role that may update the rows.
GRANT SELECT, INSERT ON "tenant_action" TO cresavo_app;

-- Idempotency: replace expired keys, sweep (item 8), forget on erasure.
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_idempotency" TO cresavo_app;

-- Outbox: insert in the apply transaction, mark delivered, poller retries,
-- backoff and failed (item 4).
GRANT SELECT, INSERT, UPDATE ON "tenant_effect" TO cresavo_app;

-- Erasure (item 7): the only path that may change tenant_action is the
-- SECURITY DEFINER function erase_subject(tenant, customerId), owned by a
-- separate NOLOGIN role. See prisma/grants/erase-subject.sql for the role, its
-- column grants and the function; then:
--   GRANT EXECUTE ON FUNCTION erase_subject(text, text) TO cresavo_app;

-- Finally verify the effective privileges, including inherited ones:
--   psql "$DATABASE_URL" -v app_role=cresavo_app -f prisma/grants/verify-studio-store.sql
-- It must return no rows. Grants to a parent role of cresavo_app are not
-- revoked by this script; the verify query reports them.
