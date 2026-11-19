import { createDemoState } from "../../src/concept/data/generate";
import type { DateKey } from "../../src/concept/data/types";

export function englishDemoState(today: DateKey) {
  return createDemoState(today, { localization: { language: "en", currency: "SEK", bilingual: false } });
}
