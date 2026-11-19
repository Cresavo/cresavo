import { MODULE_KEYS, type BusinessSetup } from "../data/generate";
import type { DemoState, ModuleKey, PackId } from "../data/types";
import { getPack } from "../packs";

export type TeamSize = "solo" | "small" | "large";

/** What a new owner can ask for help with; each wish is one module. The command box is always on. */
export const HELP_WISHES = ["journal", "stock", "campaigns", "finance", "reviews", "waitlist"] as const satisfies readonly ModuleKey[];
export type HelpWish = (typeof HELP_WISHES)[number];

export interface Answers {
  pack: PackId;
  team: TeamSize;
  help: HelpWish[];
}

/**
 * The setup the three questions lead to. Without any wish the pack's usual
 * starting modules apply; otherwise exactly the wished modules are on. The demo
 * has a team of two, so "2 to 5" and "6 or more" both show that.
 */
export function setupFromAnswers({ pack, team, help }: Answers): BusinessSetup {
  const modules: ModuleKey[] = help.length ? [...help, "assistant"] : getPack(pack).modules;
  return { pack, solo: team === "solo", modules };
}

/** The setup a running demo was built from, so "Reset demo" rebuilds the same business. */
export function setupOf(state: DemoState): BusinessSetup {
  return {
    pack: state.pack,
    localization: state.localization,
    solo: state.staff.length === 1,
    modules: MODULE_KEYS.filter((key) => state.modules[key]),
  };
}
