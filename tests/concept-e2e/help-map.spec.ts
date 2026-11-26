import { expect, test, type Page } from "@playwright/test";
import { HELP_MAP, helpEntry } from "../../src/concept/help/map/entries";
import type { HelpEntry } from "../../src/concept/help/map/types";
import { INTERACTIVE } from "../../src/concept/help/pointer/dom";

// Every place in the "Show me" help map renders its `data-help-id` anchor in the real studio. An entry that needs a
// click on its own page first (a booking's buttons need the booking open) follows those steps of its path, so the
// paths are checked too. The source-level check is tests/concept-help-map.test.ts.

const NOW = new Date("2026-11-17T11:00:00+01:00");
/** Entries the guide presses on the way to another: their anchor must be the control itself, not a wrapper. */
const STEPS = new Set(HELP_MAP.flatMap((entry) => entry.path));

/** The page to open and the steps to click there before the entry's element shows. */
function plan(entry: HelpEntry): { start: string; openers: HelpEntry[] } {
  let start = entry.global ? "/studio" : entry.route;
  const openers: HelpEntry[] = [];
  for (const id of [...entry.path].reverse()) {
    const step = helpEntry(id)!;
    const samePage = entry.global ? !!step.global : !step.global && step.route === entry.route;
    const concrete = !start.includes("[");
    if (concrete && !samePage) break;
    openers.unshift(step);
    if (!concrete && !step.global && !step.route.includes("[")) start = step.route;
  }
  return { start, openers };
}

/** Visible anchors of an entry; `prefer` picks which of several to open on the way (a finished visit), as the guide does. */
const anchor = (page: Page, entry: HelpEntry) => {
  const all = page.locator(`[data-help-id="${entry.id}"]:visible`);
  const preferred = entry.prefer ? page.locator(`[data-help-id="${entry.id}"][data-help-state~="${entry.prefer}"]:visible`) : null;
  return { all, preferred };
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => localStorage.setItem("studio-tour-seen-v1", "1"));
});

for (const entry of HELP_MAP) {
  test(`help map: ${entry.id}`, async ({ page }, info) => {
    const desktop = info.project.name === "desktop";
    test.skip(entry.viewport ? (entry.viewport === "desktop") !== desktop : desktop, "Checked in the other layout.");
    const { start, openers } = plan(entry);
    await page.goto(start);
    for (const step of openers) {
      const { all, preferred } = anchor(page, { ...step, prefer: entry.prefer });
      // Wait for the page to draw before choosing: a slow page has no visits yet, and the first visit is not the one.
      await expect(all.first(), `${entry.id}: step ${step.id}`).toBeVisible({ timeout: 15000 });
      // Visits are tagged with what their sheet offers; like the guide, open only one that offers the action.
      const tagged = preferred && await all.first().evaluate((element) => element.hasAttribute("data-help-state"));
      const target = tagged ? preferred.first() : all.first();
      await expect(target, `${entry.id}: step ${step.id} offering ${entry.prefer}`).toBeVisible({ timeout: 15000 });
      await target.click();
    }
    const shown = anchor(page, entry).all;
    await expect(shown.first(), entry.id).toBeVisible({ timeout: 15000 });
    if (entry.safety === "navigate" && !entry.pointOnly) {
      // "Take me there" presses it: the anchor is one control, or holds exactly one.
      const pressable = await shown.first().evaluate((element, selector) =>
        element.matches(selector) || element.querySelectorAll(selector).length === 1, INTERACTIVE);
      expect(pressable, `${entry.id}: anchor one control or flag it pointOnly`).toBe(true);
    }
    if (STEPS.has(entry.id)) {
      const controls = await shown.evaluateAll((elements, selector) => elements.map((element) => element.matches(selector)), INTERACTIVE);
      expect(controls, `${entry.id} is a step the guide presses: anchor the control itself`).not.toContain(false);
    }
  });
}
