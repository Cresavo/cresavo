import { expect, test } from "@playwright/test";
import { englishDemoState } from "./fixtures";

const fixture = englishDemoState("2026-11-17");

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, fixture);
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
});

test("the calendar's Month button shows a month to jump to a day and hides it again", async ({ page }) => {
  await page.goto("/studio/calendar");
  const month = page.getByRole("button", { name: "Month", exact: true });
  await expect(month).toHaveAttribute("aria-expanded", "false");
  await month.click();
  const days = page.getByRole("group", { name: "Days of the month" });
  await expect(days.getByRole("button", { pressed: true })).toHaveAttribute("data-date", "2026-11-17");
  await days.locator('[data-date="2026-11-20"]').click();
  await expect(page.getByRole("heading", { name: "Friday 20 November" })).toBeVisible();
  // Arrows move between days; Enter picks one.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Saturday 21 November" })).toBeVisible();
  await month.click();
  await expect(days).toHaveCount(0);
});
