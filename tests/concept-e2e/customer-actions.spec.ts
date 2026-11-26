import { expect, test, type Page } from "@playwright/test";
import { englishDemoState, fixtureText } from "./fixtures";

const today = "2026-11-17";
const fixture = englishDemoState(today);
const copy = fixtureText(fixture);
const customer = fixture.customers[0];

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, fixture);
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
});

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 640;

test("the customer's data actions sit behind one button on the customer card, grouped with the danger zone last", async ({ page }) => {
  await page.goto(`/studio/customers/${customer.id}`);
  const trigger = page.getByRole("button", { name: copy("customer.rights.title"), exact: true });
  await expect(trigger).toBeVisible();
  // Nothing of the old always-visible stack is on the page until the button is pressed.
  for (const key of ["customer.edit", "customer.export.json", "customer.export.csv", "customer.delete", "customer.erase"] as const) {
    await expect(page.getByRole("button", { name: copy(key), exact: true })).toHaveCount(0);
  }

  await trigger.click();
  const labels = [copy("customer.edit"), copy("customer.export.json"), copy("customer.export.csv"), copy("customer.delete"), copy("customer.erase")];
  const panel = isPhone(page) ? page.getByRole("dialog", { name: copy("customer.rights.title") }) : page.getByRole("menu", { name: copy("customer.rights.title") });
  const items = isPhone(page) ? panel.getByRole("button").filter({ hasText: /\S/ }) : panel.getByRole("menuitem");
  await expect(items).toHaveText(labels);
  await expect(panel.getByRole("separator")).toHaveCount(2);

  // A download still downloads.
  const download = page.waitForEvent("download");
  await items.filter({ hasText: copy("customer.export.json") }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);

  // Delete keeps its confirmation, and cancelling it returns to the button with nothing deleted.
  await trigger.click();
  await items.filter({ hasText: copy("customer.delete") }).click();
  const confirm = page.getByRole("dialog", { name: copy("customer.deleteTitle", { name: customer.firstName }) });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: copy("common.cancel"), exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/studio/customers/${customer.id}$`));

  // Erase still asks for the typed name before it can run.
  await trigger.click();
  await items.filter({ hasText: copy("customer.erase") }).click();
  const erase = page.getByRole("dialog", { name: copy("customer.erase.title", { name: `${customer.firstName} ${customer.lastName}`.trim() }) });
  await expect(erase.getByRole("button", { name: copy("customer.erase.confirmButton"), exact: true })).toBeDisabled();
});
