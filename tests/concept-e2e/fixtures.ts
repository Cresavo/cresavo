import { createDemoState } from "../../src/concept/data/generate";
import type { DateKey, DemoState } from "../../src/concept/data/types";
import { translate, type MessageKey } from "../../src/concept/i18n";
import type { Page } from "@playwright/test";
import { getPack } from "../../src/concept/packs";

export function englishDemoState(today: DateKey) {
  return createDemoState(today, { localization: { language: "en", currency: "SEK", bilingual: false } });
}

export function fixtureText(state: Pick<DemoState, "pack" | "localization">) {
  return (key: MessageKey, vars?: Parameters<typeof translate>[2]) =>
    translate(state.localization.language, key, vars, getPack(state.pack).vocabulary);
}

/**
 * A workspace's saved salon as the page's store keeps it, or null. The one
 * place specs read stored state, so a storage change touches only this file.
 * It follows the store's key rules: the unsuffixed key holds whichever salon
 * was primary, the other one has its workspace suffix.
 */
export function salonState(page: Page, workspace: "demo" | "own" = "demo"): Promise<DemoState | null> {
  return page.evaluate((wanted) => {
    const base = "salong-eko-demo";
    const read = (key: string) => JSON.parse(localStorage.getItem(key) ?? "null");
    const primary = read(base)?.industry ? "own" : "demo";
    return read(wanted === primary ? base : `${base}-${wanted}`);
  }, workspace);
}
