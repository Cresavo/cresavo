/** A salon document with an address of its own: salon rows may not share one, and every fixture uses the demo's. */
export function withOwnSlug<T>(saved: T, tenantId: string): T {
  const doc = saved as { salon?: object } | null;
  return doc && typeof doc === "object" && doc.salon ? { ...doc, salon: { ...doc.salon, slug: tenantId } } as T : saved;
}
