-- Turns on row-level security for the four studio store tables: the operator
-- step that enforces the policies of migration 20261122160000_store_rls_policies
-- (docs/design/STUDIO_STORE.md, "Row-level security"). Documentation for
-- operators, NOT a migration. Rollback: rls-disable.sql. State: verify-rls.sql.
--
-- Run it as the owner of the tables (only an owner or a superuser may ALTER
-- them), after the order in roles.sql's header, and only once the deployed
-- application sets its scope in every store transaction (src/concept/store/
-- tenant-scope.ts). One transaction: either all four tables are enforced or none.
--
--   psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/grants/rls-enable.sql
--   psql "$ADMIN_DATABASE_URL" -f prisma/grants/verify-rls.sql
--
-- Before it enables anything it checks the exact policy set on the four tables:
-- every expected policy, no other (permissive or restrictive), and each one's
-- command, permissive flag, roles and predicates, by a digest of how the server
-- shows them in pg_policies. The digests are PostgreSQL 16's rendering with the
-- default search_path; on another major version, or after any change to a
-- policy, the step refuses and names the policies: compare them by hand with
-- the migration and update the list here and in verify-rls.sql
-- (tests/store-rls-files.test.ts keeps the two lists equal).
--
-- FORCE makes the policies apply to the table owner as well; the migration's
-- `store_owner` policy keeps the owner's full access, so migrations, the admin
-- CLI and operator scripts are unaffected. Superusers and BYPASSRLS roles are
-- never subject to row-level security: no runtime login may be or become one
-- (verify-roles.sql and verify-rls.sql check that).

BEGIN;

DO $check$
DECLARE
  drift text;
  missing text;
BEGIN
  WITH expected(tbl, policy, digest) AS (VALUES
  ('tenant_action', 'store_owner', 'e9faebba0398f4bf24a080070171835a'),
  ('tenant_action', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_action', 'store_sweep_delete', '3fc6296f342fd22ca9ec2729bdcc5dcd'),
  ('tenant_action', 'store_sweep_read', '313d2a5e9ecb91bbb51ae1b01c445536'),
  ('tenant_action', 'store_sweep_update', '04281d4e254714828fd3509e67d2cdbe'),
  ('tenant_action', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
  ('tenant_effect', 'store_outbox_read', 'd36a751db5c124849300a81494527a2a'),
  ('tenant_effect', 'store_outbox_update', '254883bc81995a55b29dd49018a72aa3'),
  ('tenant_effect', 'store_owner', '7b48fbc8c2f0c46f67befa959f7e9a53'),
  ('tenant_effect', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_effect', 'store_sweep_delete', '31f2f4452b9eb10acce43e08515c4035'),
  ('tenant_effect', 'store_sweep_read', 'e9ffbe3644b4d9686af2e87d0efbf9e2'),
  ('tenant_effect', 'store_sweep_update', 'cba059844d66162846104d7f90daa66b'),
  ('tenant_effect', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
  ('tenant_idempotency', 'store_owner', 'ba91ae228026bd121c6b7d4c27d1d904'),
  ('tenant_idempotency', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_idempotency', 'store_sweep_delete', '36956963702d4c79ea73079ea7611063'),
  ('tenant_idempotency', 'store_sweep_lock', 'e23e492c2c674ab76d21e594cc08e831'),
  ('tenant_idempotency', 'store_sweep_read', 'aa730b849ab81f232bf23c905a16597b'),
  ('tenant_idempotency', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d'),
  ('tenant_state', 'store_outbox_lock', '72c76bfc1d459da30466a4978735432c'),
  ('tenant_state', 'store_outbox_read', 'd36a751db5c124849300a81494527a2a'),
  ('tenant_state', 'store_owner', '03899db0eb95846adb21ec3cfbb63e0e'),
  ('tenant_state', 'store_salon_slug_lookup', '75bb90c499297a854b9b948966bad46a'),
  ('tenant_state', 'store_sandbox_lookup', 'ebcc6e29a0b9b581e6ac00c0fe4c1b22'),
  ('tenant_state', 'store_support_read', '89f337913de154d7c0a88624b31894e1'),
  ('tenant_state', 'store_sweep_delete', '0e2816121f25d90cfd7281c4541b78ca'),
  ('tenant_state', 'store_sweep_lock', '6d320363ca1bb32d97a77f7f1401dc1b'),
  ('tenant_state', 'store_sweep_read', '463fa3fc8bf47a14a4eb60838cbe1ab3'),
  ('tenant_state', 'store_tenant', '8f372e55ff03e97c17d18c6ef34a5f1d')
  ),
  actual AS (
    SELECT p.tablename AS tbl, p.policyname AS policy, md5(p.cmd || '|' || p.permissive || '|' || array_to_string(p.roles, ',') || '|' || coalesce(p.qual, '') || '|' || coalesce(p.with_check, '')) AS digest
    FROM pg_policies p
    WHERE p.schemaname = current_schema() AND p.tablename IN ('tenant_state', 'tenant_action', 'tenant_idempotency', 'tenant_effect')
  )
  SELECT string_agg(coalesce(a.tbl, e.tbl) || '.' || coalesce(a.policy, e.policy) || ' ('
    || CASE WHEN a.policy IS NULL THEN 'missing' WHEN e.policy IS NULL THEN 'unexpected' ELSE 'changed' END || ')', ', ')
  INTO drift
  FROM expected e FULL JOIN actual a ON a.tbl = e.tbl AND a.policy = e.policy
  WHERE a.policy IS NULL OR e.policy IS NULL OR a.digest <> e.digest;
  IF drift IS NOT NULL THEN
    RAISE EXCEPTION 'the store policies differ from migration store_rls_policies: %', drift;
  END IF;
  -- The policies name these group roles (roles.sql); without them the store would see nothing.
  SELECT string_agg(r, ', ') INTO missing
  FROM unnest(ARRAY['cresavo_app', 'cresavo_eraser', 'cresavo_sweeper', 'cresavo_support', 'cresavo_outbox']) r
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'roles % are missing: run prisma/grants/roles.sql first', missing;
  END IF;
END
$check$;

ALTER TABLE "tenant_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_state" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_action" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_idempotency" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_effect" FORCE ROW LEVEL SECURITY;

COMMIT;
