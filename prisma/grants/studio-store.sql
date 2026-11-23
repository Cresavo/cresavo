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

-- The functions of migration store_rls_policies the web app calls: the outbox
-- functions (store_outbox_*), from its drain after a commit in its tenant's
-- scope, and the booking address lookup (store_salon_by_slug). The
-- migration creates every store function closed to PUBLIC; the revokes are
-- repeated here so a restore from a dump taken with --no-privileges
-- (docs/operations/BACKUP_RESTORE.md), which recreates the functions open to
-- PUBLIC, closes them again. roles.sql grants the poller and the sweeper theirs.
REVOKE ALL ON FUNCTION store_caller_owns(), store_caller_in(text), store_outbox_caller(text), store_effective_now(timestamptz),
  store_clock(timestamptz), store_bounded_ms(float8), store_sweep_check(integer), store_redact_path(jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_outbox_cancel_erased(timestamptz, text[]),
  store_outbox_claim(timestamptz, float8, float8, text[], text[], boolean),
  store_outbox_fail(text, uuid, timestamptz, timestamptz, boolean, boolean, boolean, text, boolean, boolean),
  store_outbox_skip(text, uuid), store_outbox_delivered(text, uuid, boolean), store_outbox_note(text, uuid, text, boolean, boolean),
  store_outbox_release(text, uuid, boolean), store_outbox_open(text),
  store_outbox_freeze(text, uuid, float8, text, text, text, text, text, text, float8),
  store_outbox_dispatch(text, uuid, text, text, float8), store_outbox_message_view(text, uuid, boolean), store_salon_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_sweep_idempotency(timestamptz, integer), store_sweep_demo_actions(timestamptz, integer),
  store_sweep_sandboxes(timestamptz, integer), store_sweep_outbox_bodies(timestamptz, integer),
  store_sweep_activity_keys(timestamptz, integer), store_sweep_activity_redact(timestamptz, integer),
  store_sweep_journal_views(timestamptz, integer), store_sweep_rate_limits(timestamptz, integer),
  store_sweep_owner_guard(timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION store_journal_redact_audit(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_outbox_cancel_erased(timestamptz, text[]),
  store_outbox_claim(timestamptz, float8, float8, text[], text[], boolean),
  store_outbox_fail(text, uuid, timestamptz, timestamptz, boolean, boolean, boolean, text, boolean, boolean),
  store_outbox_skip(text, uuid), store_outbox_delivered(text, uuid, boolean), store_outbox_note(text, uuid, text, boolean, boolean),
  store_outbox_release(text, uuid, boolean), store_outbox_open(text),
  store_outbox_freeze(text, uuid, float8, text, text, text, text, text, text, float8),
  store_outbox_dispatch(text, uuid, text, text, float8), store_outbox_message_view(text, uuid, boolean),
  store_salon_by_slug(text)
  TO cresavo_app;
-- Server-side journals (migration server_journals): the journal text of the tenant's own audit rows from before its
-- journals moved, removed while they move, in its own scope only.
GRANT EXECUTE ON FUNCTION store_journal_redact_audit(text, jsonb) TO cresavo_app;

-- Erasure (item 7): the only path that may change tenant_action is the
-- SECURITY DEFINER function erase_subject(tenant, customerId), owned by a
-- separate NOLOGIN role. Run prisma/grants/erase-subject.sql next: it grants
-- that role its columns, creates the function without PUBLIC access and grants
-- EXECUTE to the application role only. The store then needs
-- `erasure: "function"`, since this role cannot UPDATE tenant_action.

-- Finally verify the effective privileges, including inherited ones:
--   psql "$DATABASE_URL" -v app_role=cresavo_app -f prisma/grants/verify-studio-store.sql
-- It must return no rows. Grants to a parent role of cresavo_app are not
-- revoked by this script; the verify query reports them.
