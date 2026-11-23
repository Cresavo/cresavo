import { publicSalonView } from "@/concept/booking/public-projection";
import type { DemoState } from "@/concept/data/types";
import { resolveHost } from "@/concept/page/resolve";
import { checkSlug } from "@/concept/page/slug";
import { siteRequestHost } from "@/concept/site/request-host";
import { migrateSaved } from "@/concept/store/studio-store";
import { scoped } from "@/concept/store/tenant-scope";
import type { PrismaClient } from "@prisma/client";
import { issuedAtToken } from "./public-issued-at";
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
 * The tenant id of the salon with this booking address, through the fixed function store_salon_by_slug: an address
 * reveals which tenant it is and nothing of the salon's row. Then the salon is read in that tenant's scope.
 */
async function salonBySlug(db: PrismaClient, slug: string): Promise<string | null> {
  const [row] = await db.$queryRaw<Array<{ tenant_id: string | null }>>`SELECT store_salon_by_slug(${slug}) AS tenant_id`;
  return row?.tenant_id ?? null;
}

/**
 * The tenant of any salon with this booking address, or null. Used to hand out
 * addresses, so a salon whose owner account is switched off still holds its own.
 */
export async function findSalonTenant(slug: string): Promise<string | null> {
  const checked = checkSlug(slug);
  if (!checked.ok) return null;
  const { db } = await import("./db");
  return salonBySlug(db, checked.slug);
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
  const tenantId = await salonBySlug(db, checked.slug);
  if (!tenantId) return null;
  // The salon in its own scope, every condition checked again in this one read: a rename or a switched-off account
  // since the lookup finds nothing.
  const [row] = await scoped(db, { tenant: tenantId }, (tx) => tx.$queryRaw<Array<{ tenant_id: string; doc: unknown }>>`
    SELECT t.tenant_id, t.doc FROM tenant_state t JOIN owner_account a ON a.tenant_id = t.tenant_id
    WHERE t.tenant_id = ${tenantId} AND t.kind = 'salon' AND a.active AND (t.expires_at IS NULL OR t.expires_at > ${now})
      AND (t.doc #>> '{salon,slug}') = ${checked.slug}`);
  const state = row && migrateSaved(row.doc);
  return state ? { tenantId: row.tenant_id, state } : null;
}

/** What a customer may see of the salon with this booking address, with the form-time token of its booking form, or null. */
export async function loadPublicSalon(slug: string, now = new Date()): Promise<{ state: DemoState; issuedAt: string } | null> {
  const found = await loadPublicTenant(slug, now);
  return found && { state: publicSalonView(found.state, now), issuedAt: issuedAtToken(found.tenantId, found.state.salon.slug, now.getTime()) };
}
