import { EMPTY_ABOUT, normalizeAbout, type PageAbout } from "./about";
import { MAX_CSS_LENGTH, sanitizeCss } from "./css";
import { DEFAULT_SECTIONS, normalizeSections, type PageSection } from "./sections";
import { DEFAULT_THEME, normalizeTheme, type PageTheme } from "./theme";

/** Everything the owner can change about the booking page. The booking flow is not part of it. */
export interface PageConfig {
  theme: PageTheme;
  sections: PageSection[];
  /** Instagram user name without the @, used by the Instagram section. */
  instagram: string;
  /** The owner's own CSS as typed. It is sanitised and scoped every time it is rendered (`pageCss`). */
  css: string;
  /** The business's own text, shown by the About section. */
  about: PageAbout;
  /** Set only by the server's public projection: `css` already sanitised and scoped, so the owner's raw text never leaves the server. */
  sanitizedCss?: string;
}

export const DEFAULT_PAGE: PageConfig = { theme: DEFAULT_THEME, sections: DEFAULT_SECTIONS, instagram: "", css: "", about: EMPTY_ABOUT };

const INSTAGRAM = /^[a-z0-9._]{1,30}$/;

/** "@Salong.Eko" or a profile link becomes "salong.eko"; anything else is empty. */
export function cleanInstagram(input: string): string {
  const name = input.trim().toLowerCase().replace(/^https?:\/\/(?:www\.)?instagram\.com\//, "").replace(/^@/, "").replace(/\/.*$/, "");
  return INSTAGRAM.test(name) ? name : "";
}

/** A config from untrusted input. This is the only way a config enters the state, so nothing unchecked is ever rendered. */
export function normalizePage(input: Partial<PageConfig> | undefined): PageConfig {
  return {
    theme: normalizeTheme(input?.theme),
    sections: input?.sections ? normalizeSections(input.sections) : DEFAULT_SECTIONS,
    instagram: cleanInstagram(typeof input?.instagram === "string" ? input.instagram : ""),
    css: typeof input?.css === "string" ? input.css.slice(0, MAX_CSS_LENGTH) : "",
    about: normalizeAbout(input?.about),
  };
}

export const hasSection = (page: PageConfig, kind: PageSection["kind"]) => page.sections.some((s) => s.kind === kind);

/** The owner's CSS as it reaches the page. */
export const pageCss = (page: PageConfig) => page.sanitizedCss ?? sanitizeCss(page.css);
