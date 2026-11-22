-- Least-privilege Postgres roles for a Cresavo installation (pilot operations
-- groundwork, docs/QUALITY_SECURITY.md "Operations"). Documentation for
-- operators, NOT a migration: `prisma migrate deploy` runs as the schema owner
-- and the repository's migrations do not create roles. Safe to run again.
--
-- Order, once per environment, as a role that may create roles and grant on the
-- tables (not the application's own role):
--   1. npx prisma migrate deploy                     (as the schema owner)
--   2. psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/roles.sql
--   3. psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/studio-store.sql
--   4. psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v eraser_role=cresavo_eraser -v app_role=cresavo_app \
--        -f prisma/grants/erase-subject.sql
--   4b. psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/roles.sql   (again: grants EXECUTE on erase_subject to the sweeper)
--   5. psql "$ADMIN_DATABASE_URL" -v app_role=cresavo_app -f prisma/grants/verify-studio-store.sql   (no rows)
-- After a new migration adds a table, run this file again (and step 3 if the
-- application's store grants were touched). studio-store.sql owns the
-- application's grants on the four store tables; this file does not touch them.
--
-- NO PASSWORDS HERE. The four roles below are NOLOGIN group roles. The operator
-- creates one login per use out of band, with a password from the secret store,
-- and makes it a member of the group role (psql prompts; never put the password
-- on a command line, in Git or in a log):
--
--   CREATE ROLE cresavo_app_login   LOGIN PASSWORD '<from the secret store>' IN ROLE cresavo_app;
--   CREATE ROLE cresavo_sweeper_login LOGIN PASSWORD '<from the secret store>' IN ROLE cresavo_sweeper;
--   CREATE ROLE cresavo_support_login LOGIN PASSWORD '<from the secret store>' IN ROLE cresavo_support;
--
-- DATABASE_URL of the web app uses cresavo_app_login; the cron job of
-- `npm run store:sweep` uses cresavo_sweeper_login; support staff use
-- cresavo_support_login (time-limited: drop or VALID UNTIL it when done).
-- cresavo_eraser never logs in; it owns erase_subject (erase-subject.sql).
-- Migrations keep running as the schema owner, never as one of these roles.
--
-- Every grant below is derived from the queries in the code; the comment above
-- each block names the code. tests/ops-roles.test.ts checks that the tables and
-- columns the sweepers touch are granted to the sweep role.

-- statement
DO $roles$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['cresavo_app', 'cresavo_eraser', 'cresavo_sweeper', 'cresavo_support'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
    -- Re-asserted on every run; LOGIN is deliberately left alone.
    EXECUTE format('ALTER ROLE %I NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', r);
  END LOOP;
END
$roles$;

-- statement
DO $connect$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['cresavo_app', 'cresavo_sweeper', 'cresavo_support'] LOOP
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), r);
  END LOOP;
END
$connect$;

-- statement
-- Nobody but the schema owner creates objects (PostgreSQL before 15 lets PUBLIC).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- statement
REVOKE CREATE ON SCHEMA public FROM cresavo_app, cresavo_eraser, cresavo_sweeper, cresavo_support;
-- statement
GRANT USAGE ON SCHEMA public TO cresavo_app, cresavo_eraser, cresavo_sweeper, cresavo_support;

-- ---------------------------------------------------------------------------
-- cresavo_app: the web application at runtime (src/lib/db.ts,
-- src/lib/postgres-rate-limit.ts, the owner store).
-- ---------------------------------------------------------------------------
-- The four store tables (tenant_state, tenant_action, tenant_idempotency,
-- tenant_effect) are granted by studio-store.sql and erase-subject.sql: the
-- audit log is append-only for this role. Everything else below is the legacy
-- engine (src/lib/domain.ts), the agent API, pairing, owner accounts and the
-- shared rate-limit table. The Sandbox* tables belong to the separate sandbox
-- database (docs/DEPLOY_SANDBOX.md) and are not granted here.
-- statement
REVOKE ALL ON
  "Service", "Booking", "Customer", "Staff", "CustomerDataAction", "BookingEvent", "WorkspaceRequest",
  "CardBookingAttempt", "Campaign", "CapacityDecision", "AdminSession", "AdminUser", "RateLimitBucket",
  "AgentApiKey", "AgentBooking", "AgentClient", "AgentMandate", "AgentApiEvent", "AgentProposal",
  "AgentAuditEvent", "PartnerBookingAttempt", "PairWorkspace", "PairClient", "PairCode", "PairToken",
  "PairProposal", "PairBudget", "PairGrant", "PairGrantToken", "owner_account", "owner_session"
  FROM cresavo_app;
-- statement
GRANT SELECT, INSERT, UPDATE ON
  "Service", "Booking", "Customer", "Staff", "CustomerDataAction", "BookingEvent", "WorkspaceRequest",
  "CardBookingAttempt", "Campaign", "CapacityDecision", "AdminSession", "AdminUser", "RateLimitBucket",
  "AgentApiKey", "AgentBooking", "AgentClient", "AgentMandate", "AgentApiEvent", "AgentProposal",
  "AgentAuditEvent", "PartnerBookingAttempt", "PairWorkspace", "PairClient", "PairCode", "PairToken",
  "PairProposal", "PairBudget", "PairGrant", "PairGrantToken", "owner_account", "owner_session"
  TO cresavo_app;
-- DELETE only where the code deletes (grep deleteMany / .delete( in src):
-- rate-limit and owner-guard rows (postgres-rate-limit.ts, owner-guard-store.ts), expired admin and owner
-- sessions (auth.ts, owner-session.ts), a failed partner attempt (partner-bookings.ts) and the pairing
-- tables (src/concept/pairing/*).
-- statement
GRANT DELETE ON
  "RateLimitBucket", "AdminSession", "owner_session", "PartnerBookingAttempt",
  "PairWorkspace", "PairClient", "PairCode", "PairBudget", "PairGrantToken"
  TO cresavo_app;
-- Migration history is the schema owner's.
-- statement
REVOKE ALL ON "_prisma_migrations" FROM PUBLIC, cresavo_app;

-- ---------------------------------------------------------------------------
-- cresavo_sweeper: `npm run store:sweep` (scripts/sweep-store.mts, the four
-- sweepers in src/concept/store/store-sweepers.ts). Column-level grants: it can
-- see keys, timestamps and tenant kinds, never a salon document, an action
-- payload or an effect payload.
-- ---------------------------------------------------------------------------
-- No sweeper redacts rows. Redaction of personal data is erase_subject() (below)
-- and `customer/erase`, called by the application. The sweeper deletes.
-- statement
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cresavo_sweeper;
-- sweepExpiredSandboxes: SELECT tenant_id FROM tenant_state WHERE kind, expires_at ... FOR UPDATE SKIP LOCKED;
-- then DELETE ... WHERE tenant_id = ANY(...) on the four store tables. FOR UPDATE needs UPDATE on at least one
-- column; the least meaningful column of each table is used and nothing else is updatable.
-- sweepDemoActions: tenant_action a JOIN tenant_state s USING (tenant_id) WHERE s.kind, a.at ... FOR UPDATE OF a.
-- sweepExpiredIdempotency: tenant_idempotency WHERE expires_at ... ORDER BY expires_at, tenant_id, key FOR UPDATE.
-- statement
GRANT SELECT ("tenant_id", "kind", "expires_at"), UPDATE ("updated_at"), DELETE ON "tenant_state" TO cresavo_sweeper;
-- statement
GRANT SELECT ("tenant_id", "seq", "at"), UPDATE ("redacted_at"), DELETE ON "tenant_action" TO cresavo_sweeper;
-- statement
GRANT SELECT ("tenant_id", "key", "expires_at"), UPDATE ("expires_at"), DELETE ON "tenant_idempotency" TO cresavo_sweeper;
-- statement
GRANT SELECT ("tenant_id"), DELETE ON "tenant_effect" TO cresavo_sweeper;
-- sweepOwnerGuardBuckets: DELETE FROM "RateLimitBucket" WHERE "key" IN (SELECT "key" ... WHERE "expiresAt" ...).
-- statement
GRANT SELECT ("key", "expiresAt"), DELETE ON "RateLimitBucket" TO cresavo_sweeper;
-- erase_subject(tenant, customer) is the only way to redact retained audit rows. No sweeper calls it today; the
-- sweep role may, for the salon trash sweeper that STUDIO_STORE.md ("Erasure") says is still needed. The function
-- exists only after erase-subject.sql, so this block grants when it can: run this file again after step 4.
-- It reads the tenant document under the caller's row lock, hence the UPDATE ("updated_at") above.
-- statement
DO $erase$
BEGIN
  IF to_regprocedure('public.erase_subject(text, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION erase_subject(text, text) TO cresavo_sweeper;
  END IF;
END
$erase$;
-- The sweep client's connect check (scripts/database.mjs assertDatabaseMode) reads only the catalog.

-- ---------------------------------------------------------------------------
-- cresavo_support: read-only diagnostics. No salon document (journal entries may
-- be health data), no action or effect payloads, no customer tables, no password
-- hashes or session ids. Widening this needs a decision (docs/QUALITY_SECURITY.md,
-- "Roles and permissions": support with time-limited access).
-- ---------------------------------------------------------------------------
-- statement
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cresavo_support;
-- statement
GRANT SELECT ("tenant_id", "kind", "version", "expires_at", "updated_at") ON "tenant_state" TO cresavo_support;
-- statement
GRANT SELECT ("tenant_id", "seq", "actor", "source", "at", "resulting_version", "redacted_at") ON "tenant_action" TO cresavo_support;
-- statement
GRANT SELECT ("tenant_id", "seq", "expires_at") ON "tenant_idempotency" TO cresavo_support;
-- Outbox state: enough to see a stuck or uncertain message (docs/operations/INCIDENT_RUNBOOK.md), not its content.
-- statement
GRANT SELECT ("tenant_id", "seq", "n", "id", "kind", "status", "attempts", "next_attempt_at", "delivered_at",
              "leased_until", "erased_at") ON "tenant_effect" TO cresavo_support;
-- statement
GRANT SELECT ("id", "tenant_id", "active", "credential_version", "created_at") ON "owner_account" TO cresavo_support;
-- statement
GRANT SELECT ("account_id", "credential_version", "created_at", "expires_at", "revoked_at") ON "owner_session" TO cresavo_support;
-- statement
GRANT SELECT ("expiresAt", "count") ON "RateLimitBucket" TO cresavo_support;
-- statement
GRANT SELECT ON "_prisma_migrations" TO cresavo_support;
