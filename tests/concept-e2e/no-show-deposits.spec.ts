import { expect, test, type Page } from "@playwright/test";
import { freeUntilText } from "../../src/concept/booking/deadline-text";
import { formatMinor } from "../../src/concept/booking/policy-summary";
import { feeMinor, quote } from "../../src/concept/booking/protection";
import type { DemoState } from "../../src/concept/data/types";
import { translate, type MessageKey } from "../../src/concept/i18n";
import { getPack } from "../../src/concept/packs";
import { englishDemoState, salonState } from "./fixtures";

const day = "2026-11-17";

function labels(state: DemoState) {
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(state.localization.language, key, vars, getPack(state.pack).vocabulary);
}

async function openDemo(page: Page, initial: DemoState, path: string) {
  await page.clock.install({ time: new Date(day + "T10:00:00+01:00") });
  await page.addInitScript(state => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(state));
  }, initial);
  await page.goto(path);
}

function saved(page: Page): Promise<DemoState> {
  return salonState(page) as Promise<DemoState>;
}

test("owner configures a deposit and the customer resumes checkout by simulated Swish", async ({ page }) => {
  const initial = englishDemoState(day);
  const service = initial.services[0];
  const label = labels(initial);
  const { currency } = initial.localization;
  const deposit = formatMinor(15000, currency);
  const balance = formatMinor(service.price * 100 - 15000, currency);
  const guest = { name: "Fictional Guest", phone: "0700009928" };
  await openDemo(page, initial, "/studio/more/settings/reminders");
  const treatment = page.getByLabel(label("protection.treatment"));
  const rules = page.locator("form").filter({ has: treatment });
  await treatment.selectOption(service.id);
  await rules.getByLabel(label("protection.depositInput", { currency })).fill("150");
  await expect(rules.getByText(label("protection.due", { deposit, balance }))).toBeVisible();
  await rules.getByRole("button", { name: label("common.save"), exact: true }).click();
  await expect.poll(async () => (await saved(page)).cancellationPolicy.deposits[service.id]).toBe(15000);
  await page.goto(`/boka/${initial.salon.slug}?service=${service.id}#book`);
  const flow = page.locator("[data-booking-flow]");
  await flow.getByLabel(label("booking.yourName"), { exact: true }).fill(guest.name);
  await flow.getByLabel(label("booking.yourPhone")).fill(guest.phone);
  await flow.getByLabel(label("booking.rememberContact")).check();
  const amountFor = (key: MessageKey) => flow.getByText(label(key), { exact: true }).locator("xpath=../dd");
  await expect(amountFor("booking.summary.total")).toHaveText(formatMinor(service.price * 100, currency));
  await expect(amountFor("booking.summary.dueNow")).toHaveText(deposit);
  await expect(amountFor("booking.summary.atSalon")).toHaveText(balance);
  await flow.getByRole("button", { name: label("protection.continue") }).click();
  await expect(flow.getByRole("heading", { name: label("protection.checkout") })).toBeVisible();
  const pending = await saved(page);
  expect(pending.bookings).toHaveLength(initial.bookings.length);
  expect(pending.checkoutHolds).toHaveLength(1);
  const [hold] = pending.checkoutHolds;
  await expect(flow.getByText(freeUntilText(hold, hold.terms.freeHours, Date.parse(day + "T10:00:00+01:00")))).toBeVisible();
  await expect(flow.getByText(label("protection.simulated"))).toHaveCount(0);
  await page.reload();
  await flow.getByRole("radio", { name: label("protection.swish") }).check();
  await flow.getByRole("button", { name: label("protection.pay", { amount: deposit }) }).click();
  await expect(page.getByRole("heading", { name: label("booking.confirmation.title") })).toBeVisible();
  await expect(page.getByText(label("protection.balance", { deposit, paid: deposit, remaining: balance }))).toBeVisible();
  const confirmed = await saved(page);
  expect(confirmed.checkoutHolds).toHaveLength(0);
  expect(confirmed.bookings.at(-1)?.protection?.deposit?.method).toBe("swish");
  await page.getByRole("link", { name: label("booking.me.rebook") }).click();
  await expect(flow.getByLabel(label("booking.yourName"), { exact: true })).toHaveValue(guest.name);
  await expect(flow.getByLabel(label("booking.yourPhone"))).toHaveValue(guest.phone);
});

test("owner reviews and charges the no-show fee once and sees it in Finance", async ({ page }) => {
  const initial = englishDemoState(day);
  const label = labels(initial);
  const service = initial.services[0];
  const terms = quote({ ...initial.cancellationPolicy, noShowPercent: 50 }, service, initial.localization.currency, true);
  const visit = { ...initial.bookings[0], date: day, start: 540, status: "booked" as const, serviceId: service.id, price: service.price,
    protection: { terms },
  };
  initial.modules.finance = true;
  initial.bookings = [visit];
  await openDemo(page, initial, `/studio/customers/${visit.customerId}`);
  const upcoming = page.locator("section").filter({ has: page.getByRole("heading", { name: label("customer.upcoming"), exact: true }) });
  await upcoming.getByRole("button").filter({ hasText: service.name }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: label("protection.markMissed") }).click();
  const fee = formatMinor(feeMinor(terms, "noshow"), terms.currency);
  await expect(sheet.getByText(label("protection.proposal", { fee, extra: fee, refund: formatMinor(0, terms.currency) }))).toBeVisible();
  await expect(sheet.getByRole("button", { name: label("protection.waive") })).toBeDisabled();
  await sheet.getByRole("button", { name: label("protection.charge") }).click();
  await expect(sheet.getByText(label("protection.charged"), { exact: true })).toBeVisible();
  const recorded = (await saved(page)).bookings[0];
  expect(recorded.status).toBe("noshow");
  expect(recorded.protection?.decision).toMatchObject({ actor: "owner", chargedMinor: feeMinor(terms, "noshow") });
  await page.goto("/studio/more/finance");
  await expect(page.getByRole("heading", { name: label("protection.finance") })).toBeVisible();
  await expect(page.getByText(label("protection.charged"), { exact: true })).toBeVisible();
});
