import { expect, test, type Page } from "@playwright/test";
import { createDemoState } from "../../src/concept/data/generate";
import type { DemoState } from "../../src/concept/data/types";
import { salonClock } from "../../src/concept/tools/clock";

// The owner's price list and the customer's booking page are the same data:
// a treatment added in the studio can be booked at once, a hidden one is gone
// from the page but kept, and a deleted one leaves its bookings alone.

const today = salonClock().today;
const errors = new WeakMap<Page, string[]>();

async function state(page: Page): Promise<DemoState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, createDemoState(today));
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", error => messages.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("a treatment is added, appears on the booking page, is hidden and then deleted", async ({ page }) => {
  const sheet = page.getByRole("dialog");
  const onPage = page.getByRole("button", { name: "Book Hot stone massage" });

  // Add: the form refuses a nameless treatment and a name the category already has.
  await page.goto("/studio/more/services");
  await page.getByRole("button", { name: "Add treatment", exact: true }).first().click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet.getByText("Give the treatment a name")).toBeVisible();
  await sheet.getByLabel("Name").fill("Classic massage 60 min");
  await sheet.getByLabel("Category").selectOption({ label: "Massage" });
  await sheet.getByLabel("Price (SEK)").fill("990");
  await expect(sheet.getByText("already has a treatment with that name")).toBeVisible();
  await sheet.getByLabel("Name").fill("Hot stone massage");
  await sheet.getByLabel("Length (minutes)").fill("75");
  await sheet.getByText("More options").click();
  await sheet.getByLabel("Description").fill("Warm stones and slow strokes.");
  await sheet.getByRole("button", { name: "Erik" }).click();
  await sheet.getByRole("button", { name: "Anna" }).click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Hot stone massage added")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Hot stone massage" })).toContainText("SEK 990");
  const added = (await state(page)).services.at(-1)!;
  expect(added).toMatchObject({ name: "Hot stone massage", category: "massage", duration: 75, price: 990, staffIds: ["erik"] });
  expect((await state(page)).log[0].summary).toBe("Added the treatment Hot stone massage");

  // It is on the booking page, under its category, and can be booked.
  await page.goto("/boka/salong-eko");
  await expect(onPage).toBeVisible();
  await onPage.click();
  await expect(page.getByRole("heading", { name: /Hot stone massage/ })).toBeVisible();

  // Hide: gone from the booking page, still on the price list.
  await page.goto("/studio/more/services");
  await page.getByRole("button", { name: "Edit Hot stone massage" }).click();
  await sheet.getByText("More options").click();
  await sheet.getByRole("switch", { name: "Show on the booking page" }).click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit Hot stone massage" })).toContainText("Hidden");
  await expect(page.getByText("10 treatments · 1 hidden")).toBeVisible();
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("button", { name: "Book Classic massage 60 min" })).toBeVisible();
  await expect(onPage).toHaveCount(0);
  // A link straight to the hidden treatment does not open a booking for it either.
  await page.goto(`/boka/salong-eko?service=${added.id}`);
  await expect(page.getByRole("button", { name: "Book Classic massage 60 min" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hot stone massage/ })).toHaveCount(0);

  // Delete: nothing is booked for it, so it goes without a warning.
  await page.goto("/studio/more/services");
  await page.getByRole("button", { name: "Edit Hot stone massage" }).click();
  await sheet.getByText("More options").click();
  await sheet.getByRole("button", { name: "Delete" }).click();
  await expect(sheet.getByText("Nothing is booked for this treatment")).toBeVisible();
  await sheet.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Hot stone massage" })).toHaveCount(0);
  const after = await state(page);
  expect(after.services.some(s => s.id === added.id)).toBe(false);
  expect(after.retiredServices).toEqual([]);
});

test("deleting a booked treatment says what happens and keeps the bookings", async ({ page }) => {
  const sheet = page.getByRole("dialog");
  await page.goto("/studio/more/services");
  const before = await state(page);
  const upcoming = before.bookings.filter(b => b.serviceId === "classic-60" && b.status === "booked" && b.date >= today);
  expect(upcoming.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Edit Classic massage 60 min" }).click();
  await sheet.getByText("More options").click();
  await sheet.getByRole("button", { name: "Delete" }).click();
  await expect(sheet.getByRole("alert")).toContainText(`${upcoming.length} upcoming booking`);
  await expect(sheet.getByRole("alert")).toContainText("Nothing is cancelled");
  await expect(sheet.getByRole("button", { name: "Hide instead" })).toBeVisible();
  await sheet.getByRole("button", { name: "Delete, keep bookings" }).click();
  await expect(page.getByText("Classic massage 60 min deleted")).toBeVisible();

  const after = await state(page);
  expect(after.services.some(s => s.id === "classic-60")).toBe(false);
  expect(after.bookings.filter(b => b.serviceId === "classic-60")).toEqual(before.bookings.filter(b => b.serviceId === "classic-60"));
  // The toast's Undo puts the treatment back where it was.
  await page.getByRole("button", { name: "Undo" }).click();
  const undone = await state(page);
  expect(undone.services.map(s => s.id)).toEqual(before.services.map(s => s.id));
});
