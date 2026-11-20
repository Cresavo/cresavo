import { expect, test, type Page } from "@playwright/test";
import { isMobilePhone } from "../../src/concept/booking/lookup";
import type { DemoState } from "../../src/concept/data/types";
import { englishDemoState, fixtureText } from "./fixtures";

// Fictional demo salon. Tuesday 17 November 2026, 10:00 in Stockholm; the freed visit is on Thursday.
const day = "2026-11-17";
const clock = new Date(`${day}T10:00:00+01:00`);
const date = "2026-11-19";

const saved = (page: Page): Promise<DemoState> => page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));

/** Two fictional customers wait for Thursday; a third customer's visit then is cancelled from the booking page. */
async function cancelAndOpenList(page: Page) {
  const state = englishDemoState(day);
  const label = fixtureText(state);
  const service = state.services.find((s) => !s.hidden && s.staffIds.length)!;
  const staffId = service.staffIds[0];
  const [original, first, second] = state.customers.filter((c) => isMobilePhone(c.phone));
  state.bookings = [{
    ...state.bookings[0], id: "released", customerId: original.id, serviceId: service.id, staffId, resourceId: undefined,
    start: 600, date, duration: service.duration, status: "booked", protection: undefined,
  }];
  // The add-on is switched on explicitly; new salons start without it.
  state.modules = { ...state.modules, waitlist: true };
  state.waitlistRules = { mode: "automatic", minutes: 15, paused: false };
  state.waitlistEntries = [first, second].map((c, index) => ({
    id: `entry-${index}`, customerId: c.id, serviceId: service.id, staffId, days: [date],
    window: { start: 0, end: 1440 }, joinedAt: clock.getTime() - 2000 + index,
  }));
  state.waitlistOffers = [];
  state.waitlistGaps = [];
  await page.clock.install({ time: clock });
  await page.addInitScript((initial) => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, state);
  await page.goto(`/boka/${state.salon.slug}/booking/released`);
  await page.getByRole("button", { name: label("booking.cancel"), exact: true }).click();
  await page.getByRole("button", { name: label("booking.cancel.confirm") }).click();
  await expect.poll(async () => (await saved(page)).waitlistOffers.length).toBe(1);
  await page.goto("/studio/customers/waitlist");
  await expect(page.getByRole("heading", { name: label("offers.active") })).toBeVisible();
  return { state, label, first, second };
}

test("a cancelled visit becomes a personal offer, and two tabs claiming it book it once", async ({ page, context }) => {
  const { label, first } = await cancelAndOpenList(page);
  const link = page.getByRole("link", { name: label("offers.openLink") });
  const href = (await link.getAttribute("href"))!;
  await link.click();
  const other = await context.newPage();
  await other.clock.install({ time: clock });
  await other.goto(href);
  const claim = (p: Page) => p.getByRole("button", { name: label("offers.claim") });
  await expect(claim(other)).toBeVisible();
  await expect(claim(page)).toBeVisible();
  // Both tabs show an open offer before either click takes the booking lock.
  const buttons = await Promise.all([claim(page).elementHandle(), claim(other).elementHandle()]);
  await Promise.all(buttons.map((button) => button!.evaluate((element) => (element as HTMLButtonElement).click())));
  await expect.poll(async () => (await saved(page)).waitlistOffers[0].status).toBe("claimed");
  const booked = (await saved(page)).bookings.filter((b) => b.date === date && b.start === 600 && b.status === "booked");
  expect(booked).toHaveLength(1);
  expect(booked[0].customerId).toBe(first.id);
});

test("a hold that runs out goes to the next customer in line", async ({ page }) => {
  const { label, second } = await cancelAndOpenList(page);
  const oldLink = (await page.getByRole("link", { name: label("offers.openLink") }).getAttribute("href"))!;
  await page.clock.fastForward(15 * 60_000 + 1000);
  await expect.poll(async () => (await saved(page)).waitlistOffers.map((o) => o.status)).toEqual(["lapsed", "offered"]);
  expect((await saved(page)).waitlistOffers[1].customerId).toBe(second.id);
  await expect(page.getByRole("link", { name: label("offers.openLink") })).not.toHaveAttribute("href", oldLink);
  await page.goto(oldLink);
  await expect(page.getByText(label("offers.inactive"))).toBeVisible();
  await expect(page.getByRole("button", { name: label("offers.claim") })).toHaveCount(0);
});
