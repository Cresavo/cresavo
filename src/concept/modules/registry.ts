import type { TaskName } from "../ai/registry";
import type { ModuleKey } from "../data/types";
import type { MessageKey } from "../i18n";
import type { IntentAction } from "../intent";

/** A card on Today that a module owns. Cards without an owner are always shown. */
export type TodayCard = "stock-low" | "stock-delivery" | "holiday" | "quiet-day" | "gaps";

/**
 * What a module is: how it is named and priced, and every place it shows up.
 * Menus, Today cards, AI tasks and command box answers all read this list, so
 * switching a module off removes it everywhere at once.
 */
export interface ModuleManifest {
  id: ModuleKey;
  name: MessageKey;
  description: MessageKey;
  /** Menu pages that disappear when the module is off. */
  menu: string[];
  todayCards: TodayCard[];
  aiTasks: TaskName[];
  /** What the command box can do for it. */
  commands: IntentAction[];
  /** Demo price in SEK per month. */
  priceSek: number;
}

/** Calendar, customers, inbox and the booking page are always on. */
export const CORE_PRICE_SEK = 149;

export const MODULES: ModuleManifest[] = [
  { id: "journal", name: "features.journal", description: "features.journal.description", menu: [], todayCards: [], aiTasks: ["structure-journal", "summarize-customer"], commands: [], priceSek: 59 },
  { id: "stock", name: "features.stock", description: "features.stock.description", menu: ["/studio/more/stock"], todayCards: ["stock-low", "stock-delivery"], aiTasks: ["stock-forecast"], commands: ["order-stock", "sell-product", "stock-level"], priceSek: 79 },
  { id: "campaigns", name: "features.campaigns", description: "features.campaigns.description", menu: ["/studio/more/campaigns"], todayCards: ["holiday", "quiet-day"], aiTasks: ["suggest-campaign", "write-post"], commands: ["campaign", "make-poster"], priceSek: 99 },
  { id: "finance", name: "features.finance", description: "features.finance.description", menu: ["/studio/more/finance"], todayCards: [], aiTasks: [], commands: ["revenue"], priceSek: 69 },
  { id: "reviews", name: "features.reviews", description: "features.reviews.description", menu: ["/studio/more/reviews"], todayCards: [], aiTasks: ["reply-customer"], commands: [], priceSek: 39 },
  { id: "waitlist", name: "features.waitlist", description: "features.waitlist.description", menu: [], todayCards: ["gaps"], aiTasks: [], commands: [], priceSek: 39 },
  { id: "assistant", name: "features.assistant", description: "features.assistant.description", menu: ["/studio/more/memory", "/studio/more/routines"], todayCards: [], aiTasks: ["interpret-command", "daily-summary", "assistant-reply", "phrase-brief"], commands: [], priceSek: 149 },
  { id: "giftcards", name: "features.giftcards", description: "features.giftcards.description", menu: ["/studio/more/giftcards"], todayCards: [], aiTasks: [], commands: [], priceSek: 49 },
  { id: "domain", name: "features.domain", description: "features.domain.description", menu: [], todayCards: [], aiTasks: [], commands: [], priceSek: 49 },
  { id: "packages", name: "features.packages", description: "features.packages.description", menu: ["/studio/more/packages"], todayCards: [], aiTasks: [], commands: [], priceSek: 49 },
];

type Switches = Record<ModuleKey, boolean>;

export const moduleById = (id: ModuleKey) => MODULES.find((manifest) => manifest.id === id)!;

const ownerOf = <T>(list: (manifest: ModuleManifest) => T[], item: T) => MODULES.find((manifest) => list(manifest).includes(item));

/** True unless a module that owns this menu page is switched off. */
export function menuVisible(modules: Switches, href: string): boolean {
  const owner = ownerOf((m) => m.menu, href);
  return !owner || modules[owner.id];
}

export function cardVisible(modules: Switches, card: TodayCard): boolean {
  const owner = ownerOf((m) => m.todayCards, card);
  return !owner || modules[owner.id];
}

/** The switched-off module that blocks this command box action, if any. */
export function blockingModule(modules: Switches, action: IntentAction | "question"): ModuleManifest | undefined {
  const owner = MODULES.find((manifest) => (manifest.commands as string[]).includes(action));
  return owner && !modules[owner.id] ? owner : undefined;
}

export function taskEnabled(modules: Switches, task: TaskName): boolean {
  const owner = ownerOf((m) => m.aiTasks, task);
  return !owner || modules[owner.id];
}

export function enabledModules(modules: Switches): ModuleKey[] {
  return MODULES.filter((manifest) => modules[manifest.id]).map((manifest) => manifest.id);
}

/** What the business pays per month: the core plus every module that is on. */
export function monthlyTotal(on: readonly ModuleKey[]): number {
  return CORE_PRICE_SEK + MODULES.filter((manifest) => on.includes(manifest.id)).reduce((sum, manifest) => sum + manifest.priceSek, 0);
}
