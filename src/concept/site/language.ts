import type { Locale } from "@/lib/locale";

export function siteLocale(path: string): Locale {
  return path === "/sv" || path.startsWith("/sv/") ? "sv" : "en";
}

export function sitePath(locale: Locale, page: "home" | "privacy" = "home") {
  if (page === "privacy") return locale === "sv" ? "/sv/privacy" : "/privacy";
  return locale === "sv" ? "/sv" : "/";
}
