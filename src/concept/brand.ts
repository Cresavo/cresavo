// The one place the product is named. Every user-facing mention reads from
// here (the i18n dictionary interpolates it), so a rename is a single edit.
// `tests/brand.test.ts` fails when the name is written out anywhere else.

export const BRAND = {
  name: "Flerdo",
  tagline: "Do more, click less.",
} as const;
