// The sections of the booking page. Each kind appears at most once and has two
// looks. The booking flow itself is not a section: it always sits right after
// the first section (or on top when there is none) and cannot be changed.

export const SECTION_KINDS = {
  hero: ["photo", "plain"],
  treatments: ["list", "compact"],
  staff: ["cards", "names"],
  about: ["plain", "card"],
  reviews: ["cards", "quote"],
  gallery: ["grid", "strip"],
  map: ["full", "compact"],
  faq: ["open", "closed"],
  instagram: ["button", "link"],
  giftcards: ["check", "compact"],
} as const;

export type SectionKind = keyof typeof SECTION_KINDS;
export const SECTION_ORDER = Object.keys(SECTION_KINDS) as SectionKind[];

export interface PageSection {
  kind: SectionKind;
  variant: string;
}

export const DEFAULT_SECTIONS: PageSection[] = [
  { kind: "hero", variant: "photo" },
  { kind: "treatments", variant: "list" },
  { kind: "staff", variant: "cards" },
  { kind: "reviews", variant: "cards" },
  { kind: "map", variant: "full" },
  { kind: "giftcards", variant: "compact" },
];

/** The hero is always the first section: it is the top of the page. */
const pinHero = (sections: PageSection[]): PageSection[] => [...sections.filter((s) => s.kind === "hero"), ...sections.filter((s) => s.kind !== "hero")];

export const isKind = (value: unknown): value is SectionKind => typeof value === "string" && value in SECTION_KINDS;

export const variantsOf = (kind: SectionKind): readonly string[] => SECTION_KINDS[kind];

/** A list from untrusted input: unknown kinds and repeats are dropped, a wrong variant becomes the first one. */
export function normalizeSections(input: readonly Partial<PageSection>[] | undefined): PageSection[] {
  const seen = new Set<SectionKind>();
  const sections: PageSection[] = [];
  for (const item of Array.isArray(input) ? input : []) {
    if (!item || !isKind(item.kind) || seen.has(item.kind)) continue;
    seen.add(item.kind);
    sections.push({ kind: item.kind, variant: variantsOf(item.kind).includes(item.variant as string) ? (item.variant as string) : variantsOf(item.kind)[0] });
  }
  return pinHero(sections);
}

/** Kinds that are not on the page, in the order they are offered. */
export const availableKinds = (sections: readonly PageSection[]) => SECTION_ORDER.filter((kind) => !sections.some((s) => s.kind === kind));

export const addSection = (sections: readonly PageSection[], kind: SectionKind): PageSection[] =>
  sections.some((s) => s.kind === kind) ? [...sections] : pinHero([...sections, { kind, variant: variantsOf(kind)[0] }]);

/** Adds a section right after another one, or last when that one is not on the page. */
export function addSectionAfter(sections: readonly PageSection[], kind: SectionKind, after: SectionKind): PageSection[] {
  if (sections.some((s) => s.kind === kind)) return [...sections];
  const at = sections.findIndex((s) => s.kind === after);
  if (at < 0) return addSection(sections, kind);
  return pinHero([...sections.slice(0, at + 1), { kind, variant: variantsOf(kind)[0] }, ...sections.slice(at + 1)]);
}

export const removeSection = (sections: readonly PageSection[], kind: SectionKind): PageSection[] => sections.filter((s) => s.kind !== kind);

/** Moves a section one step up (-1) or down (+1); the ends stay put and nothing moves above the hero. */
export function moveSection(sections: readonly PageSection[], kind: SectionKind, step: -1 | 1): PageSection[] {
  const from = sections.findIndex((s) => s.kind === kind);
  const to = from + step;
  if (from < 0 || to < 0 || to >= sections.length) return [...sections];
  const next = [...sections];
  [next[from], next[to]] = [next[to], next[from]];
  return pinHero(next);
}

/** Puts one section first, adding it when it is missing: what "put reviews first" means. */
export function moveToFirst(sections: readonly PageSection[], kind: SectionKind): PageSection[] {
  const found = sections.find((s) => s.kind === kind);
  return pinHero([found ?? { kind, variant: variantsOf(kind)[0] }, ...sections.filter((s) => s.kind !== kind)]);
}

export const setVariant = (sections: readonly PageSection[], kind: SectionKind, variant: string): PageSection[] =>
  variantsOf(kind).includes(variant) ? sections.map((s) => (s.kind === kind ? { ...s, variant } : s)) : [...sections];
