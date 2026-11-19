import { expect, test, type Page } from "@playwright/test";
import { quote } from "../../src/concept/booking/protection";
import type { DemoState } from "../../src/concept/data/types";
import { englishDemoState } from "./fixtures";

const day = "2026-11-17";

async function openDemo(page: Page, initial: DemoState, path: string) {
  await page.clock.install({ time: new Date(day + "T10:00:00+01:00") });
  await page.addInitScript(state => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(state));
  }, initial);
  await page.goto(path);
}

function saved(page: Page): Promise<DemoState> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));
}

test("owner configures a deposit and the customer pays by simulated Swish", async ({ page }) => {
  const initial = englishDemoState(day);
  const service = initial.services[0];
  await openDemo(page, initial, "/studio/more/settings");
  await page.getByLabel("Treatment to configure").selectOption(service.id);
  await page.getByLabel("Deposit for this treatment (SEK)").fill("150");
  await expect(page.getByText(/Pay a deposit of.*150/)).toBeVisible();
  await page.locator("form").filter({ has: page.getByLabel("Treatment to configure") }).getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(async () => (await saved(page)).cancellationPolicy.deposits[service.id]).toBe(15000);
  await page.goto(`/boka/salong-eko?service=${service.id}#book`);
  await page.getByLabel("Your name", { exact: true }).fill("Fictional Guest");
  await page.getByLabel("Mobile number").fill("0700009928");
  await expect(page.getByText(/Free to change or cancel until/)).toBeVisible();
  await page.getByRole("button", { name: "Continue to deposit" }).click();
  await expect(page.getByRole("heading", { name: "Pay your deposit" })).toBeVisible();
  await expect(page.getByText("Payments and refunds are simulated in the demo.")).toBeVisible();
  expect((await saved(page)).bookings.length).toBe(initial.bookings.length);
  expect((await saved(page)).checkoutHolds).toHaveLength(1);
  await page.reload();
  await page.getByRole("radio", { name: "Swish" }).check();
  await page.getByRole("button", { name: /Simulate payment of/ }).click();
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
  await expect(page.getByText(/Deposit paid.*150.*Remaining at the salon/)).toBeVisible();
  const confirmed = await saved(page);
  expect(confirmed.checkoutHolds).toHaveLength(0);
  expect(confirmed.bookings.at(-1)?.protection?.deposit?.method).toBe("swish");
});

test("owner reviews and charges the no-show fee once and sees it in Finance", async ({ page }) => {
  const initial = englishDemoState(day);
  const service = initial.services[0];
  const visit = { ...initial.bookings[0], date: day, start: 540, status: "booked" as const, serviceId: service.id, price: service.price,
    protection: { terms: quote({ ...initial.cancellationPolicy, noShowPercent: 50 }, service, "SEK", true) },
  };
  initial.modules.finance = true;
  initial.bookings = [visit];
  await openDemo(page, initial, `/studio/customers/${visit.customerId}`);
  await page.getByRole("button", { name: new RegExp(service.name) }).click();
  await page.getByRole("button", { name: "Mark as no-show" }).click();
  await expect(page.getByText(/Policy fee/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Waive fee and refund deposit" })).toBeDisabled();
  await page.getByRole("button", { name: "Charge fee (simulated)" }).click();
  await expect(page.getByText("Fee charged (simulated)", { exact: true })).toBeVisible();
  const recorded = (await saved(page)).bookings[0];
  expect(recorded.status).toBe("noshow");
  expect(recorded.protection?.decision).toMatchObject({ actor: "owner", chargedMinor: service.price * 50 });
  await page.goto("/studio/more/finance");
  await expect(page.getByRole("heading", { name: "Booking deposits and fees" })).toBeVisible();
  await expect(page.getByText("Fee charged (simulated)", { exact: true })).toBeVisible();
});
