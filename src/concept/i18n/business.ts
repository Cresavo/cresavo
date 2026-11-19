import type { Locale } from "@/lib/locale";
import type { PackId } from "../data/types";

export interface BusinessLocalization {
  language: Locale;
  bilingual: boolean;
  currency: string;
}

export const DEFAULT_BOOKING_LANGUAGE: Locale = "sv";
export const DEFAULT_CURRENCY = "SEK";

export function defaultBusinessLocalization(pack: PackId): BusinessLocalization {
  return { language: pack === "foot-massage" ? DEFAULT_BOOKING_LANGUAGE : "en", bilingual: false, currency: DEFAULT_CURRENCY };
}
