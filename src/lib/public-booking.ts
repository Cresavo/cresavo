import { publicSalonView } from "@/concept/booking/public-projection";
import type { DemoState } from "@/concept/data/types";
import { resolveHost } from "@/concept/page/resolve";
import { checkSlug } from "@/concept/page/slug";
import { siteRequestHost } from "@/concept/site/request-host";
import { migrateSaved } from "@/concept/store/studio-store";
import { isPublicReadonly } from "./public-readonly";

// Public booking on the studio store (ADR 1, stage 2). Off unless
// PUBLIC_BOOKING_LIVE=1 and owner accounts are on (salons only exist then), so
// no customer-facing route exists until the pilot gate in
// docs/QUALITY_SECURITY.md is passed. The database is imported only when a
// lookup runs, so the demo deployment needs none.

/** The public demo build has no database, whatever PUBLIC_READONLY says. */
const demoBuild = () => process.env.NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO === "1";

/** Read-only deployments, and the demo build always. */
export const publicReadonly = () => demoBuild() || isPublicReadonly();

/**
 * True when this request is served from the server's salons: both flags on,
 * not the demo build, and not the demo's own host. Decided before any rate
 * store or database access; everything else is the demo on browser state.
 */
export function publicBookingLive(readHeader: (name: string) => string | null | undefined): boolean {
  // Not ownerAccountsEnabled(): that module loads the database.
  if (process.env.PUBLIC_BOOKING_LIVE !== "1" || process.env.OWNER_ACCOUNTS_ENABLED !== "1" || publicReadonly()) return false;
  const host = resolveHost(siteRequestHost(readHeader));
  return !(host.kind === "site" && host.site === "demo");
}

/**
 * The tenant of any salon with this booking address, or null. Used to hand out
 * addresses, so a salon whose owner account is switched off still holds its own.
 */
export async function findSalonTenant(slug: string): Promise<string | null> {
  const checked = checkSlug(slug);
  if (!checked.ok) return null;
  const { db } = await import("./db");
  const [row] = await db.$queryRaw<Array<{ tenant_id: string }>>`
    SELECT tenant_id FROM tenant_state WHERE kind = 'salon' AND (doc #>> '{salon,slug}') = ${checked.slug}`;
  return row?.tenant_id ?? null;
}

/**
 * The tenant and full document of the salon with this booking address, or
 * null. One query resolves the current address, an active owner account, the
 * kind, the expiry and the document, so a rename or a switched-off account is
 * never served from a second read. The document is for the server's own rules
 * and never leaves it: send `publicSalonView` of it.
 */
export async function loadPublicTenant(slug: string, now = new Date()): Promise<{ tenantId: string; state: DemoState } | null> {
  const checked = checkSlug(slug);
  if (!checked.ok) return null;
  const { db } = await import("./db");
  const [row] = await db.$queryRaw<Array<{ tenant_id: string; doc: unknown }>>`
    SELECT t.tenant_id, t.doc FROM tenant_state t JOIN owner_account a ON a.tenant_id = t.tenant_id
    WHERE t.kind = 'salon' AND a.active AND (t.expires_at IS NULL OR t.expires_at > ${now})
      AND (t.doc #>> '{salon,slug}') = ${checked.slug}`;
  const state = row && migrateSaved(row.doc);
  return state ? { tenantId: row.tenant_id, state } : null;
}

/** What a customer may see of the salon with this booking address, or null. */
export async function loadPublicSalon(slug: string, now = new Date()): Promise<DemoState | null> {
  const found = await loadPublicTenant(slug, now);
  return found && publicSalonView(found.state, now);
}
