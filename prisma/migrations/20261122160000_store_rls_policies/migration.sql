-- Row-level security policies for the four studio store tables
-- (docs/design/STUDIO_STORE.md, "Row-level security"). PREPARED, NOT ENFORCED:
-- this migration creates policies only and does NOT enable row-level security.
-- A policy has no effect until an operator runs prisma/grants/rls-enable.sql
-- (ENABLE plus FORCE ROW LEVEL SECURITY); prisma/grants/rls-disable.sql undoes
-- that and prisma/grants/verify-rls.sql reports the state. Only the store
-- tables are touched; no data, column or other table changes.
--
-- Every store transaction sets its scope first, transaction-local
-- (src/concept/store/tenant-scope.ts):
--
--   cresavo.tenant_id     one tenant: every operation on its own rows
--   cresavo.cross_tenant  'outbox' (the effect poller) or 'sweep' (store:sweep),
--                         each only for members of its group role (roles.sql)
--   cresavo.sandbox_key   resolve a sandbox token: that sandbox's row only, read
--   cresavo.salon_slug    resolve a booking address: that salon's row only, read
--
-- Roles are created after migrations (prisma/grants/roles.sql), so the policies
-- apply TO PUBLIC and name group roles only inside their expressions, by a
-- lookup that is false while the role does not exist. Policies are permissive
-- and combine with OR; the table grants still decide what each role may do.
--
-- The table owner (the role that runs migrations, the admin CLI and operator
-- scripts) and anyone who can use its privileges keep every row: FORCE makes
-- RLS apply to the owner too, and the `store_owner` policy states the owner's
-- full access explicitly instead of leaving it to the absence of FORCE.
-- Superusers and BYPASSRLS roles are never subject to RLS.

-- ---------------------------------------------------------------------------
-- tenant_state
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_state" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_state'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_state'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_state" FOR ALL
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
-- Read-only diagnostics across tenants; the column grants of roles.sql keep documents out.
CREATE POLICY "store_support_read" ON "tenant_state" FOR SELECT
  USING (EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_support' AND pg_has_role(r.oid, 'USAGE')));
-- The poller joins tenant kind and expiry to the effects it claims. Read only.
CREATE POLICY "store_outbox_read" ON "tenant_state" FOR SELECT
  USING (current_setting('cresavo.cross_tenant', true) = 'outbox'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_app' AND pg_has_role(r.oid, 'USAGE')));
-- Sweeps read kind and expiry (the sweeper's column grants exclude the document); they lock and delete sandboxes only.
CREATE POLICY "store_sweep_read" ON "tenant_state" FOR SELECT
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
CREATE POLICY "store_sweep_lock" ON "tenant_state" FOR UPDATE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'sandbox'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')))
  WITH CHECK (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'sandbox'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
CREATE POLICY "store_sweep_delete" ON "tenant_state" FOR DELETE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'sandbox'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
-- A sandbox token resolves to its own tenant id only (the key is a hash of the token).
CREATE POLICY "store_sandbox_lookup" ON "tenant_state" FOR SELECT
  USING ("kind" = 'sandbox' AND nullif(current_setting('cresavo.sandbox_key', true), '') IS NOT NULL
    AND ("tenant_id" = current_setting('cresavo.sandbox_key', true)
      OR starts_with("tenant_id", current_setting('cresavo.sandbox_key', true) || '_')));
-- A booking address resolves to the one salon that has it (unique by tenant_state_salon_slug_key).
CREATE POLICY "store_salon_slug_lookup" ON "tenant_state" FOR SELECT
  USING ("kind" = 'salon' AND ("doc" #>> '{salon,slug}') = nullif(current_setting('cresavo.salon_slug', true), ''));

-- ---------------------------------------------------------------------------
-- tenant_action
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_action" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_action'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_action'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_action" FOR ALL
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_action" FOR SELECT
  USING (EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_support' AND pg_has_role(r.oid, 'USAGE')));
-- Retention reads and locks old rows; an update can only leave the caller's key empty (both redaction sweeps clear it).
CREATE POLICY "store_sweep_read" ON "tenant_action" FOR SELECT
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
CREATE POLICY "store_sweep_update" ON "tenant_action" FOR UPDATE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')))
  WITH CHECK (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "idempotency_key" IS NULL
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
-- Deletes only journal-view copies, and the log of demo and sandbox tenants; a salon's other history stays.
CREATE POLICY "store_sweep_delete" ON "tenant_action" FOR DELETE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE'))
    AND ("action" ->> 'type' = 'journal/view' OR EXISTS (
      SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_action"."tenant_id" AND s."kind" IN ('demo', 'sandbox'))));

-- ---------------------------------------------------------------------------
-- tenant_idempotency
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_idempotency" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_idempotency'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_idempotency'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_idempotency" FOR ALL
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_idempotency" FOR SELECT
  USING (EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_support' AND pg_has_role(r.oid, 'USAGE')));
-- Sweeps read and lock keys (never change one) and delete expired keys and an expired sandbox's keys.
CREATE POLICY "store_sweep_read" ON "tenant_idempotency" FOR SELECT
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
CREATE POLICY "store_sweep_lock" ON "tenant_idempotency" FOR UPDATE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')))
  WITH CHECK (false);
CREATE POLICY "store_sweep_delete" ON "tenant_idempotency" FOR DELETE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE'))
    AND ("expires_at" <= clock_timestamp() OR EXISTS (
      SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_idempotency"."tenant_id" AND s."kind" = 'sandbox')));

-- ---------------------------------------------------------------------------
-- tenant_effect
-- ---------------------------------------------------------------------------
CREATE POLICY "store_owner" ON "tenant_effect" FOR ALL
  USING (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE'))
  WITH CHECK (pg_has_role((SELECT c.relowner FROM pg_class c WHERE c.oid = 'tenant_effect'::regclass), 'USAGE'));
CREATE POLICY "store_tenant" ON "tenant_effect" FOR ALL
  USING ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''))
  WITH CHECK ("tenant_id" = nullif(current_setting('cresavo.tenant_id', true), ''));
CREATE POLICY "store_support_read" ON "tenant_effect" FOR SELECT
  USING (EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_support' AND pg_has_role(r.oid, 'USAGE')));
-- The poller reads every due effect in commit order and claims, retries, fails or acknowledges rows that are not
-- yet delivered. It inserts and deletes nothing, and a delivered row is final for it.
CREATE POLICY "store_outbox_read" ON "tenant_effect" FOR SELECT
  USING (current_setting('cresavo.cross_tenant', true) = 'outbox'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_app' AND pg_has_role(r.oid, 'USAGE')));
CREATE POLICY "store_outbox_update" ON "tenant_effect" FOR UPDATE
  USING (current_setting('cresavo.cross_tenant', true) = 'outbox' AND "status" <> 'delivered'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_app' AND pg_has_role(r.oid, 'USAGE')))
  WITH CHECK (current_setting('cresavo.cross_tenant', true) = 'outbox'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_app' AND pg_has_role(r.oid, 'USAGE')));
-- Retention blanks settled messages only and deletes an expired sandbox's rows.
CREATE POLICY "store_sweep_read" ON "tenant_effect" FOR SELECT
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
CREATE POLICY "store_sweep_update" ON "tenant_effect" FOR UPDATE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'message' AND "status" <> 'pending'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')))
  WITH CHECK (current_setting('cresavo.cross_tenant', true) = 'sweep' AND "kind" = 'message' AND "status" <> 'pending'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE')));
CREATE POLICY "store_sweep_delete" ON "tenant_effect" FOR DELETE
  USING (current_setting('cresavo.cross_tenant', true) = 'sweep'
    AND EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = 'cresavo_sweeper' AND pg_has_role(r.oid, 'USAGE'))
    AND EXISTS (SELECT 1 FROM "tenant_state" s WHERE s."tenant_id" = "tenant_effect"."tenant_id" AND s."kind" = 'sandbox'));
