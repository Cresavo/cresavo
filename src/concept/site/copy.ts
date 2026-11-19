import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { channelExamples, site } from "./en";
import { channelExamples as swedishExamples, sv } from "./sv";

export const SiteLocale = createContext<Locale>(DEFAULT_LOCALE);

const dictionaries = {
  en: { site, channelExamples },
  sv: { site: sv, channelExamples: swedishExamples },
};

export function useSiteCopy() {
  const locale = useContext(SiteLocale);
  return { locale, ...dictionaries[locale] };
}
