import type { DemoState } from "../data/types";
import { t } from "../i18n";
import type { EngineResult } from "./engine";

// In a spoken conversation nothing changes until a tap on the screen. The
// changes the typed assistant makes at once ("remember…", "forget…", with
// Undo) become a card to approve instead.

export function deferChanges(outcome: EngineResult, state: Pick<DemoState, "memory">): EngineResult {
  const [effect] = outcome.effects;
  if (!effect) return outcome;
  const deferred = { ...outcome, effects: [] };
  if (effect.type === "memory/add") {
    return { ...deferred, reply: { ...outcome.reply, text: t("assistant.memory.offer"), card: { kind: "memory-offer", item: effect.item } } };
  }
  if (effect.type === "memory/forget") {
    const text = state.memory.find((item) => item.id === effect.id)?.text ?? "";
    const title = t("assistant.memory.forgetTitle", { text });
    return {
      ...deferred,
      reply: { ...outcome.reply, text: t("assistant.reply.change"), card: { kind: "change", title, rows: [], action: effect, toast: t("assistant.memory.forgotten", { text }), destructive: true } },
    };
  }
  // Any other direct change is left undone rather than made by voice.
  return { ...deferred, reply: { source: "rules", text: t("assistant.fallback") } };
}
