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

test("Search finds a customer and a day, and remembers what was opened", async ({ page }) => {
  const customer = fixture.customers[0];
  await page.goto("/studio");
  const search = page.getByRole("dialog", { name: "Search" });
  await expect(async () => {
    await page.keyboard.press("Control+K");
    await expect(search).toBeVisible({ timeout: 1000 });
  }).toPass();
  const field = search.getByRole("combobox");
  await expect(field).toBeFocused();
  await field.fill(`${customer.firstName} ${customer.lastName}`);
  await expect(search.getByRole("option").first()).toContainText(customer.firstName);
  await field.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/studio/customers/${customer.id}$`));

  await page.keyboard.press("Control+K");
  await expect(search.getByRole("group", { name: "Recent" })).toContainText(customer.firstName);
  await field.fill("tomorrow");
  await field.press("Enter");
  await expect(page.getByRole("heading", { name: "Wednesday 18 November" })).toBeVisible();
});
