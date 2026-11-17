// Colour maths for the booking page theme: WCAG contrast and the nudges that
// make a chosen palette readable. Colours are "#rrggbb" strings.

export type Rgb = [number, number, number];

export const isHex = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export function toRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** The "r g b" form the design tokens use. */
export const channels = (hex: string) => toRgb(hex).join(" ");

export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `amount` of `b` mixed into `a`. */
export function mix(a: string, b: string, amount: number): string {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(x.map((v, i) => v + (y[i] - v) * amount) as Rgb);
}

const worst = (fg: string, backgrounds: readonly string[]) => Math.min(...backgrounds.map((bg) => contrast(fg, bg)));

/**
 * The colour closest to `fg` (same hue, moved towards black or white, whichever
 * gets there with the smaller change) that reads at `min` against every
 * background. Returns `fg` when it already does, and the better of black and
 * white when nothing in between can.
 */
export function readable(fg: string, backgrounds: readonly string[], min: number): string {
  if (worst(fg, backgrounds) >= min) return fg;
  const darkFirst = backgrounds.reduce((sum, bg) => sum + luminance(bg), 0) / backgrounds.length > 0.4;
  const targets = darkFirst ? ["#000000", "#ffffff"] : ["#ffffff", "#000000"];
  for (let step = 1; step <= 100; step++) {
    const hit = targets.map((target) => mix(fg, target, step / 100)).find((candidate) => worst(candidate, backgrounds) >= min);
    if (hit) return hit;
  }
  return targets.reduce((best, target) => (worst(target, backgrounds) > worst(best, backgrounds) ? target : best));
}

/** Black or white, whichever reads better on `bg`. */
export const onColour = (bg: string) => (contrast("#ffffff", bg) >= contrast("#000000", bg) ? "#ffffff" : "#000000");

const AA = 4.5;

export interface Palette {
  background: string;
  text: string;
  accent: string;
}

/** What the page uses, one value per design token. */
export interface Tokens {
  bg: string;
  surface: string;
  sunken: string;
  line: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
}

export interface Adjustment {
  role: keyof Palette;
  from: string;
  to: string;
}

function tokensFor(palette: Palette, flat: boolean): { tokens: Tokens; adjustments: Adjustment[] } {
  const light = luminance(palette.background) > 0.4;
  const bg = palette.background;
  const surface = flat ? bg : light ? mix(bg, "#ffffff", 0.65) : mix(bg, "#ffffff", 0.07);
  const sunken = flat ? bg : light ? mix(bg, "#000000", 0.04) : mix(bg, "#000000", 0.2);
  const grounds = [bg, surface, sunken];
  const ink = readable(palette.text, grounds, AA);
  const muted = readable(mix(ink, bg, 0.38), grounds, AA);
  // The soft background is tinted with the accent, so the two settle together.
  let accent = readable(palette.accent, grounds, AA);
  const soften = (colour: string) => (flat ? bg : mix(colour, surface, 0.88));
  let accentSoft = soften(accent);
  for (let round = 0; round < 8 && worst(accent, [...grounds, accentSoft]) < AA; round++) {
    accent = readable(accent, [...grounds, accentSoft], AA);
    accentSoft = soften(accent);
  }
  const adjustments: Adjustment[] = [];
  if (ink.toLowerCase() !== palette.text.toLowerCase()) adjustments.push({ role: "text", from: palette.text, to: ink });
  if (accent.toLowerCase() !== palette.accent.toLowerCase()) adjustments.push({ role: "accent", from: palette.accent, to: accent });
  return {
    tokens: { bg, surface, sunken, line: mix(ink, bg, 0.86), ink, muted, accent, accentSoft, onAccent: onColour(accent) },
    adjustments,
  };
}

/**
 * Turns three chosen colours into the full token set, nudging text and accent
 * until every text/background pair the page uses reaches WCAG AA (4.5:1). The
 * list says which of the chosen colours had to change, so the owner sees why.
 * A background in the middle of the range leaves no room for a lighter card
 * and a darker well at once; then the page is flat, which always works.
 */
export function buildTokens(palette: Palette): { tokens: Tokens; adjustments: Adjustment[] } {
  const layered = tokensFor(palette, false);
  return contrastReport(layered.tokens).every((row) => row.ratio >= AA) ? layered : tokensFor(palette, true);
}

/** Which text/background pairs the page relies on and their ratios, for the owner-facing check. */
export function contrastReport(tokens: Tokens): { label: "text" | "muted" | "accent" | "button"; ratio: number }[] {
  return [
    { label: "text", ratio: worst(tokens.ink, [tokens.bg, tokens.surface, tokens.sunken]) },
    { label: "muted", ratio: worst(tokens.muted, [tokens.bg, tokens.surface, tokens.sunken]) },
    { label: "accent", ratio: worst(tokens.accent, [tokens.bg, tokens.surface, tokens.sunken, tokens.accentSoft]) },
    { label: "button", ratio: contrast(tokens.onAccent, tokens.accent) },
  ];
}
