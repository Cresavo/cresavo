// Light, dark or the system's choice for the platform shell, saved per
// browser. <html data-theme> carries it; libovo-theme.css pins light or dark
// and lets "system" follow the OS. Tenant booking pages ignore it.

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "ui-theme";
export const parseTheme = (value: unknown): ThemePreference => (THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : "system");

/** Runs in <head> before first paint, so a saved dark theme never flashes light. Kept tiny and dependency-free. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});document.documentElement.dataset.theme=t==="light"||t==="dark"?t:"system"}catch(e){document.documentElement.dataset.theme="system"}`;
