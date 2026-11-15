CREATE TABLE "AgentAuditEvent" (
 "id" TEXT PRIMARY KEY, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "businessId" TEXT NOT NULL, "event" TEXT NOT NULL, "outcome" TEXT NOT NULL,
 "clientId" TEXT, "keyId" TEXT, "scopes" TEXT[] NOT NULL,
 "route" TEXT, "tool" TEXT, "requestId" TEXT NOT NULL,
 "proposalId" TEXT, "mandateId" TEXT, "bookingId" TEXT
);
CREATE INDEX "AgentAuditEvent_businessId_createdAt_id_idx" ON "AgentAuditEvent"("businessId", "createdAt", "id");
CREATE INDEX "AgentAuditEvent_proposalId_idx" ON "AgentAuditEvent"("proposalId");
CREATE INDEX "AgentAuditEvent_mandateId_idx" ON "AgentAuditEvent"("mandateId");
CREATE INDEX "AgentAuditEvent_bookingId_idx" ON "AgentAuditEvent"("bookingId");
CREATE INDEX "AgentAuditEvent_requestId_idx" ON "AgentAuditEvent"("requestId");
CREATE FUNCTION reject_agent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'AGENT_AUDIT_APPEND_ONLY'; END;
$$;
CREATE TRIGGER agent_audit_append_only BEFORE UPDATE OR DELETE ON "AgentAuditEvent"
FOR EACH ROW EXECUTE FUNCTION reject_agent_audit_mutation();
