import { expect, test, type Page } from "@playwright/test";
import type { DemoState } from "../../src/concept/data/types";
import { salonState } from "./fixtures";

// Settings is a short overview; each section opens its own page, and Advanced holds what most salons never need.

async function state(page: Page): Promise<DemoState | null> {
  return salonState(page);
}

test("the owner edits the salon's details, sees them on the booking page and can undo from History", async ({ page }) => {
  await page.goto("/studio/more/settings");
  await page.getByRole("main").getByRole("link", { name: /^Salon/ }).click();
  await expect(page).toHaveURL(/\/studio\/more\/settings\/salon$/);
  await expect(page.getByRole("heading", { name: "Salon", level: 1 })).toBeVisible();

  const name = page.getByLabel("Salon name");
  const save = page.getByRole("button", { name: "Save details" });
  await expect(save).toBeDisabled();
  await name.fill("");
  await page.getByLabel("Email").fill("not-an-email");
  await save.click();
  await expect(page.getByText("Type the salon's name.")).toBeVisible();
  await expect(page.getByText("Check the email address, for example hello@yoursalon.se.")).toBeVisible();
  // An invalid edit saves nothing: the demo has either not been stored yet or still has its name.
  expect((await state(page))?.salon.name ?? "Salong Eko").toBe("Salong Eko");

  await name.fill("Studio Fern Demo");
  await page.getByLabel("Email").fill("hello@studiofern.example");
  await page.getByLabel("Area or town").fill("Fictional Town");
  await save.click();
  await expect(page.getByText("Salon details saved").first()).toBeVisible();
  await expect(save).toBeDisabled();
  expect((await state(page))?.salon).toMatchObject({ name: "Studio Fern Demo", email: "hello@studiofern.example", area: "Fictional Town", slug: "salong-eko" });

  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Studio Fern Demo", level: 1 })).toBeVisible();

  // History and undo is under Help.
  await page.goto("/studio");
  await page.locator('[data-help="help-button"]:visible').first().click();
  await page.getByRole("dialog").getByRole("button", { name: /History and undo/ }).click();
  await expect(page).toHaveURL(/\/studio\/more\/log$/);
  const entry = page.getByRole("listitem").filter({ hasText: "Salon details changed: salon name, email, area or town" });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("Studio Fern Demo");
  await entry.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await state(page))?.salon.name).toBe("Salong Eko");
});

test("Advanced is one quiet entry at the end of More and of Settings, and holds the expert tools", async ({ page }) => {
  await page.goto("/studio/more");
  const more = page.getByRole("main");
  await expect(more.getByRole("link", { name: /History and undo/ })).toHaveCount(0);
  await more.getByRole("list", { name: "Advanced" }).getByRole("link", { name: /Advanced/ }).click();
  await expect(page).toHaveURL(/\/studio\/more\/advanced$/);
  await expect(page.getByRole("heading", { name: "Advanced", level: 1 })).toBeVisible();
  for (const heading of ["Assistants and developers", "Booking on your own website", "Booking language", "SMS price", "Your own CSS", "Rooms and chairs", "Support access", "Industry pack", "Demo"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true }), heading).toBeVisible();
  }
  await page.getByRole("link", { name: /Connection details/ }).click();
  await expect(page).toHaveURL(/\/studio\/more\/advanced\/developers$/);
  await expect(page.getByRole("heading", { name: "For developers", exact: true })).toBeVisible();

  await page.goto("/studio/more/settings");
  const sections = page.getByRole("main").getByRole("link");
  await expect(page.getByRole("heading", { name: "Appearance and language" })).toBeVisible();
  for (const name of ["Salon", "Opening hours and closed days", "Reminders and cancellations", "Your booking link"]) {
    await expect(sections.filter({ hasText: name }).first(), name).toBeVisible();
  }
  await page.getByRole("main").getByRole("list", { name: "Advanced" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/studio\/more\/advanced$/);
  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page).toHaveURL(/\/studio\/more\/settings$/);

  // The primary data view keeps three plain cards and no developer words.
  await page.goto("/studio/more/data");
  for (const title of ["Download my data", "Import customers", "Connect an assistant"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("main")).not.toContainText("MCP");
});

test("Add-ons is a plain list, and Gift cards & packages asks before switching on", async ({ page }) => {
  await page.goto("/studio/more/features");
  await expect(page.getByRole("heading", { name: "Add-ons", level: 1 })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("/ month");
  await expect(page.getByRole("heading", { name: "Industry pack" })).toHaveCount(0);
  const giftCards = page.getByRole("switch", { name: "Gift cards & packages", exact: true });
  await expect(page.getByRole("switch", { name: /^(Gift cards|Packages)$/ })).toHaveCount(0);
  const on = await giftCards.getAttribute("aria-checked") === "true";
  if (on) {
    await giftCards.click();
    await expect(giftCards).not.toBeChecked();
  }
  await giftCards.click();
  const consent = page.getByRole("dialog", { name: "Switch on Gift cards & packages?" });
  await expect(consent.getByText("Demo: nothing is sold or charged. Payments here are simulated.")).toBeVisible();
  await consent.getByRole("button", { name: "Cancel" }).click();
  await expect(giftCards).not.toBeChecked();
  await giftCards.click();
  await consent.getByRole("button", { name: "Switch on", exact: true }).click();
  await expect(giftCards).toBeChecked();
  await page.goto("/studio/more");
  const main = page.getByRole("main");
  const entry = main.getByRole("link", { name: /^Gift cards & packages/ });
  await expect(entry).toHaveCount(1);
  await entry.click();
  const tabs = page.getByRole("tablist", { name: "Gift cards & packages" });
  await expect(tabs.getByRole("tab", { name: "Gift cards" })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Packages" }).click();
  await expect(page.getByRole("tabpanel", { name: "Packages" })).toBeVisible();
  await page.goto("/studio/more/packages");
  await expect(tabs.getByRole("tab", { name: "Packages" })).toHaveAttribute("aria-selected", "true");
});
