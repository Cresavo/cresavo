import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { site } from "./en";
import { sv } from "./sv";

export const SiteLocale = createContext<Locale>(DEFAULT_LOCALE);

const dictionaries = { en: site, sv };

export function useSiteCopy() {
  const locale = useContext(SiteLocale);
  return { locale, site: dictionaries[locale] };
}
