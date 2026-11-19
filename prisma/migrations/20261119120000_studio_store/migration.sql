-- Studio store, step 2 (docs/design/STUDIO_STORE.md, "Step 2 decisions").
-- New tables only; existing tables are untouched. Role grants are not created
-- here (the migration role may not own roles): see prisma/grants/studio-store.sql.

-- CreateEnum
CREATE TYPE "tenant_kind" AS ENUM ('salon', 'demo', 'sandbox');

-- CreateTable
CREATE TABLE "tenant_state" (
    "tenant_id" TEXT NOT NULL,
    "kind" "tenant_kind" NOT NULL DEFAULT 'salon',
    "version" INTEGER NOT NULL DEFAULT 0,
    "doc" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_state_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "tenant_action" (
    "tenant_id" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "action" JSONB NOT NULL,
    "actor" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "idempotency_key" TEXT,
    "resulting_version" INTEGER NOT NULL,
    "subject_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redacted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenant_action_pkey" PRIMARY KEY ("tenant_id","seq")
);

-- CreateTable
CREATE TABLE "tenant_idempotency" (
    "tenant_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint_hmac" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "result" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_idempotency_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
CREATE TABLE "tenant_effect" (
    "tenant_id" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "n" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenant_effect_pkey" PRIMARY KEY ("tenant_id","seq","n")
);

-- CreateIndex
CREATE INDEX "tenant_action_subject_ids_idx" ON "tenant_action" USING GIN ("subject_ids");

-- CreateIndex
CREATE INDEX "tenant_idempotency_expires_at_idx" ON "tenant_idempotency"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_effect_id_key" ON "tenant_effect"("id");

-- CreateIndex
CREATE INDEX "tenant_effect_status_next_attempt_at_idx" ON "tenant_effect"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "tenant_effect_tenant_id_status_seq_n_idx" ON "tenant_effect"("tenant_id", "status", "seq", "n");

-- Not modelled by Prisma (ignored by its diff): bounds from the step 2 decisions.
ALTER TABLE "tenant_idempotency" ADD CONSTRAINT "tenant_idempotency_key_length" CHECK (char_length("key") BETWEEN 1 AND 200);
ALTER TABLE "tenant_effect" ADD CONSTRAINT "tenant_effect_status_check" CHECK ("status" IN ('pending', 'delivered'));
ALTER TABLE "tenant_action" ADD CONSTRAINT "tenant_action_seq_positive" CHECK ("seq" > 0);
