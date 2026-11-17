// The one place the product and its assistant are named. Every user-facing
// mention reads from here (the i18n dictionary interpolates it), so a rename
// is a single edit plus the brand assets (wordmark, icons).
// `tests/brand.test.ts` fails when either name is written out anywhere else.

export const BRAND = {
  name: "Libovo",
  tagline: "More time. Your terms.",
} as const;

/**
 * The assistant keeps the name it had before the Libovo rebrand ("Ask Flerdo")
 * until the product owner decides (pending decision, docs/design/LIBOVO.md).
 * Decoupled from BRAND so the product name can change without it.
 */
export const ASSISTANT = {
  name: "Flerdo",
} as const;
