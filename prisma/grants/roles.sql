-- Least-privilege Postgres roles for a Cresavo installation (pilot operations
-- groundwork, docs/QUALITY_SECURITY.md "Operations"). Documentation for
-- operators, NOT a migration: `prisma migrate deploy` runs as the schema owner.
-- The one migration that touches roles (store_rls_policies) only creates a
-- missing group role with every attribute off, as below, so its row-level
-- security policies can name it; logins are never created by a migration and
-- this file still checks every group role. Safe to run again; the
-- whole file is one transaction, so a failed run changes nothing and never
-- leaves the live application without grants.
--
-- WHO RUNS IT. Either
--   (a) a superuser or the managed provider's admin role, or
--   (b) the schema owner (the role that ran `prisma migrate deploy` and owns the
--       tables) when it has CREATEROLE. It needs no other attribute: this file
--       creates roles with all privileged attributes off at creation and only
--       checks them afterwards; it never runs ALTER ROLE, which a CREATEROLE
--       role may not do for these attributes.
-- Run it as the owner of the tables, since only an owner (or a superuser) may
-- grant on them. Not as one of the roles created here.
--
-- ORDER, once per environment (and again after a migration adds a table):
--   1. npx prisma migrate deploy                          (schema owner)
--   2. psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/roles.sql
--   3. psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/studio-store.sql
--   4. erase-subject.sql, which moves function ownership to cresavo_eraser. A
--      superuser runs it as in its header. A CREATEROLE schema owner first lends
--      itself the two privileges an ownership transfer needs, and takes them back:
--        psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
--          -c 'GRANT cresavo_eraser TO CURRENT_USER WITH SET TRUE' \
--          -c 'GRANT CREATE ON SCHEMA public TO cresavo_eraser'
--        psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v eraser_role=cresavo_eraser -v app_role=cresavo_app \
--          -f prisma/grants/erase-subject.sql
--        psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 \
--          -c 'REVOKE CREATE ON SCHEMA public FROM cresavo_eraser' \
--          -c 'REVOKE cresavo_eraser FROM CURRENT_USER'
--      (Run the last command even when the second fails.)
--   5. Create the logins (below, one per group role), then check what they can really do:
--        psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-studio-store.sql -v app_role=<app login>
--        psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-roles.sql \
--          -v app_login=<..> -v sweeper_login=<..> -v support_login=<..> -v outbox_login=<..>
--      Both must return no rows.
--   6. Row-level security on the store tables (docs/design/STUDIO_STORE.md,
--      "Row-level security"), once the deployed application sets its scopes,
--      as the table owner:
--        psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/rls-enable.sql
--        psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql
--      Rollback: prisma/grants/rls-disable.sql. The migration has the policies;
--      until this step they have no effect.
--
-- NO PASSWORDS HERE OR IN ANY COMMAND LINE. The five roles below are NOLOGIN
-- group roles. The operator creates one login per use without a password and
-- sets the password interactively, so it never enters a script, a shell history
-- or the server log (psql hashes it client-side):
--
--   CREATE ROLE cresavo_app_login     LOGIN IN ROLE cresavo_app;
--   CREATE ROLE cresavo_sweeper_login LOGIN IN ROLE cresavo_sweeper;
--   CREATE ROLE cresavo_support_login LOGIN IN ROLE cresavo_support;
--   CREATE ROLE cresavo_outbox_login  LOGIN IN ROLE cresavo_outbox;
--   \password cresavo_app_login        (and the same for the other three)
--
-- Each login is a member of exactly one of these roles and of nothing else:
-- never of the table owner, another group role or a BYPASSRLS role
-- (verify-roles.sql and verify-rls.sql check what each login can SET ROLE to).
-- DATABASE_URL of the web app uses the app login; the cron job of
-- `npm run store:sweep` the sweeper login; the cron job or worker of
-- `npm run effects:drain` the outbox login; support staff the support login.
-- The app's pairing tables may live in a separate database
-- (PAIRING_DATABASE_URL): run this file there too, for its own app login.
-- Support access ends by `REVOKE cresavo_support FROM <login>` plus
-- terminating its sessions (pg_terminate_backend); VALID UNTIL only stops new
-- password logins. Migrations and the admin CLI (npm run admin:manage) keep
-- running as the schema owner, never as one of these roles.
--
-- Every grant is derived from the queries in the code; the comment above each
-- block names it. tests/ops-roles.test.ts parses this file and holds it to the
-- sweepers and the Prisma schema.

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

DO $connect$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['cresavo_app', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox'] LOOP
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), r);
  END LOOP;
END
$connect$;

-- Nobody but the schema owner creates objects (PostgreSQL before 15 lets PUBLIC), and no table is open to PUBLIC.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM cresavo_app, cresavo_eraser, cresavo_sweeper, cresavo_support, cresavo_outbox;
GRANT USAGE ON SCHEMA public TO cresavo_app, cresavo_eraser, cresavo_sweeper, cresavo_support, cresavo_outbox;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- cresavo_app: the web application at runtime. One allowlist per table, from
-- the Prisma calls and raw SQL under src/ (grep `tx.<model>.` and
-- `$queryRaw`). The four store tables (tenant_*) are granted by
-- studio-store.sql and erase-subject.sql: the audit log is append-only for this
-- role. Not granted at all: "PairToken" (no code uses it), "CardBookingAttempt"
-- (only the local MCP card profile in src/mcp/time-card) and the Sandbox*
-- tables (a separate database, docs/DEPLOY_SANDBOX.md). A row lock
-- (FOR UPDATE / FOR SHARE) needs UPDATE on at least one column, so a table
-- that is only locked gets one named column and nothing else.
-- ---------------------------------------------------------------------------
REVOKE ALL ON
  "Service", "Booking", "Customer", "Staff", "CustomerDataAction", "BookingEvent", "WorkspaceRequest",
  "CardBookingAttempt", "Campaign", "CapacityDecision", "AdminSession", "AdminUser", "RateLimitBucket",
  "AgentApiKey", "AgentBooking", "AgentClient", "AgentMandate", "AgentApiEvent", "AgentProposal",
  "AgentAuditEvent", "PartnerBookingAttempt", "PairWorkspace", "PairClient", "PairCode", "PairToken",
  "PairProposal", "PairBudget", "PairGrant", "PairGrantToken", "owner_account", "owner_session", "owner_recovery_code",
  "owner_mfa_challenge"
  FROM cresavo_app;
REVOKE ALL ON "_prisma_migrations" FROM cresavo_app;

-- Booking engine (src/lib/domain.ts raw INSERT ... RETURNING, booking-mutations.ts, customers.ts,
-- workspace-config.ts, campaigns): created, changed, never deleted.
GRANT SELECT, INSERT, UPDATE ON "Service" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ON "Booking" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ON "Customer" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ON "Staff" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ON "Campaign" TO cresavo_app;
-- Append-only history: only create() calls exist (customer-data.ts, domain.ts, booking-mutations.ts,
-- workspace-write.ts, capacity.ts, agent-api/*).
GRANT SELECT, INSERT ON "CustomerDataAction" TO cresavo_app;
GRANT SELECT, INSERT ON "BookingEvent" TO cresavo_app;
GRANT SELECT, INSERT ON "WorkspaceRequest" TO cresavo_app;
GRANT SELECT, INSERT ON "CapacityDecision" TO cresavo_app;
GRANT SELECT, INSERT ON "AgentApiEvent" TO cresavo_app;
GRANT SELECT, INSERT ON "AgentAuditEvent" TO cresavo_app;
GRANT SELECT, INSERT ON "AgentBooking" TO cresavo_app;

-- Admin accounts: the web app reads them and locks the row (auth.ts); accounts are created and changed by the
-- admin CLI as the schema owner. Sessions are created, revoked and expired (auth.ts).
GRANT SELECT, UPDATE ("active") ON "AdminUser" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AdminSession" TO cresavo_app;

-- Owner accounts and sessions (owner-accounts.ts, owner-password-reset.ts, owner-session.ts). The two-step
-- columns of owner_account are covered by its table-wide grant (owner-mfa.ts, owner-mfa-setup.ts: conditional
-- updates and a FOR UPDATE lock). Recovery codes are created, marked used (only used_at changes) and replaced
-- (deleted). Password challenges are created, counted and consumed (deleted), never changed.
GRANT SELECT, INSERT, UPDATE ON "owner_account" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "owner_session" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ("used_at"), DELETE ON "owner_recovery_code" TO cresavo_app;
GRANT SELECT, INSERT, DELETE ON "owner_mfa_challenge" TO cresavo_app;

-- Shared rate-limit and owner-guard rows (postgres-rate-limit.ts, owner-guard-store.ts).
GRANT SELECT, INSERT, UPDATE, DELETE ON "RateLimitBucket" TO cresavo_app;

-- Agent API (src/lib/agent-api). Keys: created by OAuth's upsert, revoked and rotated. The client row is created
-- nested under a key and only locked (FOR SHARE); the mandate is created and locked.
GRANT SELECT, INSERT, UPDATE ON "AgentApiKey" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ("active") ON "AgentClient" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ("revokedAt") ON "AgentMandate" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ON "AgentProposal" TO cresavo_app;
GRANT SELECT, INSERT, DELETE ON "PartnerBookingAttempt" TO cresavo_app;

-- Pairing (src/concept/pairing).
GRANT SELECT, INSERT, UPDATE, DELETE ON "PairWorkspace" TO cresavo_app;
GRANT SELECT, INSERT, DELETE ON "PairClient" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PairCode" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ON "PairProposal" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PairBudget" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE ON "PairGrant" TO cresavo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "PairGrantToken" TO cresavo_app;

-- ---------------------------------------------------------------------------
-- cresavo_sweeper: `npm run store:sweep` (scripts/sweep-store.mts and the
-- sweepers in src/concept/store/store-sweepers.ts). Column-level grants: it
-- reads and changes only what retention needs. It cannot read a salon document
-- or a stored replay result.
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cresavo_sweeper;
-- Sandbox expiry and demo retention: tenant kind and expiry; rows deleted. FOR UPDATE needs one UPDATE column.
GRANT SELECT ("tenant_id", "kind", "expires_at"), UPDATE ("updated_at"), DELETE ON "tenant_state" TO cresavo_sweeper;
-- Demo retention, journal-view pruning, the age-based redaction of personal fields (sweepActivityPersonalData:
-- action, idempotency_key, redacted_at; it reads redacted_at to keep the first value) and the join of sweepOutboxBodies on the action's time.
GRANT SELECT ("tenant_id", "seq", "at", "action", "idempotency_key", "redacted_at"),
      UPDATE ("action", "idempotency_key", "redacted_at"), DELETE ON "tenant_action" TO cresavo_sweeper;
-- Expired keys (sweepExpiredIdempotency) and sandbox cleanup.
GRANT SELECT ("tenant_id", "key", "expires_at"), UPDATE ("expires_at"), DELETE ON "tenant_idempotency" TO cresavo_sweeper;
-- sweepOutboxBodies blanks body, subject, address and the stored mail copy of settled messages; sandbox cleanup deletes.
GRANT SELECT ("tenant_id", "seq", "n", "kind", "status", "payload", "delivered_at", "next_attempt_at"),
      UPDATE ("payload"), DELETE ON "tenant_effect" TO cresavo_sweeper;
-- sweepOwnerGuardBuckets and sweepRateLimits.
GRANT SELECT ("key", "expiresAt"), UPDATE ("expiresAt"), DELETE ON "RateLimitBucket" TO cresavo_sweeper;
-- No sweeper calls erase_subject, so neither this role nor support is ever granted EXECUTE on it (verify-roles.sql
-- checks the effective privilege; the function is owned by cresavo_eraser, so this file cannot touch it).

-- ---------------------------------------------------------------------------
-- cresavo_outbox: the effect poller, `npm run effects:drain` (drainPendingEffects
-- in src/concept/store/effect-outbox.ts and the message sink, src/lib/message-sink.ts).
-- Column-level grants from its queries: it claims, retries, fails and
-- acknowledges effects and reads the document of the salon a message is for. It
-- never inserts or deletes, never reads the log, the replay results or a
-- fingerprint, and cannot change an effect's identity, tenant, kind or erasure
-- mark. Row-level security limits its updates to effects that are not yet
-- delivered and its tenant_state lock to one that changes nothing.
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cresavo_outbox;
-- The claim joins kind and expiry; the sink reads the salon's document under a share lock (FOR SHARE needs one
-- UPDATE column; the policy's WITH CHECK (false) refuses any real update).
GRANT SELECT ("tenant_id", "kind", "expires_at", "doc"), UPDATE ("updated_at") ON "tenant_state" TO cresavo_outbox;
GRANT SELECT ("id", "tenant_id", "seq", "n", "kind", "payload", "status", "attempts", "next_attempt_at", "leased_until",
              "erased_at", "delivered_at"),
      UPDATE ("payload", "status", "attempts", "next_attempt_at", "leased_until", "delivered_at") ON "tenant_effect" TO cresavo_outbox;

-- ---------------------------------------------------------------------------
-- cresavo_support: read-only diagnostics. No salon document (journal entries
-- may be health data), no action or effect payloads, no customer tables, no
-- password hashes, session ids or migration logs. Widening this needs a
-- decision (docs/QUALITY_SECURITY.md, "Roles and permissions").
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cresavo_support;
GRANT SELECT ("tenant_id", "kind", "version", "expires_at", "updated_at") ON "tenant_state" TO cresavo_support;
GRANT SELECT ("tenant_id", "seq", "actor", "source", "at", "resulting_version", "redacted_at") ON "tenant_action" TO cresavo_support;
GRANT SELECT ("tenant_id", "seq", "expires_at") ON "tenant_idempotency" TO cresavo_support;
-- Outbox state: enough to see a stuck or uncertain message (docs/operations/INCIDENT_RUNBOOK.md), not its content.
GRANT SELECT ("tenant_id", "seq", "n", "id", "kind", "status", "attempts", "next_attempt_at", "delivered_at",
              "leased_until", "erased_at") ON "tenant_effect" TO cresavo_support;
-- Whether two-step sign-in is on (totp_enabled_at), never the secret, the pending secret or a recovery code hash.
GRANT SELECT ("id", "tenant_id", "active", "credential_version", "created_at", "totp_enabled_at") ON "owner_account" TO cresavo_support;
GRANT SELECT ("account_id", "credential_version", "created_at", "expires_at", "revoked_at", "mfa_verified_at") ON "owner_session" TO cresavo_support;
GRANT SELECT ("expiresAt", "count") ON "RateLimitBucket" TO cresavo_support;
-- Migration status only: not `logs` (free text of a failure) or `checksum`.
GRANT SELECT ("id", "migration_name", "started_at", "finished_at", "rolled_back_at", "applied_steps_count") ON "_prisma_migrations" TO cresavo_support;

COMMIT;
