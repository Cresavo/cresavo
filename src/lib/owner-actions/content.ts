import { z } from "zod";
import { MAX_ABOUT_HEADING, MAX_ABOUT_TEXT } from "@/concept/page/about";
import { MAX_CSS_LENGTH } from "@/concept/page/css";
import { isHex } from "@/concept/page/colour";
import { SECTION_KINDS, variantsOf } from "@/concept/page/sections";
import { CORNERS, FONT_PAIR_IDS, STYLES, MAX_LOGO_LENGTH, normalizeTheme, PHOTO_IDS, type FontPairId, type PhotoId } from "@/concept/page/theme";
import { SLUG_MAX, SLUG_MIN } from "@/concept/page/slug";
import { list, text } from "./primitives";

// The booking page: its look, sections and address.

const MAX_INSTAGRAM = 200;
const hex = z.string().refine(isHex, "Not a colour");

const theme = z.strictObject({
  logo: text(MAX_LOGO_LENGTH).nullable().refine((logo) => logo === null || normalizeTheme({ logo }).logo === logo, "Not a small png, jpeg or webp image"),
  logoColors: list(hex, 3),
  colors: z.strictObject({ background: hex, text: hex, accent: hex }).nullable(),
  fonts: z.enum(FONT_PAIR_IDS as [FontPairId, ...FontPairId[]]),
  corners: z.enum(CORNERS),
  // An editor opened before the section style existed sends none; the reducer then keeps the stored one.
  style: z.enum(STYLES).optional(),
  heroPhoto: z.enum(PHOTO_IDS as [PhotoId, ...PhotoId[]]),
});

const kinds = Object.keys(SECTION_KINDS) as [keyof typeof SECTION_KINDS, ...(keyof typeof SECTION_KINDS)[]];

const section = z.strictObject({ kind: z.enum(kinds), variant: z.string() })
  .refine((entry) => variantsOf(entry.kind).includes(entry.variant), "Unknown variant");

const page = z.strictObject({
  theme,
  sections: list(section, kinds.length).refine((sections) => new Set(sections.map((entry) => entry.kind)).size === sections.length, "A section appears once"),
  instagram: text(MAX_INSTAGRAM),
  // An editor opened before the About text existed sends no `about`; the reducer then keeps the stored one.
  about: z.strictObject({ heading: text(MAX_ABOUT_HEADING), text: text(MAX_ABOUT_TEXT) }).optional(),
  css: text(MAX_CSS_LENGTH),
});

export const contentSchemas = {
  "page/set": z.strictObject({ type: z.literal("page/set"), page }),
  "salon/slug": z.strictObject({ type: z.literal("salon/slug"), slug: z.string().min(SLUG_MIN).max(SLUG_MAX).regex(/^[a-z0-9-]+$/) }),
};
