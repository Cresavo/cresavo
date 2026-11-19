/** Presentation only. Never use a locale to change booking rules or stored dates. */
export type Locale = "en" | "sv";
export const DEFAULT_LOCALE: Locale = "en";
export function parseLocale(value: unknown): Locale | null {
  return value === "en" || value === "sv" ? value : null;
}
export function intlLocale(locale: Locale) {
  return locale === "en" ? "en-GB" : "sv-SE";
}
export function text(locale: Locale, english: string, swedish: string) {
  return locale === "en" ? english : swedish;
}
/** Use the saved language choice when available. */
export function preferredLocale(
  cookie: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- browser preferences do not affect the default
  _acceptLanguage?: string | null,
): Locale {
  return parseLocale(cookie) ?? DEFAULT_LOCALE;
}
