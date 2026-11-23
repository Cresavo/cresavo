// Light, dark or the system's choice for the platform shell, saved per
// browser. <html data-theme> carries it; brand-theme.css pins light or dark
// and lets "system" follow the OS. The browser chrome (theme-color) follows
// the same choice. Tenant booking pages ignore it and keep their own chrome.

import { THEME_COLORS } from "./brand-assets";

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "ui-theme";
export const parseTheme = (value: unknown): ThemePreference => (THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : "system");

const PIN_ID = "theme-color-pin";

let keeper: MutationObserver | null = null;

/** Browsers use the first matching theme-color tag; Next may re-insert its own tags ahead of the pin. */
function keepFirst(pin = document.getElementById(PIN_ID)) {
  if (pin && document.head.querySelector('meta[name="theme-color"]') !== pin) document.head.prepend(pin);
}

/**
 * Pins the browser chrome to one colour, ahead of the page's own theme-color tags;
 * null removes the pin so those tags apply again.
 */
export function pinThemeColor(colour: string | null) {
  let pin = document.getElementById(PIN_ID) as HTMLMetaElement | null;
  if (!colour) {
    keeper?.disconnect();
    keeper = null;
    pin?.remove();
    return;
  }
  pin ??= Object.assign(document.createElement("meta"), { id: PIN_ID, name: "theme-color" });
  pin.content = colour;
  keepFirst(pin);
  keeper ??= new MutationObserver(() => keepFirst());
  keeper.observe(document.head, { childList: true });
}

/** The studio's masthead and sidebar colours (studio.css `.studio-chrome`), so a phone's status bar continues the masthead. */
const STUDIO_CHROME = { light: "#50364b", dark: "#120e17" } as const;

/** The studio's chrome colour for a choice; "system" follows the device's scheme at the time of asking. */
export const studioChrome = (theme: ThemePreference): string =>
  STUDIO_CHROME[theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme];

/**
 * Runs in <head> before first paint, so a saved dark theme never flashes light, and pins the
 * browser chrome to the saved theme. Only pages that carry the platform's own theme-color
 * (not tenant pages, which declare theirs) get the pin. Kept tiny and dependency-free.
 */
export const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}var p=t==="light"||t==="dark"?t:"system",d=document;d.documentElement.dataset.theme=p;if(p==="system"||!d.querySelector('meta[name="theme-color"][content="${THEME_COLORS.light}"]'))return;var m=d.createElement("meta");m.id="${PIN_ID}";m.name="theme-color";m.content=p==="dark"?"${THEME_COLORS.dark}":"${THEME_COLORS.light}";d.head.prepend(m)})()`;
