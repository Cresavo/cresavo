import { expect, test } from "@playwright/test";
import { formatTime } from "../../src/concept/data/dates";
import type { DemoState } from "../../src/concept/data/types";
import { createSalon, salonDraft } from "../../src/concept/onboarding/salon";
import { englishDemoState } from "./fixtures";

const today = "2026-11-17";
const home = "/boka/salong-eko";

test.use({ permissions: ["clipboard-read", "clipboard-write"], timezoneId: "America/New_York" });

test.beforeEach(async ({ context, page }) => {
  const fixture = englishDemoState(today);
  await context.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, fixture);
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
});

test("shows the payment split and salon deadline before confirmation, then offers repeat booking beside management", async ({ page }) => {
  await page.goto(home);
  await page.getByRole("textbox", { name: /What would you like to book/ }).fill("Footcare day after tomorrow with Anna");
  await page.getByRole("textbox", { name: /What would you like to book/ }).press("Enter");
  await page.getByRole("button", { name: /until \d\d:\d\d/ }).first().click();
  const total = page.locator("dl div").filter({ hasText: "Service total" });
  const payAtSalon = page.locator("dl div").filter({ hasText: "Pay at the salon" });
  expect(await total.locator("dd").innerText()).toBe(await payAtSalon.locator("dd").innerText());
  await expect(page.locator("dl div").filter({ hasText: "Due now" }).locator("dd")).toHaveText(/\b0\b/);
  const deadline = await page.getByText(/Free to change or cancel online until/).innerText();
  await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 11");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
  const saved: DemoState = await page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));
  const booking = saved.bookings.at(-1)!;
  expect(deadline).toContain(`18 Nov 2026 at ${formatTime(booking.start)} (Europe/Stockholm)`);
  const repeat = `${home}?service=${booking.serviceId}&staff=${booking.staffId}#book`;
  const confirmation = page.getByRole("link", { name: "Manage this booking", exact: true }).locator("..");
  await expect(confirmation.getByRole("link", { name: "Book again", exact: true })).toHaveAttribute("href", repeat);
  await page.goto(`${home}/me?ref=${booking.customerId}`);
  const visit = page.getByRole("link", { name: "Details", exact: true }).locator("..");
  await expect(visit.getByRole("link", { name: "Book again", exact: true })).toHaveAttribute("href", repeat);
});

test("persists reminder settings, chooses the preview channel and links straight to Sent", async ({ page }) => {
  await page.goto("/studio/more/settings");
  const reminders = page.getByRole("heading", { name: "Booking reminders" }).locator("../..");
  const price = reminders.getByLabel("Price per SMS (SEK)");
  await expect(price).toHaveValue("0.45");
  await price.fill("0.70");
  await expect(reminders.getByText(/1 SMS per booking × \S+ bookings this month × SEK\s*0.70 per SMS/)).toBeVisible();
  await reminders.getByRole("radio", { name: "Email" }).click();
  await expect(reminders.getByText(/0 SMS per booking/)).toBeVisible();
  await page.reload();
  await expect(price).toHaveValue("0.70");
  await expect(reminders.getByRole("radio", { name: "Email" })).toBeChecked();
  const fixture = englishDemoState(today);
  const booking = fixture.bookings.find(item => item.date > today && item.status === "booked")!;
  await page.goto(`${home}/booking/${booking.id}`);
  await page.getByRole("radio", { name: "Reminder", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Email", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Simulate send" }).click();
  await page.goto("/studio/more/settings");
  await reminders.getByRole("link", { name: "Sent log" }).click();
  await expect(page.getByRole("radio", { name: "Sent log" })).toBeChecked();
  await expect(page.getByText(/^Email sent \(simulated\) · Your visit/)).toBeVisible();
});

test("opens the migration checklist from Getting started and leads to the existing import", async ({ page }) => {
  await page.goto("/studio");
  const salon = createSalon(today, { ...salonDraft(), name: "Studio Linden", slug: "studio-linden" });
  await page.evaluate(initial => {
    localStorage.setItem("salong-eko-demo-own", JSON.stringify(initial));
    sessionStorage.setItem("salong-eko-workspace", "own");
  }, salon);
  await page.reload();
  await page.getByRole("link", { name: "Export and migration checklist" }).click();
  await expect(page).toHaveURL(/\/studio\/more\/data#migration$/);
  const checklist = page.locator("#migration");
  const started = page.waitForEvent("download");
  await checklist.getByRole("button", { name: "Customers (CSV)", exact: true }).click();
  expect((await started).suggestedFilename()).toBe(`studio-linden-customers-${today}.csv`);
  await expect(checklist.getByRole("button", { name: "Bookings (CSV)" })).toBeVisible();
  await expect(checklist.getByRole("button", { name: "Everything (JSON)" })).toBeVisible();
  await checklist.getByRole("link", { name: "Import customers" }).click();
  await expect(page).toHaveURL(/\/studio\/customers\/import$/);
});

test("copies a booking error reference for the salon", async ({ page }) => {
  await page.goto(`${home}/me`);
  await page.getByLabel("Mobile number").fill("070-000 99 11");
  await page.getByRole("button", { name: "Show my bookings" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Give this reference code to the salon" });
  const code = alert.locator("code");
  await expect(code).toHaveText(/^CR-[A-Z0-9]{7}$/);
  await alert.locator("..").getByRole("button", { name: "Copy", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(await code.innerText());
});

test("shows a copyable support reference when a studio gift card check fails", async ({ page }) => {
  const fixture = englishDemoState(today);
  const booking = fixture.bookings.find(item => item.date > today && item.status === "booked")!;
  await page.goto(`/studio/customers/${booking.customerId}`);
  await page.getByRole("heading", { name: "Upcoming", exact: true }).locator("../..").getByRole("button").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Pay with gift card" }).click();
  const payment = page.getByRole("dialog", { name: "Pay with gift card" });
  await expect(payment.getByText("Simulated payment. No money changes hands.")).toBeVisible();
  await payment.getByLabel("Gift card code").fill("TEST-INVALID");
  const alert = payment.getByRole("alert").filter({ hasText: "Give this reference code to support" });
  const code = alert.locator("code");
  await expect(code).toHaveText(/^CR-[A-Z0-9]{7}$/);
  await payment.getByRole("button", { name: "Copy", exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(await code.innerText());
});
