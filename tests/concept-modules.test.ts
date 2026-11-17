import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { buildIntentContext } from "@/concept/command/intent-context";
import { commandExamples } from "@/concept/command/examples";
import { proposalFor, type Proposal } from "@/concept/command/proposal";
import { createDemoState, MODULE_KEYS } from "@/concept/data/generate";
import type { DemoState, ModuleKey } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { interpretCommand } from "@/concept/intent";
import {
  blockingModule,
  cardVisible,
  CORE_PRICE_SEK,
  enabledModules,
  menuVisible,
  MODULES,
  monthlyTotal,
  taskEnabled,
} from "@/concept/modules/registry";
import { tasks } from "@/concept/ai/registry";
import { waitlistCount } from "@/concept/studio/booking/waitlist-notice";
import { BUSINESS_NAV, visibleItems } from "@/concept/studio/nav";

const today = "2026-11-16";
const clock = { today, minutes: 9 * 60 };
const full = createDemoState(today);

const without = (state: DemoState, key: ModuleKey) => reduce(state, { type: "module/toggle", key });

function ask(state: DemoState, text: string): Proposal {
  const context = buildIntentContext(state, today, clock.minutes);
  return proposalFor(state, interpretCommand(text, context), text, clock, commandExamples(state, today));
}

describe("module registry", () => {
  it("has a manifest with a name and description for every module the state knows", () => {
    expect(MODULES.map((m) => m.id).sort()).toEqual([...MODULE_KEYS].sort());
    for (const manifest of MODULES) {
      expect(t(manifest.name)).not.toBe("");
      expect(t(manifest.description)).not.toBe("");
      expect(manifest.priceSek).toBeGreaterThan(0);
    }
  });

  it("lists only AI tasks that exist, and no task twice", () => {
    const listed = MODULES.flatMap((m) => m.aiTasks);
    expect(new Set(listed).size).toBe(listed.length);
    for (const task of listed) expect(Object.keys(tasks)).toContain(task);
  });

  it("hides the menu pages of a switched-off module and nothing else", () => {
    const off = without(full, "stock").modules;
    expect(menuVisible(off, "/studio/more/stock")).toBe(false);
    expect(menuVisible(off, "/studio/more/finance")).toBe(true);
    expect(menuVisible(off, "/studio/more/services")).toBe(true);
    const hrefs = visibleItems(BUSINESS_NAV, off).map((item) => item.href);
    expect(hrefs).not.toContain("/studio/more/stock");
    expect(hrefs).toContain("/studio/more/campaigns");
    expect(visibleItems(BUSINESS_NAV, full.modules).map((item) => item.href)).toContain("/studio/more/stock");
  });

  it("gates Today cards and AI tasks per module", () => {
    const off = without(without(full, "stock"), "campaigns").modules;
    expect(cardVisible(off, "stock-low")).toBe(false);
    expect(cardVisible(off, "stock-delivery")).toBe(false);
    expect(cardVisible(off, "holiday")).toBe(false);
    expect(cardVisible(off, "gaps")).toBe(true);
    expect(taskEnabled(off, "stock-forecast")).toBe(false);
    expect(taskEnabled(off, "write-post")).toBe(false);
    expect(taskEnabled(off, "reply-customer")).toBe(true);
  });

  it("adds up what you pay for the modules that are on", () => {
    expect(monthlyTotal([])).toBe(CORE_PRICE_SEK);
    const stock = MODULES.find((m) => m.id === "stock")!;
    expect(monthlyTotal(["stock"])).toBe(CORE_PRICE_SEK + stock.priceSek);
    expect(monthlyTotal(enabledModules(full.modules))).toBe(CORE_PRICE_SEK + MODULES.filter((m) => full.modules[m.id]).reduce((sum, m) => sum + m.priceSek, 0));
    expect(monthlyTotal(enabledModules(without(full, "stock").modules))).toBe(monthlyTotal(enabledModules(full.modules)) - stock.priceSek);
  });
});

describe("command box with modules switched off", () => {
  it("answers stock questions while Stock is on and explains when it is off", () => {
    expect(ask(full, "how much massage oil is left?").kind).toBe("stock");
    const proposal = ask(without(full, "stock"), "how much massage oil is left?");
    expect(proposal).toMatchObject({ kind: "message", link: { href: "/studio/more/features" } });
    expect(proposal.kind === "message" && proposal.text).toContain(t("features.stock"));
    expect(ask(without(full, "stock"), "order more foot cream").kind).toBe("message");
    const customer = full.customers.find((c) => full.customers.filter((o) => o.firstName === c.firstName).length === 1)!;
    expect(ask(full, `sold a foot cream to ${customer.firstName}`).kind).toBe("change");
    expect(ask(without(full, "stock"), `sold a foot cream to ${customer.firstName}`).kind).toBe("message");
  });

  it("blocks campaign and money questions only when their module is off", () => {
    expect(blockingModule(without(full, "campaigns").modules, "make-poster")?.id).toBe("campaigns");
    expect(blockingModule(full.modules, "make-poster")).toBeUndefined();
    expect(blockingModule(without(full, "finance").modules, "revenue")?.id).toBe("finance");
    expect(ask(without(full, "finance"), "What have I earned this month?").kind).toBe("message");
    expect(ask(full, "What have I earned this month?").kind).toBe("revenue");
    expect(ask(without(full, "campaigns"), "make a Father's Day campaign").kind).toBe("message");
  });

  it("keeps ordinary booking commands working", () => {
    const off = without(without(full, "stock"), "finance");
    expect(ask(off, "Which customers haven't been here since summer?").kind).toBe("customers");
  });

  it("drops the earnings example when Finance is off", () => {
    expect(commandExamples(full, today)).toContain("What have I earned this month?");
    expect(commandExamples(without(full, "finance"), today)).not.toContain("What have I earned this month?");
  });
});

describe("waiting list module", () => {
  it("offers a freed slot to nobody when the module is off", () => {
    const booking = full.bookings.find((b) => b.status === "booked" && b.date > today)!;
    expect(waitlistCount(full, booking)).toBeGreaterThan(0);
    expect(waitlistCount(without(full, "waitlist"), booking)).toBe(0);
  });
});
