-- Apply as the migration owner on a marked sandbox after Prisma migrations.
-- psql -v ON_ERROR_STOP=1 -v runtime_role=<nonowner-role> -f scripts/sandbox/runtime-grants.sql
BEGIN;
DO $sandbox$
BEGIN
  IF NOT EXISTS (SELECT FROM cresavo_sandbox.installation WHERE singleton AND revision = 1) THEN
    RAISE EXCEPTION 'SANDBOX_DATABASE_REQUIRED';
  END IF;
END;
$sandbox$;
GRANT USAGE ON SCHEMA cresavo_sandbox, public TO :"runtime_role";
GRANT SELECT ON cresavo_sandbox.installation, cresavo_sandbox.generation TO :"runtime_role";
GRANT SELECT, INSERT ON "AgentClient", "AgentApiKey", "SandboxSession", "SandboxAudit",
  "AgentProposal", "AgentMandate", "AgentBooking", "Booking", "BookingEvent", "Service", "Staff" TO :"runtime_role";
GRANT UPDATE ("active") ON "AgentClient" TO :"runtime_role";
GRANT UPDATE ("revokedAt") ON "AgentApiKey", "AgentMandate" TO :"runtime_role";
GRANT UPDATE ("apiRequests") ON "SandboxSession" TO :"runtime_role";
GRANT UPDATE ("status", "mandateId") ON "AgentProposal" TO :"runtime_role";
COMMIT;
