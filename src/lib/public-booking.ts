import { publicSalonView } from "@/concept/booking/public-projection";
import type { DemoState } from "@/concept/data/types";
import { checkSlug } from "@/concept/page/slug";
import { isPublicReadonly } from "./public-readonly";

// Public booking on the studio store (ADR 1, stage 2). Off unless
// PUBLIC_BOOKING_LIVE=1 and owner accounts are on (salons only exist then), so
// no customer-facing route exists until the pilot
// gate in docs/QUALITY_SECURITY.md is passed. The database is imported only
// when a lookup runs, so the demo deployment needs none.

export const publicBookingLive = () =>
  process.env.PUBLIC_BOOKING_LIVE === "1" && process.env.OWNER_ACCOUNTS_ENABLED === "1"; // not ownerAccountsEnabled(): that module loads the database

/**
 * The tenant of the salon with this booking address, or null. Demo and sandbox
 * tenants never match, and a tenant id is never taken from the client.
 */
export async function findSalonTenant(slug: string): Promise<string | null> {
  const checked = checkSlug(slug);
  if (!checked.ok) return null;
  const { db } = await import("./db");
  const [row] = await db.$queryRaw<Array<{ tenant_id: string }>>`
    SELECT tenant_id FROM tenant_state WHERE kind = 'salon' AND (doc #>> '{salon,slug}') = ${checked.slug}`;
  return row?.tenant_id ?? null;
}

/** What a customer may see of the salon with this booking address, or null when there is none. */
export async function loadPublicSalon(slug: string): Promise<DemoState | null> {
  const tenantId = await findSalonTenant(slug);
  const snapshot = tenantId && await (await import("./owner-store")).ownerStore().load(tenantId);
  return snapshot ? publicSalonView(snapshot.state) : null;
}

/**
 * The salon the booking page should render from the server, or null: switched
 * off, read-only, no such salon, or the store unavailable. The page then runs
 * on browser state, as the demo does.
 */
export async function serverSalonFor(slug: string): Promise<DemoState | null> {
  if (!publicBookingLive() || isPublicReadonly()) return null;
  return loadPublicSalon(slug).catch(() => null);
}
