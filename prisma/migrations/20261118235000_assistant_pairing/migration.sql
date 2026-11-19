-- CreateTable
CREATE TABLE "PairWorkspace" (
    "id" TEXT NOT NULL,
    "ownerHash" TEXT NOT NULL,
    "ipKey" TEXT NOT NULL,
    "seedDay" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "hardExpiry" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirects" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairCode" (
    "hash" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairCode_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "PairToken" (
    "accessHash" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "rotated" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairToken_pkey" PRIMARY KEY ("accessHash")
);

-- CreateTable
CREATE TABLE "PairProposal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "before" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairBudget" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairBudget_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PairWorkspace_ownerHash_key" ON "PairWorkspace"("ownerHash");

-- CreateIndex
CREATE INDEX "PairWorkspace_expiresAt_idx" ON "PairWorkspace"("expiresAt");

-- CreateIndex
CREATE INDEX "PairWorkspace_ipKey_idx" ON "PairWorkspace"("ipKey");

-- CreateIndex
CREATE INDEX "PairClient_expiresAt_idx" ON "PairClient"("expiresAt");

-- CreateIndex
CREATE INDEX "PairCode_workspaceId_idx" ON "PairCode"("workspaceId");

-- CreateIndex
CREATE INDEX "PairCode_expiresAt_idx" ON "PairCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PairToken_refreshHash_key" ON "PairToken"("refreshHash");

-- CreateIndex
CREATE INDEX "PairToken_workspaceId_idx" ON "PairToken"("workspaceId");

-- CreateIndex
CREATE INDEX "PairToken_family_idx" ON "PairToken"("family");

-- CreateIndex
CREATE UNIQUE INDEX "PairProposal_workspaceId_clientId_key_key" ON "PairProposal"("workspaceId", "clientId", "key");

-- CreateIndex
CREATE INDEX "PairBudget_expiresAt_idx" ON "PairBudget"("expiresAt");

-- AddForeignKey
ALTER TABLE "PairCode" ADD CONSTRAINT "PairCode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PairWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairToken" ADD CONSTRAINT "PairToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PairWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairProposal" ADD CONSTRAINT "PairProposal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "PairWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

