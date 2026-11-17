import { normalizePage, type PageConfig } from "./config";
import { addSection, moveToFirst, removeSection, type SectionKind } from "./sections";
import { PALETTES, type PageTheme } from "./theme";

// Reads "make it calmer and more luxurious", "put reviews first" or "use the
// colours from our logo" into a new page config. It only ever returns a
// config for the owner to review; the booking flow is not part of it.

const DEFAULT_COLOURS = { background: "#f7f4ef", text: "#212522", accent: "#2f5d50" };

const MOODS: Record<"calm" | "luxury" | "modern" | "warm", Partial<PageTheme>> = {
  calm: { colors: PALETTES.sand, fonts: "soft", corners: "round" },
  luxury: { colors: PALETTES.ink, fonts: "elegant", corners: "sharp" },
  modern: { colors: PALETTES.sky, fonts: "modern", corners: "soft" },
  warm: { colors: PALETTES.rose, fonts: "soft", corners: "round" },
};

const MOOD_WORDS: [keyof typeof MOODS, RegExp][] = [
  ["calm", /\b(calm(er)?|soft(er)?|peaceful|gentle|relax(ing|ed)?|quiet(er)?)\b/],
  ["luxury", /\b(lux(ury|urious)?|elegant|premium|exclusive|upscale|classy)\b/],
  ["modern", /\b(modern|clean(er)?|minimal(ist)?|fresh(er)?)\b/],
  ["warm", /\b(warm(er)?|cosy|cozy|friendly|friendlier)\b/],
];

const SECTION_WORDS: [SectionKind, RegExp][] = [
  ["giftcards", /\bgift ?cards?\b/],
  ["reviews", /\b(reviews?|testimonials?|ratings?)\b/],
  ["treatments", /\b(treatments?|prices?|price list|services?|menu)\b/],
  ["staff", /\b(staff|team|therapists?|our people)\b/],
  ["gallery", /\b(gallery|photos?|pictures?|images?)\b/],
  ["map", /\b(map|location|opening hours|hours|find us|address)\b/],
  ["faq", /\b(faq|questions)\b/],
  ["instagram", /\binstagram\b/],
];

const sectionIn = (text: string) => SECTION_WORDS.find(([, word]) => word.test(text))?.[0];

export type DesignRequest = { kind: "page"; page: PageConfig } | { kind: "needs-logo" };

/** The new config the text asks for, or null when the text is not about the booking page. */
export function designRequest(input: string, page: PageConfig): DesignRequest | null {
  const text = input.toLowerCase().replace(/’/g, "'").trim();
  let next = page;
  const theme = (patch: Partial<PageTheme>) => (next = { ...next, theme: { ...next.theme, ...patch } });

  const fromLogo = /\bcolou?rs?\b.*\blogo\b|\blogo\b.*\bcolou?rs?\b/.test(text);
  if (fromLogo) {
    const accent = page.theme.logoColors[0];
    if (!accent) return { kind: "needs-logo" };
    theme({ colors: { ...(page.theme.colors ?? DEFAULT_COLOURS), accent } });
  }

  const aboutPage = /\b(page|site|website|look|design|feel|style|theme|colou?rs?|fonts?|corners?)\b/.test(text) || /^(?:please |can you |could you )?(?:make|give|turn) it\b/.test(text);
  const moods = aboutPage && !fromLogo ? MOOD_WORDS.filter(([, word]) => word.test(text)).map(([mood]) => mood) : [];
  if (moods.includes("calm") && moods.includes("luxury")) theme({ colors: PALETTES.sand, fonts: "elegant", corners: "soft" });
  else if (moods.length) theme(MOODS[moods[0]]);
  else if (aboutPage && /\bdark(er)?\b/.test(text)) theme({ colors: PALETTES.ink });
  const corners = text.match(/\b(round(?:er)?|sharp(?:er)?|square)\b[^.]*\bcorners?\b|\bcorners?\b[^.]*\b(round(?:er)?|sharp(?:er)?|square)\b/);
  if (corners) theme({ corners: /round/.test(corners[0]) ? "round" : "sharp" });

  const first = text.match(/\b(?:put|move|show|place|bring|have)\s+(.+?)\s+(?:first|at the top|on top|before everything)\b/);
  const firstKind = first && sectionIn(first[1]);
  const verb = text.match(/\b(add|include|remove|hide|drop|delete|without)\b(.*)$/);
  const verbKind = verb && sectionIn(verb[2]);
  if (firstKind) next = { ...next, sections: moveToFirst(next.sections, firstKind) };
  else if (verb && verbKind) next = { ...next, sections: /^(add|include)$/.test(verb[1]) ? addSection(next.sections, verbKind) : removeSection(next.sections, verbKind) };

  const after = normalizePage(next);
  return JSON.stringify(after) === JSON.stringify(page) ? null : { kind: "page", page: after };
}
