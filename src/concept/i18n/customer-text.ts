import type { DemoState } from "../data/types";
import { packOf } from "../packs";
import { translate, type MessageKey } from ".";

/** Customer messages follow the business language even when drafted in the owner's studio. */
export function customerText(state: Pick<DemoState, "localization" | "pack">, key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(state.localization.language, key, vars, packOf(state).vocabulary);
}
