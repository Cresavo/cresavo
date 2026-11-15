import { expect, type Page } from "@playwright/test";
import { DateTime } from "luxon";
export async function chooseDay(page: Page, id: string, date: string) {
  const picker = id === "date"
    ? page.getByTestId("track-customer").locator("fieldset.date-picker")
    : page.locator("fieldset.date-picker").filter({ has: page.locator(`#${id}`) });
  const details = picker.locator("..").locator(":scope > summary");
  if (!(await picker.isVisible()) && (await details.count()))
    await details.click();
  await expect(picker).toBeVisible();
  for (let i = 0; i < 24; i++) {
    const month = await picker.getAttribute("data-month");
    if (month === date.slice(0, 7)) break;
    await picker
      .getByRole("button", {
        name: month! < date.slice(0, 7) ? "Nästa månad" : "Föregående månad",
        exact: true,
      })
      .click();
  }
  await picker
    .getByRole("button", {
      name: DateTime.fromISO(date).setLocale("sv").toFormat("cccc d MMMM yyyy"),
      exact: true,
    })
    .click();
}
export async function chooseSlot(page: Page, id: string, instant?: string) {
  const picker = id === "slot"
    ? page.getByTestId("track-customer").locator("fieldset.slot-picker")
    : page.locator("fieldset.slot-picker").filter({ has: page.locator(`#${id}`) });
  const button = instant
    ? picker.locator(`button[data-slot="${instant}"]`)
    : picker.locator("button[data-slot]").first();
  await expect(button).toBeVisible();
  const value = await button.getAttribute("data-slot");
  await button.click();
  return value!;
}
