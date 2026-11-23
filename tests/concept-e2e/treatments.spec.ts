import { expect, test, type Locator, type Page } from "@playwright/test";
import { englishDemoState, salonState } from "./fixtures";
import type { DemoState } from "../../src/concept/data/types";
import { salonClock } from "../../src/concept/tools/clock";

// The owner's price list and the customer's booking page are the same data:
// a treatment added in the studio can be booked at once, a hidden one is gone
// from the page but kept, and a deleted one leaves its bookings alone.

const today = salonClock().today;
const errors = new WeakMap<Page, string[]>();

async function state(page: Page): Promise<DemoState> {
  return salonState(page) as Promise<DemoState>;
}

async function pickUpWithKeyboard(handle: Locator) {
  await handle.focus();
  await handle.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  // The keyboard sensor attaches its listeners and measures targets after pickup.
  await handle.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, englishDemoState(today));
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
  await expect(page.getByRole("button", { name: "Edit Hot stone massage" })).toHaveAccessibleDescription(/SEK\s+990/);
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
  await expect(page.getByRole("button", { name: "Edit Hot stone massage" })).toHaveAccessibleDescription(/Hidden/);
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

test("details typed in the studio open behind More info on the booking page and lead on to booking", async ({ page }) => {
  const sheet = page.getByRole("dialog");
  const text = "We start with a short chat.\n\nThen forty minutes of slow massage.";

  // A treatment without the longer text has no More info; the demo's own two have one each.
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("button", { name: "More info about Deep tissue massage" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^More info about / })).toHaveCount(2);

  await page.goto("/studio/more/services");
  await page.getByRole("button", { name: "Edit Deep tissue massage" }).click();
  await sheet.getByText("More options").click();
  await sheet.getByLabel("More about this treatment").fill(text);
  await sheet.getByLabel("Photo with the text").selectOption({ label: "Massage" });
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Deep tissue massage saved")).toBeVisible();
  expect((await state(page)).services.find(s => s.id === "deep-tissue")).toMatchObject({ details: text, image: "massage" });

  // The row keeps Book and More info as two controls of at least 44 px, neither inside the other.
  await page.goto("/boka/salong-eko");
  const more = page.getByRole("button", { name: "More info about Deep tissue massage" });
  const book = page.getByRole("button", { name: "Book Deep tissue massage", exact: true });
  for (const control of [more, book]) {
    const box = (await control.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  expect(await more.evaluate(node => !!node.parentElement?.closest("button, a"))).toBe(false);

  await more.click();
  await expect(sheet.getByRole("heading", { name: "Deep tissue massage" })).toBeVisible();
  await expect(sheet).toContainText(/1 h · SEK\s+895/);
  const body = sheet.getByText("We start with a short chat.");
  await expect(body).toContainText("Then forty minutes of slow massage.");
  expect(await body.evaluate(node => getComputedStyle(node).whiteSpace)).toBe("pre-line");
  await expect(sheet.getByRole("img")).toHaveCount(0);
  await expect(sheet.locator("img")).toBeVisible();

  // Closing returns to the page; Book in the sheet continues the normal flow with the treatment chosen.
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await sheet.getByRole("button", { name: "Book Deep tissue massage" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Deep tissue massage/ })).toBeVisible();

  // Without a price list on the page, the flow's own list has the same action under the row's button, not inside it.
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("salong-eko-demo")!);
    stored.page.sections = stored.page.sections.filter((section: { kind: string }) => section.kind !== "treatments");
    localStorage.setItem("salong-eko-demo", JSON.stringify(stored));
  });
  await page.goto("/boka/salong-eko");
  await page.getByRole("button", { name: "Choose a treatment from the list" }).click();
  const inFlow = page.getByRole("button", { name: "More info about Deep tissue massage" });
  await expect(page.getByRole("button", { name: /^More info about / })).toHaveCount(3);
  expect(await inFlow.evaluate(node => !!node.parentElement?.closest("button, a"))).toBe(false);
  expect((await inFlow.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await inFlow.click();
  await expect(sheet).toContainText("We start with a short chat.");
  await sheet.getByRole("button", { name: "Book Deep tissue massage" }).click();
  await expect(page.getByRole("heading", { name: /Deep tissue massage/ })).toBeVisible();
});

test("a sheet left open in another tab does not write old details back over a newer edit", async ({ page, context }) => {
  const text = "Written in the first tab.";
  await page.goto("/studio/more/services");
  const other = await context.newPage();
  const otherErrors: string[] = [];
  other.on("pageerror", error => otherErrors.push(error.message));
  await other.goto("/studio/more/services");

  // Both tabs open the same treatment before either saves.
  for (const tab of [page, other]) {
    await tab.getByRole("button", { name: "Edit Deep tissue massage" }).click();
    await tab.getByRole("dialog").getByText("More options").click();
  }
  await page.getByRole("dialog").getByLabel("More about this treatment").fill(text);
  await page.getByRole("dialog").getByLabel("Photo with the text").selectOption({ label: "Massage" });
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Deep tissue massage saved")).toBeVisible();

  // The second tab's sheet still shows the empty text; it changes only the price.
  await expect(other.getByRole("dialog").getByLabel("More about this treatment")).toHaveValue("");
  await other.getByRole("dialog").getByLabel("Price (SEK)").fill("915");
  await other.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(other.getByText("Deep tissue massage saved")).toBeVisible();
  expect((await state(other)).services.find(s => s.id === "deep-tissue")).toMatchObject({ price: 915, details: text, image: "massage" });

  // Clearing the text on purpose still clears it.
  await other.getByRole("button", { name: "Edit Deep tissue massage" }).click();
  await other.getByRole("dialog").getByText("More options").click();
  await expect(other.getByRole("dialog").getByLabel("More about this treatment")).toHaveValue(text);
  await other.getByRole("dialog").getByLabel("More about this treatment").fill("");
  await other.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => (await state(other)).services.find(s => s.id === "deep-tissue")?.details).toBeUndefined();
  expect(otherErrors).toEqual([]);
  await other.close();
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

test("a mouse or keyboard reorder changes the public price list and can be undone", async ({ page }) => {
  await page.goto("/studio/more/services");
  const before = await state(page);
  const [category] = before.categories;
  const [first, second] = before.services.filter((service) => service.category === category.id);
  const list = page.getByRole("region", { name: category.name });
  const rows = list.getByRole("button", { name: /^Edit / });
  const handle = list.getByRole("button", { name: `Reorder ${second.name}` });
  const firstHandle = list.getByRole("button", { name: `Reorder ${first.name}` });
  await expect(rows.first()).toHaveAccessibleName(`Edit ${first.name}`);
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  const to = (await firstHandle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await expect(list.locator("[data-drop-edge]")).toBeVisible();
  await page.mouse.up();
  await expect(rows.first()).toHaveAccessibleName(`Edit ${second.name}`);
  await expect(page.getByText(`Moved ${second.name}`, { exact: true })).toBeVisible();
  const after = await state(page);
  expect(after.log).toHaveLength(before.log.length + 1);

  const booking = await page.context().newPage();
  await booking.goto("/boka/salong-eko");
  const publicRows = booking.getByRole("region", { name: category.name }).getByRole("button", { name: /^Book / });
  await expect(publicRows.first()).toHaveAccessibleName(`Book ${second.name}`);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rows.first()).toHaveAccessibleName(`Edit ${first.name}`);
  await expect(publicRows.first()).toHaveAccessibleName(`Book ${first.name}`);
  await booking.close();

  await page.bringToFront();
  await pickUpWithKeyboard(handle);
  await expect(page.getByText(`Picked up ${second.name}, position 2 of`, { exact: false })).toBeVisible();
  await page.keyboard.press("ArrowUp");
  await expect(list.locator("[data-drop-edge]")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(rows.first()).toHaveAccessibleName(`Edit ${second.name}`);
  await expect(handle).toBeFocused();
  await expect(page.getByText(`Moved ${second.name}`, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Reorder", exact: true }).click();
  await list.getByRole("button", { name: `Move ${second.name} down` }).click();
  await expect(rows.first()).toHaveAccessibleName(`Edit ${first.name}`);
});

test("a category handle moves the entire category and leaves its treatments in order", async ({ page }) => {
  await page.goto("/studio/more/services");
  const before = await state(page);
  const headings = page.getByRole("heading", { level: 2 });
  await expect(headings.first()).toHaveText("Foot care");
  const handle = page.getByRole("button", { name: "Reorder Massage", exact: true });
  await handle.scrollIntoViewIfNeeded();
  await pickUpWithKeyboard(handle);
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("[data-drop-edge]")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(headings.first()).toHaveText("Massage");
  expect((await state(page)).services).toEqual(before.services);
  await expect(page.getByText("Moved Massage", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(headings.first()).toHaveText("Foot care");
});
