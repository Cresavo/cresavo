import type { Prisma, PrismaClient } from "@prisma/client";
import type { TenantId } from "./studio-store";

// The row-level security scope of a store transaction (docs/design/STUDIO_STORE.md,
// "Row-level security"; policies in migration 20261122160000_store_rls_policies).
// Every statement on tenant_state, tenant_action, tenant_idempotency or
// tenant_effect runs in a transaction that first sets exactly one scope. The
// settings are transaction-local (`set_config(…, true)`), so a pooled connection
// never carries one into the next request. While RLS is off they change nothing;
// once rls-enable.sql has run, a statement outside a scope sees no store rows.

export type StoreScope =
  /** One tenant: everything on its own rows. */
  | { tenant: TenantId }
  /** The effects:drain poller (store_outbox_* functions, cresavo_outbox) or the retention sweeps (store_sweep_* functions, cresavo_sweeper). */
  | { crossTenant: "outbox" | "sweep" }
  /** Resolving a sandbox token: that sandbox's tenant_state row only, read only. */
  | { sandboxKey: string }
  /** Resolving a booking address: that salon's tenant_state row only, read only. */
  | { salonSlug: string };

export const OUTBOX_SCOPE: StoreScope = { crossTenant: "outbox" };
export const SWEEP_SCOPE: StoreScope = { crossTenant: "sweep" };

type Raw = Pick<PrismaClient, "$queryRaw">;

/** Sets all four settings, so the scope is exactly this one whatever the transaction set before. */
function setScope(db: Raw, scope: StoreScope) {
  const value = (key: string) => (key in scope ? String((scope as Record<string, string>)[key]) : "");
  return db.$queryRaw<unknown[]>`
    SELECT set_config('cresavo.tenant_id', ${value("tenant")}, true) AS tenant,
      set_config('cresavo.cross_tenant', ${value("crossTenant")}, true) AS cross_tenant,
      set_config('cresavo.sandbox_key', ${value("sandboxKey")}, true) AS sandbox_key,
      set_config('cresavo.salon_slug', ${value("salonSlug")}, true) AS salon_slug`;
}

/** Enters a scope inside an interactive transaction. Call it before the first store statement, and again to change scope. */
export async function enterScope(tx: Prisma.TransactionClient, scope: StoreScope): Promise<void> {
  await setScope(tx, scope);
}

/** One statement in its own transaction under `scope`. Build the statement from the `db` given. */
export function scoped<T>(prisma: PrismaClient, scope: StoreScope, statement: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return inScope(prisma, scope, statement);
}

/** An interactive transaction that starts in `scope`. */
export function inScope<T>(
  prisma: PrismaClient,
  scope: StoreScope,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: { maxWait?: number; timeout?: number },
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await enterScope(tx, scope);
    return run(tx);
  }, options);
}
