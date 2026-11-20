-- A proposal's customer delivery profile is fixed when it is created (docs/CUSTOMER_CONSENT_CHANNEL.md).
-- The inbox trigger checks the channel when an inbox row is written; this guard covers the parent
-- side: once a proposal exists, its "consentDelivery" can no longer change, so a delivered staging
-- link can never end up attached to a proposal that another decision path treats as unbound.
BEGIN;
CREATE FUNCTION "AgentProposal_consentDelivery_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."consentDelivery" IS DISTINCT FROM OLD."consentDelivery" THEN
    RAISE EXCEPTION 'CONSENT_DELIVERY_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "AgentProposal_consentDelivery_immutable" BEFORE UPDATE OF "consentDelivery" ON "AgentProposal"
  FOR EACH ROW EXECUTE FUNCTION "AgentProposal_consentDelivery_immutable"();
COMMIT;
