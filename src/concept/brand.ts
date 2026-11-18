// The one place the product and its assistant are named. Every user-facing
// mention reads from here (the i18n dictionary interpolates it), so a rename
// is a single edit plus the brand assets (wordmark, icons).
// `tests/brand.test.ts` fails when either name is written out anywhere else.

export const BRAND = {
  name: "Cresavo",
  tagline: "More time. On your terms.",
} as const;

/**
 * The assistant's label, decoupled from BRAND so the product name can change
 * without it. Still the pre-rebrand name here; see docs/BRAND.md.
 */
export const ASSISTANT = {
  name: "Flerdo",
} as const;

/**
 * Product policy for tenant pages (booking page, widget, gift card, my bookings).
 * They carry the business's identity only. Platform attribution ("Booking by …")
 * appears there only if the product owner switches this on; it is off by default.
 */
export const TENANT_POLICY = {
  attribution: false,
} as const;
