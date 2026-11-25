import { createDemoState } from "../../src/concept/data/generate";
import type { DateKey, DemoState } from "../../src/concept/data/types";
import { translate, type MessageKey } from "../../src/concept/i18n";
import type { Locator, Page } from "@playwright/test";
import { getPack } from "../../src/concept/packs";

export function englishDemoState(today: DateKey) {
  return createDemoState(today, { localization: { language: "en", currency: "SEK", bilingual: false } });
}

/**
 * The demo with "Let customers pay at the salon" switched on: for journeys about the confirm path and
 * changing a visit online afterwards, which a visit paid when booking leaves to the salon.
 */
export function payingAtSalon(state: DemoState): DemoState {
  return { ...state, cancellationPolicy: { ...state.cancellationPolicy, payAtSalonDefault: true } };
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

/**
 * Finishes a booking form on a salon that takes the full price when booking (the default): continue to
 * the payment and pay by simulated card. `text` is the page's language; the default is English.
 */
export async function continueAndPay(scope: Page | Locator, text: (key: MessageKey, vars?: Record<string, string | number>) => string = (key, vars) => translate("en", key, vars)) {
  await scope.getByRole("button", { name: text("protection.continue"), exact: true }).click();
  const prefix = text("protection.pay", { amount: "\u0000" }).split("\u0000")[0];
  await scope.getByRole("button", { name: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
}
