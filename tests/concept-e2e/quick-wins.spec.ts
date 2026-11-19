import { expect, test } from "@playwright/test";
import { freeCancellationDeadline } from "../../src/concept/booking/policy";
import { monthlySmsEstimate } from "../../src/concept/booking/reminders";
import { formatDate, formatMoney, formatTime } from "../../src/concept/i18n/format";
import { intlLocale } from "../../src/lib/locale";
import type { DemoState } from "../../src/concept/data/types";
import { createSalon, salonDraft } from "../../src/concept/onboarding/salon";
import { SALON_TIMEZONE } from "../../src/concept/tools/clock";
import { englishDemoState, fixtureText } from "./fixtures";

const today = "2026-11-17";
const home = "/boka/salong-eko";
const fixture = englishDemoState(today);
const copy = fixtureText(fixture);
const { currency, language } = fixture.localization;

test.use({ permissions: ["clipboard-read", "clipboard-write"], timezoneId: "America/New_York" });

test.beforeEach(async ({ context, page }) => {
  await context.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, fixture);
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
});

test("shows the payment split and salon deadline before confirmation, then offers repeat booking beside management", async ({ page }) => {
  await page.goto(home);
  const request = page.getByRole("textbox", { name: copy("booking.ask.title"), exact: true });
  await request.fill("Footcare day after tomorrow with Anna");
  await request.press("Enter");
  await page.getByRole("button", { name: new RegExp(copy("booking.until", { time: "\\d{2}:\\d{2}" })) }).first().click();
  const form = page.locator("form").filter({ has: page.getByLabel(copy("booking.yourName"), { exact: true }) });
  const amountFor = (label: string) => form.getByText(label, { exact: true }).locator("xpath=../dd");
  const total = amountFor(copy("booking.summary.total"));
  await expect(total).toBeVisible();
  const atSalon = fixture.modules.packages ? "booking.summary.atSalonWithPackages" : "booking.summary.atSalon";
  await expect(amountFor(copy(atSalon))).toHaveText(await total.innerText());
  await expect(amountFor(copy("booking.summary.dueNow"))).toHaveText(formatMoney(0, currency, language));
  const deadlineTemplate = copy("booking.freeUntil", { day: "DEADLINE_DAY", time: "DEADLINE_TIME", zone: SALON_TIMEZONE });
  const deadline = await form.getByText(deadlineTemplate.split("DEADLINE_DAY")[0]).innerText();
  await page.getByLabel(copy("booking.yourName"), { exact: true }).fill("Nova Demo");
  await page.getByLabel(copy("booking.yourPhone")).fill("070-000 99 11");
  await page.getByRole("button", { name: copy("booking.confirm"), exact: true }).click();
  await expect(page.getByRole("heading", { name: copy("booking.confirmation.title") })).toBeVisible();
  const saved: DemoState = await page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));
  const booking = saved.bookings.at(-1)!;
  const cutoff = freeCancellationDeadline(booking);
  expect(deadline).toBe(copy("booking.freeUntil", {
    day: formatDate(cutoff.date, language), time: formatTime(cutoff.time, language), zone: SALON_TIMEZONE,
  }));
  const repeat = `${home}?service=${booking.serviceId}&staff=${booking.staffId}#book`;
  const confirmation = page.getByRole("link", { name: copy("booking.manageLink"), exact: true }).locator("..");
  await expect(confirmation.getByRole("link", { name: copy("booking.me.rebook"), exact: true })).toHaveAttribute("href", repeat);
  await page.goto(`${home}/me?ref=${booking.customerId}`);
  const visit = page.getByRole("link", { name: copy("booking.me.details"), exact: true }).locator("..");
  await expect(visit.getByRole("link", { name: copy("booking.me.rebook"), exact: true })).toHaveAttribute("href", repeat);
});

test("persists reminder settings, chooses the preview channel and links straight to Sent", async ({ page }) => {
  // The SMS price and its estimate are under Advanced; the default channel is under Settings → Reminders.
  await page.goto("/studio/more/advanced");
  const sms = page.getByRole("heading", { name: copy("reminders.smsTitle") }).locator("../..");
  const price = sms.getByLabel(copy("reminders.smsPrice", { currency }));
  const money = new Intl.NumberFormat(intlLocale(language), { style: "currency", currency });
  const estimate = monthlySmsEstimate(fixture, today, fixture.reminderSettings);
  await expect(price).toHaveValue("0.45");
  await price.fill("0.70");
  const formula = (messages: number) => copy("reminders.formula", { messages, bookings: estimate.bookings, price: money.format(0.70) });
  await expect(sms.getByText(formula(1), { exact: true })).toBeVisible();
  await price.blur();
  await page.goto("/studio/more/settings/reminders");
  const reminders = page.getByRole("heading", { name: copy("reminders.title") }).locator("../..");
  await reminders.getByRole("radio", { name: copy("messages.channel.email") }).click();
  await page.reload();
  await expect(reminders.getByRole("radio", { name: copy("messages.channel.email") })).toBeChecked();
  await page.goto("/studio/more/advanced");
  await expect(price).toHaveValue("0.70");
  await expect(sms.getByText(formula(0), { exact: true })).toBeVisible();
  const booking = fixture.bookings.find(item => item.date > today && item.status === "booked")!;
  await page.goto(`${home}/booking/${booking.id}`);
  await page.getByRole("radio", { name: copy("messages.kind.reminder"), exact: true }).click();
  await expect(page.getByRole("radio", { name: copy("messages.channel.email"), exact: true })).toBeChecked();
  await page.getByRole("button", { name: copy("messages.simulate") }).click();
  await page.goto("/studio/more/settings/reminders");
  await reminders.getByRole("link", { name: copy("messages.log") }).click();
  await expect(page.getByRole("radio", { name: copy("messages.log") })).toBeChecked();
  const subject = copy("messages.subject.reminder", { salon: fixture.salon.name });
  await expect(page.getByText(copy("messages.sentTitle", { channel: copy("messages.channel.email"), subject }), { exact: true })).toBeVisible();
});

test("downloads from Your data and leads to the existing import", async ({ page }) => {
  await page.goto("/studio");
  const salon = createSalon(today, { ...salonDraft(), name: "Studio Linden", slug: "studio-linden" });
  await page.evaluate(initial => {
    localStorage.setItem("salong-eko-demo-own", JSON.stringify(initial));
    sessionStorage.setItem("salong-eko-workspace", "own");
  }, salon);
  await page.reload();
  const salonCopy = fixtureText(salon);
  await page.goto("/studio/more");
  await page.getByRole("main").getByRole("link", { name: new RegExp(salonCopy("nav.data")) }).click();
  await expect(page).toHaveURL(/\/studio\/more\/data$/);
  const checklist = page.locator("#migration");
  const started = page.waitForEvent("download");
  await checklist.getByRole("button", { name: salonCopy("data.export.customers"), exact: true }).click();
  expect((await started).suggestedFilename()).toBe(`studio-linden-customers-${today}.csv`);
  await expect(checklist.getByRole("button", { name: salonCopy("data.export.bookings") })).toBeVisible();
  await expect(checklist.getByRole("button", { name: salonCopy("data.export.all") })).toBeVisible();
  await checklist.getByRole("link", { name: salonCopy("import.title") }).click();
  await expect(page).toHaveURL(/\/studio\/customers\/import$/);
});

test("copies a booking error reference for the salon", async ({ page }) => {
  await page.goto(`${home}/me`);
  await page.getByLabel(copy("booking.yourPhone")).fill("070-000 99 11");
  await page.getByRole("button", { name: copy("booking.me.find") }).click();
  const alert = page.getByRole("alert").filter({ hasText: copy("reference.salonHint") });
  const code = alert.locator("code");
  await expect(code).toHaveText(/^CR-[A-Z0-9]{7}$/);
  await alert.locator("..").getByRole("button", { name: copy("common.copy"), exact: true }).click();
  const reference = await code.innerText();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(reference);
  await page.goto("/studio/more/advanced");
  await page.getByLabel(copy("reference.lookupCode")).fill(reference);
  await page.getByRole("button", { name: copy("reference.lookup") }).click();
  await expect(page.getByRole("status").filter({ hasText: copy("booking.me.notFound") })).toBeVisible();
});

test("shows a copyable support reference when a studio gift card check fails", async ({ page }) => {
  const booking = fixture.bookings.find(item => item.date > today && item.status === "booked")!;
  await page.goto(`/studio/customers/${booking.customerId}`);
  await page.getByRole("heading", { name: copy("customer.upcoming"), exact: true }).locator("../..").getByRole("button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: copy("giftcards.pay") }).click();
  const payment = page.getByRole("dialog", { name: copy("giftcards.payTitle") });
  await expect(payment.getByText(copy("payment.simulated"))).toBeVisible();
  const field = payment.getByLabel(copy("giftcards.payCode"));
  await field.fill("TEST-INVALID");
  const alert = payment.getByRole("alert").filter({ hasText: copy("reference.supportHint") });
  await expect(alert).toHaveCount(0);
  await field.blur();
  const code = alert.locator("code");
  await expect(code).toHaveText(/^CR-[A-Z0-9]{7}$/);
  await payment.getByRole("button", { name: copy("common.copy"), exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(await code.innerText());
});
