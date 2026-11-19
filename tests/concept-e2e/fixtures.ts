import { createDemoState } from "../../src/concept/data/generate";
import type { DateKey, DemoState } from "../../src/concept/data/types";
import { translate, type MessageKey } from "../../src/concept/i18n";
import { getPack } from "../../src/concept/packs";

export function englishDemoState(today: DateKey) {
  return createDemoState(today, { localization: { language: "en", currency: "SEK", bilingual: false } });
}

export function fixtureText(state: Pick<DemoState, "pack" | "localization">) {
  return (key: MessageKey, vars?: Parameters<typeof translate>[2]) =>
    translate(state.localization.language, key, vars, getPack(state.pack).vocabulary);
}
