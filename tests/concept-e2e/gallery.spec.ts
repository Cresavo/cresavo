import { expect, test, type Page } from "@playwright/test";
import type axe from "axe-core";
import { axeSource, axeTags } from "../../qa/axe-source.mjs";
import { translate } from "@/concept/i18n";

declare global { interface Window { axe: typeof axe } }

const en = (key: Parameters<typeof translate>[1]) => translate("en", key);
const source = axeSource();

async function audit(page: Page) {
  // Contrast is only meaningful once enter animations (sheet slide and fade, theme change) have settled.
  await page.waitForFunction(() => document.getAnimations()
    .every(a => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
  const violations = await page.evaluate(async tags => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: tags }, resultTypes: ["violations"],
    });
    return result.violations.map(v => ({ rule: v.id, nodes: v.nodes.map(n => ({ target: n.target, issue: n.failureSummary })) }));
  }, axeTags);
  expect(violations).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`gallery and consent are accessible in ${theme}`, async ({ page }, info) => {
    await page.goto("/studio/_gallery?lang=en");
    await expect(page.getByRole("heading", { name: en("gallery.title"), level: 1 })).toBeVisible();
    const appearance = page.getByRole("radiogroup", { name: en("theme.label") }).first();
    await appearance.getByRole("radio", { name: en(`theme.${theme}`), exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.evaluate(source);
    await audit(page);
    await info.attach(`gallery-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });

    const trigger = page.getByRole("button", { name: en("gallery.highRisk"), exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: en("gallery.highRisk") });
    const allow = dialog.getByRole("button", { name: en("gallery.allow") });
    await expect(allow).toBeDisabled();
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    await audit(page);
    await dialog.getByRole("checkbox").check();
    await expect(allow).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(allow).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await allow.click();
    await expect(dialog).toBeHidden();
    const notification = page.locator('[aria-live="polite"]').getByRole("button", { name: en("common.undo") });
    await notification.click();
    await expect(page.locator('[aria-live="polite"]').getByText(en("gallery.undone"))).toBeVisible();
  });
}

test("fits a 320 px viewport with reduced motion and scrolls only the option group", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/_gallery?lang=en");
  const group = page.getByRole("radiogroup", { name: en("gallery.row") });
  await group.getByRole("radio", { name: en("gallery.row") }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: en("gallery.sheet") })).toBeFocused();
  expect(await group.evaluate(el => el.parentElement!.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  const lastRow = page.getByRole("region", { name: en("gallery.layout") }).getByRole("link");
  await lastRow.focus();
  await expect(lastRow).toBeInViewport();
  const row = await lastRow.boundingBox();
  const save = await page.locator(".ui-action-bar").getByRole("button", { name: en("common.save") }).boundingBox();
  expect(row!.y + row!.height).toBeLessThanOrEqual(save!.y);
});
