-- Row-level security policies for the four studio store tables
-- (docs/design/STUDIO_STORE.md, "Row-level security"). PREPARED, NOT ENFORCED:
-- this migration creates policies only and does NOT enable row-level security.
-- A policy has no effect until an operator runs prisma/grants/rls-enable.sql
-- (ENABLE plus FORCE ROW LEVEL SECURITY, after checking this exact policy set);
-- rls-disable.sql undoes that and verify-rls.sql reports the state. Only the
-- store tables get policies; no data, column or other table changes.
--
-- Every store transaction sets its scope first, transaction-local
-- (src/concept/store/tenant-scope.ts):
--
--   cresavo.tenant_id     one tenant (cresavo_app, cresavo_eraser; the poller's sink)
--   cresavo.cross_tenant  'outbox' for the effects:drain poller (cresavo_outbox),
--                         'sweep' for store:sweep (cresavo_sweeper)
--   cresavo.sandbox_key   cresavo_app resolving a sandbox token: that row only, read
--   cresavo.salon_slug    cresavo_app resolving a booking address: that row only, read
--
-- Each policy names the group roles it is for. Those roles are normally created
-- by prisma/grants/roles.sql, which needs the tables and so runs after
-- migrations; a policy cannot name a role that does not exist yet. This
-- migration therefore creates any of the five group roles that is missing,
-- with every privileged attribute off and without login, exactly as roles.sql
-- does (roles.sql only checks an existing role). That needs CREATEROLE; a
-- migration role without it must have the roles created first (statements in
-- the error below).
--
-- The table owner (migrations, the admin CLI, operator scripts) keeps every row:
-- FORCE makes RLS apply to the owner too, and `store_owner` states the owner's
-- access explicitly. Superusers and BYPASSRLS roles are never subject to RLS.
--
-- Retention bounds in the sweep policies match src/concept/privacy/retention.ts
-- and store-sweepers.ts (tests/store-rls-files.test.ts keeps them equal):
-- demo log 7 days, outbox bodies 90 days, activity personal data 13 months,
-- journal reads 24 months, idempotency keys at expiry, sandboxes at expiry. The
-- sweepers compute their cutoff from the database clock before the statement,
-- so the policy, which uses the statement's transaction time, never refuses a
-- row they select.

DO $roles$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['cresavo_app', 'cresavo_eraser', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', r);
    END IF;
  END LOOP;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'cannot create the store group roles: as an admin, run CREATE ROLE <name> NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS for cresavo_app, cresavo_eraser, cresavo_sweeper, cresavo_support and cresavo_outbox, then deploy again';
END
$roles$;

-- ---------------------------------------------------------------------------
-- tenant_state
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_state" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_state'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_state'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_state" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
-- Read-only diagnostics across tenants; the column grants of roles.sql keep documents out.
CREATE POLICY "store_support_read" ON "tenant_state" FOR SELECT TO cresavo_support USING (true);
-- The poller joins tenant kind and expiry to the effects it claims; its sink reads (and share-locks) the one
-- tenant it delivers for. It never changes a row.
CREATE POLICY "store_outbox_read" ON "tenant_state" FOR SELECT TO cresavo_outbox
  USING (current_setting('cresavo.cross_tenant', true) = 'outbox'
    OR "tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_outbox_lock" ON "tenant_state" FOR UPDATE TO cresavo_outbox
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK (false);
-- Sweeps see demo and sandbox tenants only, and lock and delete a sandbox once it has expired.
CREATE POLICY "store_sweep_read" ON "tenant_state" FOR SELECT TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" IN ('demo', 'sandbox'));
CREATE POLICY "store_sweep_lock" ON "tenant_state" FOR UPDATE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'sandbox' AND "expires_at" <= now())
  WITH CHECK (false);
CREATE POLICY "store_sweep_delete" ON "tenant_state" FOR DELETE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'sandbox' AND "expires_at" <= now());
-- A sandbox token resolves to its own tenant only: the key is the full sbx_ + 32-hex hash of the token.
CREATE POLICY "store_sandbox_lookup" ON "tenant_state" FOR SELECT TO cresavo_app
  USING ("kind" = 'sandbox' AND current_setting('cresavo.sandbox_key', true) ~ '^sbx_[0-9a-f]{32}$'
    AND ("tenant_id" = current_setting('cresavo.sandbox_key', true)
      OR starts_with("tenant_id", current_setting('cresavo.sandbox_key', true) || '_')));
-- A booking address resolves to the one salon that has it (unique by tenant_state_salon_slug_key).
CREATE POLICY "store_salon_slug_lookup" ON "tenant_state" FOR SELECT TO cresavo_app
  USING ("kind" = 'salon' AND ("doc" #>> '{salon,slug}') = nullif(current_setting('cresavo.salon_slug', true), ''));

-- ---------------------------------------------------------------------------
-- tenant_action
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_action" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_action'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_action'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_action" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_action" FOR SELECT TO cresavo_support USING (true);
-- Sweeps read rows old enough for one of them: outbox bodies join the action's time after 90 days.
CREATE POLICY "store_sweep_read" ON "tenant_action" FOR SELECT TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND (
    "at" < now() - interval '90 days'
    OR ("at" < now() - interval '7 days' AND EXISTS (
      SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_action"."tenant_id" AND s."kind" = 'demo'))
    OR EXISTS (SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_action"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now())));
-- Personal data is redacted after 13 months, and every changed row loses its key; rows due for deletion may be locked.
CREATE POLICY "store_sweep_update" ON "tenant_action" FOR UPDATE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND (
    "at" < now() - interval '13 months'
    OR ("action" ->> 'type' = 'journal/view' AND "at" < now() - interval '24 months')
    OR ("at" < now() - interval '7 days' AND EXISTS (
      SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_action"."tenant_id" AND s."kind" = 'demo'))
    OR EXISTS (SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_action"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now())))
  WITH CHECK (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "at" < now() - interval '13 months'
    AND "idempotency_key" IS NULL);
-- Deleted: journal reads after 24 months, a demo's log after 7 days, an expired sandbox's log.
CREATE POLICY "store_sweep_delete" ON "tenant_action" FOR DELETE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND (
    ("action" ->> 'type' = 'journal/view' AND "at" < now() - interval '24 months')
    OR ("at" < now() - interval '7 days' AND EXISTS (
      SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_action"."tenant_id" AND s."kind" = 'demo'))
    OR EXISTS (SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_action"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now())));

-- ---------------------------------------------------------------------------
-- tenant_idempotency
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_idempotency" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_idempotency'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_idempotency'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_idempotency" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_idempotency" FOR SELECT TO cresavo_support USING (true);
-- Sweeps see, lock (never change) and delete expired keys and an expired sandbox's keys, nothing else.
CREATE POLICY "store_sweep_read" ON "tenant_idempotency" FOR SELECT TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND ("expires_at" <= now() OR EXISTS (
    SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_idempotency"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now())));
CREATE POLICY "store_sweep_lock" ON "tenant_idempotency" FOR UPDATE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND ("expires_at" <= now() OR EXISTS (
    SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_idempotency"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now())))
  WITH CHECK (false);
CREATE POLICY "store_sweep_delete" ON "tenant_idempotency" FOR DELETE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND ("expires_at" <= now() OR EXISTS (
    SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_idempotency"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now())));

-- ---------------------------------------------------------------------------
-- tenant_effect
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_effect" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_effect" FOR ALL TO cresavo_app, cresavo_eraser
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_effect" FOR SELECT TO cresavo_support USING (true);
-- The poller reads due effects across tenants in commit order and claims, retries, fails or acknowledges rows that
-- are not yet delivered; its sink does the same for the one tenant it delivers for. It inserts and deletes nothing,
-- and a delivered row is final for it. Its column grants keep the row's identity and erasure marks fixed.
CREATE POLICY "store_outbox_read" ON "tenant_effect" FOR SELECT TO cresavo_outbox
  USING (current_setting('cresavo.cross_tenant', true) = 'outbox'
    OR "tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_outbox_update" ON "tenant_effect" FOR UPDATE TO cresavo_outbox
  USING ("status" <> 'delivered' AND (current_setting('cresavo.cross_tenant', true) = 'outbox'
    OR "tenant_id" = nullif(current_setting('cresavo.tenant_id', true), '')))
  WITH CHECK (current_setting('cresavo.cross_tenant', true) = 'outbox'
    OR "tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
-- Retention blanks settled messages after 90 days (judged by their action's time, as the sweep does) and deletes an
-- expired sandbox's rows.
CREATE POLICY "store_sweep_read" ON "tenant_effect" FOR SELECT TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND (
    ("kind" = 'message' AND "status" <> 'pending' AND coalesce((SELECT a."at" FROM "tenant_action" a
        WHERE a."tenant_id" = "tenant_effect"."tenant_id" AND a."seq" = "tenant_effect"."seq"),
      "delivered_at", "next_attempt_at") < now() - interval '90 days')
    OR EXISTS (SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_effect"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now())));
CREATE POLICY "store_sweep_update" ON "tenant_effect" FOR UPDATE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'message' AND "status" <> 'pending'
    AND coalesce((SELECT a."at" FROM "tenant_action" a
        WHERE a."tenant_id" = "tenant_effect"."tenant_id" AND a."seq" = "tenant_effect"."seq"),
      "delivered_at", "next_attempt_at") < now() - interval '90 days')
  WITH CHECK (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'message' AND "status" <> 'pending');
CREATE POLICY "store_sweep_delete" ON "tenant_effect" FOR DELETE TO cresavo_sweeper
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND EXISTS (
    SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_effect"."tenant_id"
      AND s."kind" = 'sandbox' AND s."expires_at" <= now()));
