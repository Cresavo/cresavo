import { bookingShare } from "../../booking/share";
import { onColour } from "../../page/colour";
import { dnsInstruction } from "../../page/domain";
import { PALETTES } from "../../page/theme";
import type { Locale } from "@/lib/locale";

// The code a salon copies from the own-domain page. Everything points at the
// demo salon's existing public booking URLs; nothing here is a new endpoint.

export const DEMO_SLUG = "salong-eko";
export const DEMO_SALON = "Salong Eko";

/** The button colours on offer: accents of the booking page's ready-made palettes. */
export const BUTTON_COLOURS = {
  forest: PALETTES.forest.accent,
  sand: PALETTES.sand.accent,
  ink: PALETTES.linen.accent,
  rose: PALETTES.rose.accent,
  sky: PALETTES.sky.accent,
} as const;

export type ButtonColour = keyof typeof BUTTON_COLOURS;
export const BUTTON_COLOUR_IDS = Object.keys(BUTTON_COLOURS) as ButtonColour[];

export const MAX_LABEL = 40;

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The button's look, shared by the live preview and the copied code so they never drift apart. */
export function buttonStyle(colour: ButtonColour) {
  const background = BUTTON_COLOURS[colour];
  return {
    display: "inline-block",
    padding: "12px 22px",
    borderRadius: "999px",
    background,
    color: onColour(background),
    font: "600 16px/1.2 system-ui, sans-serif",
    textDecoration: "none",
  };
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** One line of HTML: a link styled as a button that opens the salon's booking widget. */
export function buttonSnippet(origin: string, colour: ButtonColour, label: string, fallback: string) {
  const { widget } = bookingShare(origin, DEMO_SLUG, DEMO_SALON);
  const text = label.trim().slice(0, MAX_LABEL) || fallback;
  const style = Object.entries(buttonStyle(colour)).map(([key, value]) => `${kebab(key)}:${value}`).join(";");
  return `<a href="${widget}" target="_blank" rel="noopener" style="${escapeHtml(style)}">${escapeHtml(text)}</a>`;
}

/** The existing iframe snippet for the whole booking. */
export function embedSnippet(origin: string, locale: Locale) {
  return bookingShare(origin, DEMO_SLUG, DEMO_SALON, locale);
}

/** The DNS record for the example address, exactly as the studio's own-domain step shows it. */
export const exampleRecord = (host: string) => dnsInstruction(host);
