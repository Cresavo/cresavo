-- Studio store, step 2 items 4 and 7 (docs/design/STUDIO_STORE.md).
-- Outbox states beyond pending and delivered:
--   failed     the poller gave up after the maximum number of attempts; an operator decides
--   cancelled  erasure stopped a message that was not yet sent to an erased customer
-- A failed payment keeps blocking the tenant's later payments, so a refund
-- never goes out for a checkout that never went through.
ALTER TABLE "tenant_effect" DROP CONSTRAINT "tenant_effect_status_check";
ALTER TABLE "tenant_effect" ADD CONSTRAINT "tenant_effect_status_check" CHECK ("status" IN ('pending', 'delivered', 'failed', 'cancelled'));

-- The poller claims due rows across tenants in commit order.
-- CreateIndex
CREATE INDEX "tenant_effect_status_tenant_id_seq_n_idx" ON "tenant_effect"("status", "tenant_id", "seq", "n");

-- A claim sets leased_until; ack, retry and failure clear it. While it is in
-- the future the row is in flight with one deliverer (backoff alone leaves it NULL).
-- erased_at: an erasure stopped this row. It is never claimed again; a
-- delivery already in flight still records its true outcome.
ALTER TABLE "tenant_effect" ADD COLUMN "leased_until" TIMESTAMPTZ(3);
ALTER TABLE "tenant_effect" ADD COLUMN "erased_at" TIMESTAMPTZ(3);
