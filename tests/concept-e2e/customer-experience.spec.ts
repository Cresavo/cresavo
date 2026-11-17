import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { createDemoState } from "../../src/concept/data/generate";
import type { DemoState } from "../../src/concept/data/types";

const errors = new WeakMap<Page, string[]>();
async function screenshot(page: Page, name: string) {
  if (process.env.CONCEPT_SCREENSHOTS !== "1") return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ animations: "disabled", path: `docs/concept/screens/night2-${name}-${page.viewportSize()!.width}.png`, fullPage: true });
}
async function state(page: Page): Promise<DemoState> { return page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!)); }
async function startBooking(page: Page) {
  await page.goto("/boka/salong-eko");
  await page.getByPlaceholder(/^For example: .+ some afternoon next week$/).fill("Footcare day after tomorrow with Anna");
  await page.getByPlaceholder(/^For example: .+ some afternoon next week$/).press("Enter");
  await page.getByRole("button", { name: /until \d\d:\d\d/ }).first().click();
  await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 11");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-17T10:00:00+01:00") });
  await page.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, createDemoState("2026-11-17"));
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", error => messages.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("book, preview both channels, simulate reminders, inspect Inbox, rebook and cancel", async ({ page }) => {
  await startBooking(page);
  await expect(page.getByText("Sent (simulated) — saved in the owner's Inbox.")).toBeVisible();
  await page.getByRole("radio", { name: "Email", exact: true }).click();
  await screenshot(page, "confirmation-email");
  await page.getByRole("radio", { name: "Reminder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Simulate send" })).toBeVisible();
  await screenshot(page, "reminder-email");
  await page.getByRole("button", { name: "Simulate send" }).click();
  await page.getByRole("radio", { name: "SMS", exact: true }).click();
  await screenshot(page, "reminder-sms");
  await page.getByRole("button", { name: "Simulate send" }).click();
  const saved = await state(page);
  const booking = saved.bookings.at(-1)!;
  expect(saved.inbox.filter(item => item.delivery && item.bookingId === booking.id)).toHaveLength(4);
  await page.goto("/studio/inbox");
  await page.getByRole("radio", { name: "Sent log", exact: true }).click();
  await expect(page.getByText("SMS sent (simulated) · Your visit · Salong Eko", { exact: true })).toBeVisible();
  await screenshot(page, "sent-inbox");
  await page.goto(`/boka/salong-eko/me?ref=${booking.customerId}`);
  await page.getByRole("link", { name: "Details" }).click();
  await page.waitForURL(/\/booking\//);
  await page.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByRole("heading", { name: "This booking is cancelled" })).toBeVisible();
  await page.getByRole("link", { name: "Book a new time" }).click();
  await expect(page.getByRole("radiogroup", { name: "Choose a day" })).toBeVisible();
  await expect(page).toHaveURL(/service=/);
});

test("review a completed visit, keep it private, approve in Inbox and publish on salon page", async ({ page }) => {
  await page.goto("/boka/salong-eko");
  await page.getByPlaceholder(/^For example: .+ some afternoon next week$/).waitFor();
  const saved = await state(page);
  const eligible = saved.bookings.filter(booking => booking.status === "completed" && !saved.reviews.some(review => review.bookingId === booking.id)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const reviewText = "A lovely fictional visit, with time to relax.";
  await page.goto(`/boka/salong-eko/me?ref=${eligible.customerId}`);
  await page.getByRole("button", { name: "Leave a review", exact: true }).first().click();
  await page.getByRole("radio", { name: "5 stars", exact: true }).locator("..").click();
  await page.getByLabel("Tell us about your visit").fill(reviewText);
  await expect(page.getByRole("button", { name: "Submit review", exact: true })).toBeEnabled();
  await screenshot(page, "review-form");
  await page.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(page.getByText("Thank you! Your review is waiting for owner approval.", { exact: true })).toBeVisible();
  await page.goto("/boka/salong-eko");
  await expect(page.getByText(reviewText, { exact: true })).toHaveCount(0);
  await page.goto("/studio/more/reviews");
  await expect(page.getByRole("button", { name: "Approve for salon page", exact: true })).toBeVisible();
  await screenshot(page, "reviews-moderation");
  await page.goto("/studio/inbox");
  await page.getByRole("button", { name: /New review · approval needed/ }).click();
  const approve = page.getByRole("button", { name: "Approve for salon page", exact: true });
  await expect(approve).toBeVisible();
  await screenshot(page, "review-approval");
  await approve.click();
  await page.goto("/boka/salong-eko");
  await expect(page.getByText(reviewText, { exact: true })).toBeVisible();
  await screenshot(page, "review-public");
});

test("copy clean share/widget code and book inside a cross-origin iframe", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/studio/more/settings");
  await page.getByLabel("Instagram bio link", { exact: true }).waitFor();
  const link = await page.getByLabel("Instagram bio link", { exact: true }).inputValue();
  expect(link).toBe(`${baseURL}/boka/salong-eko`);
  await page.getByRole("button", { name: "Copy booking link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  const code = await page.getByLabel("Embed code", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Copy embed code", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await screenshot(page, "booking-share");
  const widgetResponse = await page.request.get("/boka/salong-eko/widget");
  expect(widgetResponse.headers()["content-security-policy"]).toContain("frame-ancestors *");
  const normalResponse = await page.request.get("/boka/salong-eko");
  expect(normalResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  const host = createServer((_request, response) => { response.setHeader("content-type", "text/html"); response.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional salon host</title><body style="margin:0">${code}</body></html>`); });
  await new Promise<void>(resolve => host.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto(`http://127.0.0.1:${(host.address() as AddressInfo).port}`);
    const frame = page.frameLocator('iframe[title="Book with Flerdo"]');
    await frame.getByPlaceholder(/^For example: .+ some afternoon next week$/).fill("sports massage next available with Erik");
    await frame.getByPlaceholder(/^For example: .+ some afternoon next week$/).press("Enter");
    await frame.getByRole("button", { name: /until \d\d:\d\d/ }).first().click();
    await frame.getByLabel("Your name", { exact: true }).fill("Widget Demo");
    await frame.getByLabel("Mobile number").fill("070-000 99 22");
    await frame.getByRole("button", { name: "Confirm booking", exact: true }).click();
    await expect(frame.getByRole("heading", { name: "You are booked" })).toBeVisible();
    await expect(frame.getByRole("link", { name: "Open booking details" })).toHaveAttribute("target", "_blank");
    await screenshot(page, "booking-widget");
  } finally { host.closeAllConnections(); await new Promise<void>(resolve => host.close(() => resolve())); }
});

test("join a fully booked day's waiting list and find the request in Inbox", async ({ page }) => {
  await page.goto("/boka/salong-eko");
  await page.getByPlaceholder(/^For example: .+ some afternoon next week$/).waitFor();
  // A controlled full-day fixture exercises the public no-availability path.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("salong-eko-demo")!) as DemoState;
    const template = saved.bookings[0];
    for (const staffId of ["anna", "erik"] as const) for (const [start, duration] of [[540, 180], [780, 240]]) saved.bookings.push({ ...template, id: `full-${staffId}-${start}`, staffId, serviceId: "medical-foot-care", date: "2026-11-24", start, duration, status: "booked" });
    localStorage.setItem("salong-eko-demo", JSON.stringify(saved));
  });
  await page.reload();
  await page.getByPlaceholder(/^For example: .+ some afternoon next week$/).fill("foot care on 2026-11-24");
  await page.getByPlaceholder(/^For example: .+ some afternoon next week$/).press("Enter");
  await page.getByRole("button", { name: "Notify me about Tuesday 24 November" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Waiting Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 33");
  await page.getByRole("button", { name: "Put me on the list" }).click();
  await expect(page.getByText("You are on the list", { exact: true })).toBeVisible();
  await page.goto("/studio/inbox");
  await expect(page.getByRole("button", { name: /Waiting Demo.*Waiting list/ })).toBeVisible();
});
