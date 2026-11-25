import type { Locale } from "@/lib/locale";

export function siteLocale(path: string): Locale {
  return path === "/sv" || path.startsWith("/sv/") ? "sv" : "en";
}

export type SitePage = "home" | "privacy" | "about" | "own-domain";

export function sitePath(locale: Locale, page: SitePage = "home") {
  const prefix = locale === "sv" ? "/sv" : "";
  if (page === "home") return prefix || "/";
  return `${prefix}/${page}`;
}
