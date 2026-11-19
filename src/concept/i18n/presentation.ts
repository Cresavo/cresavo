import type { DemoState } from "../data/types";
import { getPack } from "../packs";
import { DEFAULT_CURRENCY } from "./business";
import { getCurrency, setCurrency } from "./format";
import { getActiveLocale, getVocabulary, setLocale, setVocabulary } from "./index";

// Activity summaries, payment descriptions and message text are written while
// the reducer runs, through the process-wide dictionary, vocabulary and
// currency. The browser sets those for the open salon (`ConceptLanguage`); a
// server store serving many tenants sets them per apply with this.

/** Runs a synchronous call with the tenant's language, vocabulary and currency, then restores the previous ones. */
export function withTenantPresentation<T>(state: DemoState, run: () => T): T {
  const previous = { language: getActiveLocale(), vocabulary: getVocabulary(), currency: getCurrency() };
  const language = state.localization?.language;
  setLocale(language === "sv" ? "sv" : "en");
  setVocabulary(getPack(state.pack).vocabulary);
  const currency = state.localization?.currency;
  setCurrency(typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_CURRENCY);
  try {
    return run();
  } finally {
    setLocale(previous.language);
    setVocabulary(previous.vocabulary);
    setCurrency(previous.currency);
  }
}
