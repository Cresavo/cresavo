import { buildTokens, channels, isHex, luminance, type Palette, type Tokens } from "./colour";

// The look of the booking page: logo, colours, fonts, corners and photo. A
// theme only ever becomes CSS variables and a few data attributes on the page
// root; it cannot change the structure of the booking flow.

export const FONT_PAIRS = {
  modern: { heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  classic: { heading: 'Georgia, "Times New Roman", Times, serif', body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  soft: { heading: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, system-ui, sans-serif', body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  elegant: { heading: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', body: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
} as const;

export type FontPairId = keyof typeof FONT_PAIRS;
export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS) as FontPairId[];

export const CORNERS = ["sharp", "soft", "round"] as const;
export type CornerStyle = (typeof CORNERS)[number];

/** Photos from `public/demo` the page can use. */
export const PHOTOS = { salon: "/demo/salon.webp", massage: "/demo/massage.webp", hair: "/demo/hair.webp" } as const;
export type PhotoId = keyof typeof PHOTOS;
export const PHOTO_IDS = Object.keys(PHOTOS) as PhotoId[];

/** Ready-made palettes. `default` is the product's own look and sets nothing. */
export const PALETTES = {
  sand: { background: "#f6f1e9", text: "#3b3a36", accent: "#7a5c3e" },
  ink: { background: "#17181a", text: "#ece7dc", accent: "#c9a45c" },
  rose: { background: "#faf1ef", text: "#3d2f30", accent: "#a14a5b" },
  sky: { background: "#f1f6fa", text: "#1f2f3b", accent: "#2d6a9f" },
} as const satisfies Record<string, Palette>;

export type PaletteId = keyof typeof PALETTES;
export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

export const MAX_LOGO_LENGTH = 90_000;
const LOGO = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export interface PageTheme {
  /** A small image as a data URL, or null for the product's leaf mark. */
  logo: string | null;
  /** Up to three colours picked from the logo, offered as accents. */
  logoColors: string[];
  /** null = the product's default look, which also follows the visitor's light or dark setting. */
  colors: Palette | null;
  fonts: FontPairId;
  corners: CornerStyle;
  heroPhoto: PhotoId;
}

export const DEFAULT_THEME: PageTheme = { logo: null, logoColors: [], colors: null, fonts: "modern", corners: "soft", heroPhoto: "salon" };

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/** A theme from untrusted input (stored state, a model's suggestion): unknown or invalid parts fall back to the default. */
export function normalizeTheme(input: Partial<PageTheme> | undefined): PageTheme {
  const colors = input?.colors;
  return {
    logo: typeof input?.logo === "string" && input.logo.length <= MAX_LOGO_LENGTH && LOGO.test(input.logo) ? input.logo : null,
    logoColors: Array.isArray(input?.logoColors) ? input.logoColors.filter(isHex).slice(0, 3).map((c) => c.toLowerCase()) : [],
    colors: colors && isHex(colors.background) && isHex(colors.text) && isHex(colors.accent) ? { background: colors.background.toLowerCase(), text: colors.text.toLowerCase(), accent: colors.accent.toLowerCase() } : null,
    fonts: pick(input?.fonts, FONT_PAIR_IDS, DEFAULT_THEME.fonts),
    corners: pick(input?.corners, CORNERS, DEFAULT_THEME.corners),
    heroPhoto: pick(input?.heroPhoto, PHOTO_IDS, DEFAULT_THEME.heroPhoto),
  };
}

const TOKEN_VARS: Record<keyof Tokens, string> = {
  bg: "--eko-bg", surface: "--eko-surface", sunken: "--eko-sunken", line: "--eko-line", ink: "--eko-ink", muted: "--eko-muted",
  accent: "--eko-accent", accentSoft: "--eko-accent-soft", onAccent: "--eko-on-accent",
};

/** The CSS variables for the page root. Empty for the default look. */
export function themeVariables(theme: PageTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  if (theme.fonts !== DEFAULT_THEME.fonts) {
    vars["--page-font-heading"] = FONT_PAIRS[theme.fonts].heading;
    vars["--page-font-body"] = FONT_PAIRS[theme.fonts].body;
  }
  if (!theme.colors) return vars;
  const { tokens } = buildTokens(theme.colors);
  for (const key of Object.keys(TOKEN_VARS) as (keyof Tokens)[]) vars[TOKEN_VARS[key]] = channels(tokens[key]);
  vars.colorScheme = luminance(tokens.bg) > 0.4 ? "light" : "dark";
  return vars;
}

/** The ready-made palette these colours are, if they are one. */
export function paletteIdOf(colors: Palette | null): PaletteId | null {
  return PALETTE_IDS.find((id) => colors && PALETTES[id].background === colors.background && PALETTES[id].accent === colors.accent && PALETTES[id].text === colors.text) ?? null;
}
