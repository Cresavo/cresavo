import { expect, test, type Page } from "@playwright/test";
import type axe from "axe-core";
import { axeSource, axeTags } from "../../qa/axe-source.mjs";
import { salonClock } from "../../src/concept/tools/clock";
import { englishDemoState } from "./fixtures";

// WCAG 2.2 AA sweep (axe tags in qa/axe-source.mjs, best-practice included) over the public
// pages, the booking journey and the studio, in light and dark, on the mobile and desktop projects.

declare global { interface Window { axe: typeof axe } }

const today = salonClock().today;
const initial = englishDemoState(today);
const source = axeSource();
const themes = ["light", "dark"] as const;
type Theme = (typeof themes)[number];

async function audit(page: Page, label: string) {
  // Contrast is only meaningful once enter animations (sheet slide and fade, theme change) have settled.
  await page.waitForFunction(() => document.getAnimations()
    .every(a => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
  if (!(await page.evaluate(() => "axe" in window))) await page.evaluate(source);
  const violations = await page.evaluate(async tags => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return result.violations.map(v => ({ rule: v.id, nodes: v.nodes.map(n => ({ target: n.target, issue: n.failureSummary })) }));
  }, axeTags);
  expect(violations, label).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${today}T08:30:00Z`));
  await page.addInitScript(state => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(state));
  }, initial);
});

async function setTheme(page: Page, theme: Theme) {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript(value => localStorage.setItem("ui-theme", value), theme);
}

for (const theme of themes) {
  test.describe(theme, () => {
    test.beforeEach(({ page }) => setTheme(page, theme));

    for (const [lang, path] of [["en", "/"], ["sv", "/sv"]] as const) {
      test(`product homepage (${lang})`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await audit(page, `home ${lang}`);
      });
    }

    test("public booking page and each booking step", async ({ page }) => {
      await page.goto("/boka/salong-eko?lang=en");
      await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
      await audit(page, "booking: start");

      await audit(page, "booking: treatments");
      await page.getByRole("button", { name: "Book Basic foot care" }).click();
      // The next free time is preselected; "Choose another time" is the time step.
      await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
      await audit(page, "booking: time and contact form");
      // The preselected time can be today, inside the online change cutoff, where the manage
      // page has no Cancel button: book the last offered day instead.
      const times = page.getByRole("combobox", { name: "Choose another time" });
      const later = await times.locator('optgroup').last().locator('option:not([value$="/wait"])').first().getAttribute("value");
      await times.selectOption(later!);

      await page.getByLabel("Your name", { exact: true }).fill("Access Demo");
      await page.getByLabel("Mobile number").fill("070-000 99 33");
      await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
      await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
      await audit(page, "booking: confirmation");

      const manage = page.locator('a[href*="/boka/salong-eko/booking/"]').first();
      await manage.click();
      await expect(page).toHaveURL(/\/booking\/[^/]+$/);
      await expect(page.getByRole("button", { name: "Cancel booking", exact: true })).toBeVisible();
      await audit(page, "booking: manage page");
    });

    test("studio pages and sheets", async ({ page }) => {
      await page.goto("/studio?lang=en");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, "studio today");

      await page.goto("/studio/calendar?lang=en");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, "studio calendar");

      await page.goto("/studio/customers?lang=en");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, "studio customers");
      await page.locator('a[href^="/studio/customers/"]:visible').first().click();
      await expect(page).toHaveURL(/\/studio\/customers\/[^/]+$/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, "studio customer page");

      await page.goto("/studio/more?lang=en");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, "studio more");
      await page.goto("/studio/more/settings?lang=en");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await audit(page, "studio settings");

      await page.goto("/studio?lang=en");
      await page.locator('[data-help="help-button"]:visible').first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, "studio help sheet");
      await page.locator('[data-help="whats-new"] button').click();
      await expect(page.getByRole("dialog", { name: "What's new" })).toBeVisible();
      await audit(page, "studio what's new sheet");
    });
  });
}
