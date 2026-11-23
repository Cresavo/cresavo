import { PUBLIC_LOGO_URL } from "../../lib/media/limits";
import { buildTokens, isHex, mix, onColour, schemeOf, type Palette, type Tokens } from "./colour";

// The look of the booking page: logo, colours, fonts, corners and photo. A
// theme only ever becomes CSS variables and a few data attributes on the page
// root; it cannot change the structure of the booking flow.

const INTER = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

export const FONT_PAIRS = {
  modern: { heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  classic: { heading: 'Georgia, "Times New Roman", Times, serif', body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  soft: { heading: 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, system-ui, sans-serif', body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  elegant: { heading: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', body: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
  // The four below use web fonts that the booking and studio layouts load (app/page-fonts.ts); the rest of each stack is what shows until they arrive.
  warm: { heading: `var(--font-familjen), ${INTER}`, body: INTER },
  couture: { heading: 'var(--font-bodoni), "Didot", "Bodoni MT", Georgia, serif', body: INTER },
  statement: { heading: 'var(--font-barlow), "Arial Narrow", "Helvetica Neue", Arial, sans-serif', body: INTER },
  friendly: { heading: `var(--font-outfit), ${INTER}`, body: `var(--font-outfit), ${INTER}` },
} as const;

/**
 * A font stack for an image that is drawn and exported on its own (a poster): without the web font
 * the layouts load, which a standalone SVG or PNG cannot carry, so preview and export show the same face.
 */
export const standaloneFont = (stack: string): string => stack.replace(/^var\(--font-[a-z]+\),\s*/, "");

export type FontPairId = keyof typeof FONT_PAIRS;
export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS) as FontPairId[];

export const CORNERS = ["sharp", "soft", "round"] as const;
export type CornerStyle = (typeof CORNERS)[number];

/**
 * How the sections are drawn. "boxed": each in a card; "lined": flat, separated by rules, with small
 * capital section labels; "soft": borderless cards in a tint of the accent.
 */
export const STYLES = ["boxed", "lined", "soft"] as const;
export type PageStyle = (typeof STYLES)[number];

/** Photos from `public/demo` the page can use. */
export const PHOTOS = { salon: "/demo/salon.webp", massage: "/demo/massage.webp", hair: "/demo/hair.webp", barber: "/demo/barber.webp", nails: "/demo/nails.webp" } as const;
export type PhotoId = keyof typeof PHOTOS;
export const PHOTO_IDS = Object.keys(PHOTOS) as PhotoId[];

/** Ready-made palettes. No palette means the neutral default look (tenant-theme.css), never the platform's colours. */
export const PALETTES = {
  forest: { background: "#f7f4ef", text: "#212522", accent: "#2f5d50" },
  sand: { background: "#f6f1e9", text: "#3b3a36", accent: "#7a5c3e" },
  ink: { background: "#17181a", text: "#ece7dc", accent: "#c9a45c" },
  rose: { background: "#faf1ef", text: "#3d2f30", accent: "#a14a5b" },
  sky: { background: "#f1f6fa", text: "#1f2f3b", accent: "#2d6a9f" },
  linen: { background: "#faf7f2", text: "#24201c", accent: "#2b2622" },
  peony: { background: "#fff4f1", text: "#3a2430", accent: "#b93a66" },
} as const satisfies Record<string, Palette>;

export type PaletteId = keyof typeof PALETTES;
export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

export const MAX_LOGO_LENGTH = 90_000;
const LOGO = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
/** An account's uploaded logo, served by the app at its id and hash (src/lib/media/limits.ts). */
const isLogo = (logo: string) => LOGO.test(logo) || PUBLIC_LOGO_URL.test(logo);

export interface PageTheme {
  /** A small image as a data URL, the address of an account's uploaded logo, or null for the product's leaf mark. */
  logo: string | null;
  /** Up to three colours picked from the logo, offered as accents. */
  logoColors: string[];
  /** null = the neutral default look, which also follows the visitor's light or dark setting. */
  colors: Palette | null;
  fonts: FontPairId;
  corners: CornerStyle;
  style: PageStyle;
  heroPhoto: PhotoId;
}

export const DEFAULT_THEME: PageTheme = { logo: null, logoColors: [], colors: null, fonts: "modern", corners: "soft", style: "boxed", heroPhoto: "salon" };

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/** A theme from untrusted input (stored state, a model's suggestion): unknown or invalid parts fall back to the default. */
export function normalizeTheme(input: Partial<PageTheme> | undefined): PageTheme {
  const colors = input?.colors;
  return {
    logo: typeof input?.logo === "string" && input.logo.length <= MAX_LOGO_LENGTH && isLogo(input.logo) ? input.logo : null,
    logoColors: Array.isArray(input?.logoColors) ? input.logoColors.filter(isHex).slice(0, 3).map((c) => c.toLowerCase()) : [],
    colors: colors && isHex(colors.background) && isHex(colors.text) && isHex(colors.accent) ? { background: colors.background.toLowerCase(), text: colors.text.toLowerCase(), accent: colors.accent.toLowerCase() } : null,
    fonts: pick(input?.fonts, FONT_PAIR_IDS, DEFAULT_THEME.fonts),
    corners: pick(input?.corners, CORNERS, DEFAULT_THEME.corners),
    style: pick(input?.style, STYLES, DEFAULT_THEME.style),
    heroPhoto: pick(input?.heroPhoto, PHOTO_IDS, DEFAULT_THEME.heroPhoto),
  };
}

const TOKEN_VARS: Record<keyof Tokens, string> = {
  bg: "--ui-bg", surface: "--ui-surface", sunken: "--ui-surface-2", line: "--ui-border", ink: "--ui-text", muted: "--ui-text-secondary",
  accent: "--ui-action", accentSoft: "--ui-action-bg", onAccent: "--ui-action-text",
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
  for (const key of Object.keys(TOKEN_VARS) as (keyof Tokens)[]) vars[TOKEN_VARS[key]] = tokens[key];
  // Move away from the button label's colour to preserve its contrast on hover.
  vars["--ui-action-hover"] = mix(tokens.accent, onColour(tokens.onAccent), 0.15);
  vars.colorScheme = schemeOf(tokens);
  return vars;
}

/** The ready-made palette these colours are, if they are one. */
export function paletteIdOf(colors: Palette | null): PaletteId | null {
  return PALETTE_IDS.find((id) => colors && PALETTES[id].background === colors.background && PALETTES[id].accent === colors.accent && PALETTES[id].text === colors.text) ?? null;
}
