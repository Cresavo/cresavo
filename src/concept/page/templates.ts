import { jsonEqual } from "../data/json-equal";
import { normalizePage, type PageConfig } from "./config";
import { addSectionAfter, type PageSection } from "./sections";
import { PALETTES, type PageTheme } from "./theme";

// Ready-made designs for the booking page. A template is nothing more than a
// theme and a list of sections the owner could have picked by hand, so it goes
// through the same checks and can be adjusted afterwards like any other page.

type TemplateTheme = Pick<PageTheme, "colors" | "fonts" | "corners" | "style" | "heroPhoto">;

export const TEMPLATES = {
  /** Calm and natural: treatments, foot care, massage, skin care. */
  eko: {
    theme: { colors: PALETTES.forest, fonts: "warm", corners: "soft", style: "boxed", heroPhoto: "salon" },
    sections: [
      { kind: "hero", variant: "cover" },
      { kind: "treatments", variant: "list" },
      { kind: "staff", variant: "cards" },
      { kind: "reviews", variant: "cards" },
      { kind: "map", variant: "full" },
      { kind: "giftcards", variant: "compact" },
    ],
  },
  /** Light and editorial: hairdressers and beauty salons. */
  atelier: {
    theme: { colors: PALETTES.linen, fonts: "couture", corners: "sharp", style: "lined", heroPhoto: "hair" },
    sections: [
      { kind: "hero", variant: "split" },
      { kind: "treatments", variant: "list" },
      { kind: "map", variant: "full" },
      { kind: "reviews", variant: "quote" },
      { kind: "staff", variant: "cards" },
      { kind: "gallery", variant: "grid" },
      { kind: "giftcards", variant: "compact" },
    ],
  },
  /** Dark with gold: barbers and premium studios. */
  noir: {
    theme: { colors: PALETTES.ink, fonts: "statement", corners: "sharp", style: "lined", heroPhoto: "barber" },
    sections: [
      { kind: "hero", variant: "cover" },
      { kind: "treatments", variant: "list" },
      { kind: "staff", variant: "cards" },
      { kind: "map", variant: "full" },
      { kind: "reviews", variant: "quote" },
      { kind: "giftcards", variant: "compact" },
    ],
  },
  /** Bright and rounded: nails, lashes and brows. */
  studio: {
    theme: { colors: PALETTES.peony, fonts: "friendly", corners: "round", style: "soft", heroPhoto: "nails" },
    sections: [
      { kind: "hero", variant: "split" },
      { kind: "treatments", variant: "list" },
      { kind: "map", variant: "full" },
      { kind: "staff", variant: "cards" },
      { kind: "reviews", variant: "cards" },
      { kind: "gallery", variant: "strip" },
      { kind: "faq", variant: "closed" },
      { kind: "giftcards", variant: "compact" },
    ],
  },
} as const satisfies Record<string, { theme: TemplateTheme; sections: readonly PageSection[] }>;

export type TemplateId = keyof typeof TEMPLATES;
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export const isTemplateId = (value: unknown): value is TemplateId => typeof value === "string" && Object.hasOwn(TEMPLATES, value);

/**
 * The page wearing a template. The logo, its colours, the Instagram name, the About text and the
 * owner's own CSS are theirs and stay. No design has an About section of its own, so a page that
 * shows one keeps it, after the team.
 */
export function applyTemplate(page: PageConfig, id: TemplateId): PageConfig {
  const { theme, sections } = TEMPLATES[id];
  const designed = sections.map((section) => ({ ...section }));
  const about = page.sections.find((section) => section.kind === "about");
  return normalizePage({ ...page, theme: { ...page.theme, ...theme }, sections: about ? addSectionAfter(designed, "about", "staff").map((section) => (section.kind === "about" ? { ...about } : section)) : designed });
}

/** The template this page is, when nothing in its look or sections has been changed since. */
export function templateIdOf(page: PageConfig): TemplateId | null {
  return TEMPLATE_IDS.find((id) => jsonEqual(applyTemplate(page, id), normalizePage(page))) ?? null;
}
