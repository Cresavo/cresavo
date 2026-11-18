// The one place the product and its assistant are named. Every user-facing
// mention reads from here (the i18n dictionary interpolates it), so a rename
// is a single edit plus the brand assets (wordmark, icons).
// `tests/brand.test.ts` fails when either name is written out anywhere else.

export const BRAND = {
  name: "Cresavo",
  tagline: "More time. On your terms.",
} as const;

/**
 * The assistant has no persona name: it is a tool, labelled in plain words
 * ("Assistant", Swedish "Assistent"), and the product brand stays the one name
 * owners learn. Decided after docs/design/ASSISTANT-AUDIT.md.
 */
export const ASSISTANT = {
  name: "Assistant",
} as const;

/**
 * Product policy for tenant pages (booking page, widget, gift card, my bookings).
 * They carry the business's identity only. Platform attribution ("Booking by …")
 * appears there only if the product owner switches this on; it is off by default.
 */
export const TENANT_POLICY = {
  attribution: false,
} as const;
