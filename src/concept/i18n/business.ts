import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import type { PackId } from "../data/types";

export interface BusinessLocalization {
  language: Locale;
  bilingual: boolean;
  currency: string;
}

/** The product is international: English unless a business chooses another language. */
export const DEFAULT_BOOKING_LANGUAGE = DEFAULT_LOCALE;
export const DEFAULT_CURRENCY = "SEK";

export function defaultBusinessLocalization(pack: PackId): BusinessLocalization {
  // The demo salon (Salong Eko) also offers Swedish to visitors, to show that a page can be bilingual.
  return { language: DEFAULT_BOOKING_LANGUAGE, bilingual: pack === "foot-massage", currency: DEFAULT_CURRENCY };
}
