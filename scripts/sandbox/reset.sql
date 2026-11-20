-- Apply as the migration owner on the marked sandbox after Prisma migrations.
-- psql -v ON_ERROR_STOP=1 -v reset_role=<separate-role> -f scripts/sandbox/reset.sql
BEGIN;
SELECT set_config('cresavo_sandbox.requested_reset_role', :'reset_role', true);
DO $sandbox$
DECLARE
  reset_role name := current_setting('cresavo_sandbox.requested_reset_role');
BEGIN
  IF NOT EXISTS (SELECT FROM cresavo_sandbox.installation WHERE singleton AND revision = 1) OR
     NOT EXISTS (SELECT FROM pg_roles WHERE rolname = reset_role AND rolcanlogin
       AND NOT (rolsuper OR rolreplication OR rolcreaterole OR rolcreatedb OR rolbypassrls)) OR
     pg_has_role(reset_role, current_user, 'MEMBER') OR
     has_table_privilege(reset_role, 'public."SandboxSession"', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'SANDBOX_SEPARATE_RESET_ROLE_REQUIRED';
  END IF;
END;
$sandbox$;
ALTER TABLE cresavo_sandbox.generation ADD COLUMN IF NOT EXISTS last_reset_day date;
ALTER TABLE cresavo_sandbox.generation ADD COLUMN IF NOT EXISTS reset_role name;
UPDATE cresavo_sandbox.generation SET reset_role = current_setting('cresavo_sandbox.requested_reset_role')::name;

-- Replacement resets all old EXECUTE grants, including a retired cron login.
DROP FUNCTION IF EXISTS cresavo_sandbox.reset(uuid, integer);
CREATE FUNCTION cresavo_sandbox.reset(expected_id uuid, expected_revision integer)
RETURNS TABLE(changed boolean, generation integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $reset$
DECLARE
  cutoff timestamptz;
  today_utc date;
  current_generation integer;
  previous_day date;
  reset_login name;
BEGIN
  -- This is the exact exclusive counterpart to the provider's shared transaction lock.
  PERFORM pg_advisory_xact_lock(64119334);
  IF NOT EXISTS (
    SELECT FROM cresavo_sandbox.installation i
    WHERE i.singleton AND i.id = expected_id AND i.revision = expected_revision AND i.revision = 1
  ) THEN
    RAISE EXCEPTION 'SANDBOX_INSTALLATION_REQUIRED';
  END IF;
  cutoff := clock_timestamp();
  today_utc := (cutoff AT TIME ZONE 'UTC')::date;
  SELECT g.generation, g.last_reset_day, g.reset_role INTO STRICT current_generation, previous_day, reset_login
    FROM cresavo_sandbox.generation g WHERE g.singleton;
  IF session_user IS DISTINCT FROM reset_login THEN
    RAISE EXCEPTION 'SANDBOX_RESET_LOGIN_REQUIRED';
  END IF;
  IF previous_day >= today_utc THEN
    RETURN QUERY SELECT false, current_generation;
    RETURN;
  END IF;

  -- Only sessions registered by this sandbox. Clear dependent rows in FK order.
  DELETE FROM public."AgentBooking" b USING public."SandboxSession" s
    WHERE b."businessId" = s."businessId" AND b."clientId" = s."clientId";
  DELETE FROM public."AgentProposal" p USING public."SandboxSession" s
    WHERE p."businessId" = s."businessId" AND p."clientId" = s."clientId";
  DELETE FROM public."AgentMandate" m USING public."SandboxSession" s
    WHERE m."businessId" = s."businessId" AND m."clientId" = s."clientId";
  DELETE FROM public."Booking" b USING public."SandboxSession" s WHERE b."businessId" = s."businessId";
  DELETE FROM public."Staff" m USING public."SandboxSession" s WHERE m."businessId" = s."businessId";
  DELETE FROM public."Service" v USING public."SandboxSession" s WHERE v."businessId" = s."businessId";
  DELETE FROM public."AgentApiKey" k USING public."SandboxSession" s
    WHERE k."businessId" = s."businessId" AND k."clientId" = s."clientId";
  WITH removed AS (
    DELETE FROM public."SandboxSession" RETURNING "businessId", "clientId"
  )
  DELETE FROM public."AgentClient" c USING removed s
    WHERE c."id" = s."clientId" AND c."businessId" = s."businessId";
  DELETE FROM public."SandboxPairBudget" WHERE "day" < today_utc;
  -- Without sessions the next visitor starts from the versioned Salong Eko seed.
  UPDATE cresavo_sandbox.generation g
    SET generation = current_generation + 1, last_reset_day = today_utc, reset_at = cutoff
    WHERE g.singleton;
  RETURN QUERY SELECT true, current_generation + 1;
END;
$reset$;
REVOKE ALL ON FUNCTION cresavo_sandbox.reset(uuid, integer) FROM PUBLIC;
GRANT USAGE ON SCHEMA cresavo_sandbox TO :"reset_role";
GRANT EXECUTE ON FUNCTION cresavo_sandbox.reset(uuid, integer) TO :"reset_role";
COMMIT;
