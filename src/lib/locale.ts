/** Presentation only. Never use a locale to change booking rules or stored dates. */
export type Locale = "en" | "sv";
export function parseLocale(value: unknown): Locale | null {
  return value === "en" || value === "sv" ? value : null;
}
export function intlLocale(locale: Locale) {
  return locale === "en" ? "en-GB" : "sv-SE";
}
export function text(locale: Locale, english: string, swedish: string) {
  return locale === "en" ? english : swedish;
}
export function preferredLocale(
  cookie: unknown,
  acceptLanguage: string | null,
): Locale {
  const stored = parseLocale(cookie);
  if (stored) return stored;
  const first = acceptLanguage
    ?.split(",")[0]
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  return first === "sv" || first?.startsWith("sv-") ? "sv" : "en";
}
