import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { bookingScene } from "../../scripts/record-landing-clips.mjs";
import { bookingMessage } from "../../src/concept/booking/messages";
import { openSlots } from "../../src/concept/booking/suggest";
import { BRAND } from "../../src/concept/brand";
import type { DemoState } from "../../src/concept/data/types";
import { englishDemoState, fixtureText } from "./fixtures";

const fixture = englishDemoState("2026-11-17");
const copy = fixtureText(fixture);

const errors = new WeakMap<Page, string[]>();
async function screenshot(page: Page, name: string) {
  if (process.env.CONCEPT_SCREENSHOTS !== "1") return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ animations: "disabled", path: `docs/concept/screens/night2-${name}-${page.viewportSize()!.width}.png`, fullPage: true });
}
async function state(page: Page): Promise<DemoState> { return page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!)); }
async function holdBookingLock(page: Page) {
  await page.evaluate(() => new Promise<void>(ready => {
    void navigator.locks.request("salong-eko-demo", () => new Promise<void>(release => {
      window.addEventListener("release-booking-lock", () => release(), { once: true });
      ready();
    }));
  }));
  return () => page.evaluate(() => { window.dispatchEvent(new Event("release-booking-lock")); });
}
async function startBooking(page: Page) {
  await page.goto("/boka/salong-eko");
  await page.getByRole("textbox", { name: /What would you like to book/ }).fill("Footcare day after tomorrow with Anna");
  await page.getByRole("textbox", { name: /What would you like to book/ }).press("Enter");
  await page.getByRole("button", { name: /until \d\d:\d\d/ }).first().click();
  await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 11");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
  // White-label: the confirmation carries a neutral demo notice, never the platform's name (#27).
  await expect(page.getByText(/^Fictional demo: confirmations are simulated/)).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(BRAND.name);
}

test.beforeEach(async ({ context, page }) => {
  await page.clock.install({ time: new Date("2026-11-17T10:00:00+01:00") });
  await context.addInitScript(initial => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(initial));
  }, fixture);
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
  const before = await state(page);
  const booking = before.bookings.at(-1)!;
  const email = page.getByRole("radio", { name: copy("messages.channel.email"), exact: true });
  const sms = page.getByRole("radio", { name: copy("messages.channel.sms"), exact: true });
  const simulate = page.getByRole("button", { name: copy("messages.simulate") });
  await expect(page.getByText(copy("messages.sent"), { exact: true })).toBeVisible();
  await email.click();
  await expect(page.getByText(bookingMessage(before, booking, "confirmation").body, { exact: true })).toBeVisible();
  await screenshot(page, "confirmation-email");
  await page.getByRole("radio", { name: copy("messages.kind.reminder"), exact: true }).click();
  await expect(sms).toBeChecked();
  await expect(page.getByText(bookingMessage(before, booking, "reminder").body, { exact: true })).toBeVisible();
  await screenshot(page, "reminder-sms");
  await simulate.click();
  await email.click();
  await screenshot(page, "reminder-email");
  await simulate.click();
  // The send is saved under the booking lock a moment after the click.
  await expect.poll(async () => (await state(page)).inbox.filter(item => item.delivery && item.bookingId === booking.id)).toHaveLength(4);
  await page.goto("/studio/inbox");
  await page.getByRole("radio", { name: copy("messages.log"), exact: true }).click();
  const subject = bookingMessage(before, booking, "reminder").subject;
  await expect(page.getByText(copy("messages.sentTitle", { channel: copy("messages.channel.sms"), subject }), { exact: true })).toBeVisible();
  await screenshot(page, "sent-inbox");
  await page.goto(`/boka/salong-eko/me?ref=${booking.customerId}`);
  await page.getByRole("link", { name: "Details" }).click();
  await page.waitForURL(/\/booking\//);
  await page.getByRole("button", { name: "Cancel booking", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel it" }).click();
  await expect(page.getByRole("heading", { name: "This booking is cancelled" })).toBeVisible();
  expect((await state(page)).log[0]).toMatchObject({ type: "booking/cancel", actor: "customer", source: "customer-page" });
  await page.getByRole("link", { name: "Book again" }).click();
  await expect(page.getByRole("combobox", { name: "Choose another time" })).toBeVisible();
  await expect(page).toHaveURL(/service=/);
});

test("review a completed visit, keep it private, approve in Inbox and publish on salon page", async ({ page }) => {
  await page.goto("/boka/salong-eko");
  await page.getByRole("textbox", { name: /What would you like to book/ }).waitFor();
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
  await expect(page).toHaveURL(/\/studio\/inbox\?filter=reviews$/);
  await expect(page.getByRole("radio", { name: "Reviews", exact: true })).toBeChecked();
  await page.getByRole("button", { name: /New review · approval needed/ }).click();
  await expect(page.getByRole("button", { name: "Approve for salon page", exact: true })).toBeVisible();
  await screenshot(page, "reviews-moderation");
  await page.goto("/studio/inbox");
  await page.getByRole("radio", { name: "Reviews", exact: true }).click();
  await page.getByRole("button", { name: /New review · approval needed/ }).click();
  const approve = page.getByRole("button", { name: "Approve for salon page", exact: true });
  await expect(approve).toBeVisible();
  await screenshot(page, "review-approval");
  await approve.click();
  const reply = "Thank you for coming in!";
  await page.getByRole("textbox", { name: "Suggested reply", exact: true }).fill(reply);
  await page.getByRole("button", { name: "Publish reply", exact: true }).click();
  await expect.poll(async () => (await state(page)).reviews.find(review => review.text === reviewText)?.reply).toBe(reply);
  await page.goto("/boka/salong-eko");
  await expect(page.getByText(reviewText, { exact: true })).toBeVisible();
  await screenshot(page, "review-public");
  await page.goto("/studio/more/features");
  const reviews = page.getByRole("switch", { name: "Reviews", exact: true });
  await reviews.click();
  await expect(reviews).not.toBeChecked();
  await page.goto("/studio/more/reviews");
  await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Reviews", exact: true })).toHaveCount(0);
  await expect(page.getByText(reviewText)).toHaveCount(0);
  await page.goto("/boka/salong-eko");
  await expect(page.getByText(reviewText, { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="#reviews"]')).toHaveCount(0);
});

test("copy clean share/widget code and book inside a cross-origin iframe", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/studio/more/settings/link");
  await page.getByLabel("Instagram bio link", { exact: true }).waitFor();
  const link = await page.getByLabel("Instagram bio link", { exact: true }).inputValue();
  expect(link).toBe(`${baseURL}/boka/salong-eko`);
  await page.getByRole("button", { name: "Copy booking link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  // The embed code is for whoever runs the salon's website: it lives under Advanced.
  await expect(page.getByLabel("Embed code", { exact: true })).toHaveCount(0);
  await page.goto("/studio/more/advanced");
  const code = await page.getByLabel("Embed code", { exact: true }).inputValue();
  await page.getByRole("button", { name: "Copy embed code", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await screenshot(page, "booking-share");
  const widgetResponse = await page.request.get("/boka/salong-eko/widget");
  expect(widgetResponse.headers()["content-security-policy"]).toContain("frame-ancestors *");
  const normalResponse = await page.request.get("/boka/salong-eko");
  expect(normalResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  const host = createServer((_request, response) => { response.setHeader("content-type", "text/html"); response.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional salon host</title><body style="margin:0">${code}</body></html>`); });
  await new Promise<void>(resolve => host.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto(`http://127.0.0.1:${(host.address() as AddressInfo).port}`);
    const frame = page.frameLocator('iframe[title="Book with Salong Eko"]');
    await frame.getByRole("textbox", { name: /What would you like to book/ }).fill("sports massage next available with Erik");
    await frame.getByRole("textbox", { name: /What would you like to book/ }).press("Enter");
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
  await page.getByRole("textbox", { name: /What would you like to book/ }).waitFor();
  // A controlled full-day fixture exercises the public no-availability path.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("salong-eko-demo")!) as DemoState;
    saved.modules.waitlist = true;
    const template = saved.bookings[0];
    for (const staffId of ["anna", "erik"] as const) for (const [start, duration] of [[540, 180], [780, 240]]) saved.bookings.push({ ...template, id: `full-${staffId}-${start}`, staffId, serviceId: "medical-foot-care", date: "2026-11-24", start, duration, status: "booked" });
    localStorage.setItem("salong-eko-demo", JSON.stringify(saved));
  });
  await page.reload();
  await page.getByRole("textbox", { name: /What would you like to book/ }).fill("foot care on 2026-11-24");
  await page.getByRole("textbox", { name: /What would you like to book/ }).press("Enter");
  await page.getByRole("button", { name: "Notify me about Tuesday 24 November" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Waiting Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 33");
  await expect(page.getByRole("checkbox", { name: "Remember my details on this device" })).not.toBeChecked();
  await page.getByRole("button", { name: "Put me on the list" }).click();
  await expect(page.getByText("You are on the list", { exact: true })).toBeVisible();
  await page.goto("/studio/inbox");
  await expect(page.getByRole("button", { name: /Waiting list.*Waiting Demo/ })).toBeVisible();
});

for (const picker of ["alternate time", "full calendar"] as const) {
  test(`repeat booking through the ${picker} picker keeps the practitioner on the waiting list`, async ({ page }) => {
    const day = picker === "alternate time" ? "2026-11-24" : "2026-11-17";
    await page.goto("/boka/salong-eko");
    await page.evaluate(({ day, picker }) => {
      const saved: DemoState = JSON.parse(localStorage.getItem("salong-eko-demo")!);
      saved.modules.waitlist = true;
      saved.services.find(service => service.id === "classic-60")!.staffIds = ["anna", "erik"];
      saved.bookings = [{ ...saved.bookings[0], id: "repeat-visit", serviceId: "classic-60", staffId: "erik", date: "2026-11-16", status: "completed" }];
      saved.exceptions = [{ id: "erik-off", staffId: "erik", date: day, kind: "off", reason: "vacation" }];
      if (picker === "full calendar") {
        const erik = saved.staff.find(person => person.id === "erik")!;
        erik.week = Object.fromEntries(Object.keys(erik.week).map(weekday => [weekday, null]));
      }
      localStorage.setItem("salong-eko-demo", JSON.stringify(saved));
    }, { day, picker });
    expect(openSlots(await state(page), "classic-60", day, { today: "2026-11-17", minutes: 600 }, { staffId: "anna" }).length).toBeGreaterThan(0);
    await page.goto("/boka/salong-eko/booking/repeat-visit");
    await page.getByRole("link", { name: "Book again" }).click();
    if (picker === "alternate time") {
      await page.getByRole("combobox", { name: "Choose another time" }).selectOption(`${day}/wait`);
    } else {
      await page.getByRole("button", { name: "Notify me if something opens up" }).click();
    }
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(/Classic massage 60 min with Erik/)).toBeVisible();
    await sheet.getByLabel("Your name", { exact: true }).fill("Waiting Demo");
    await sheet.getByLabel("Mobile number").fill("070-000 99 33");
    await sheet.getByRole("button", { name: "Put me on the list" }).click();
    await expect(sheet.getByText("You are on the list", { exact: true })).toBeVisible();
    expect((await state(page)).inbox[0].requestedStaffId).toBe("erik");
    await page.goto("/studio/inbox");
    await page.getByRole("button", { name: /Waiting list.*Waiting Demo/ }).click();
    // The list row and the open thread both show the request; check the open thread.
    await expect(page.getByText(/Waiting Demo wants Classic massage 60 min with Erik on Tuesday/).last()).toBeVisible();
  });
}

for (const visibility of ["hidden", "retired"] as const) {
  test(`the widget offers a fresh choice when a previous treatment is ${visibility}`, async ({ context, page }) => {
    await page.goto("/boka/salong-eko/widget");
    await page.getByRole("button", { name: "Choose a treatment from the list" }).click();
    await page.getByRole("button", { name: /^Basic foot care/ }).click();
    await page.getByLabel("Your name", { exact: true }).fill("Widget Demo");
    await page.getByLabel("Mobile number").fill("070-000 99 22");
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();

    const owner = await context.newPage();
    await owner.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
    await owner.goto("/studio/more/services");
    const edit = owner.getByRole("button", { name: "Edit Basic foot care" });
    await edit.click();
    const sheet = owner.getByRole("dialog");
    await sheet.getByText("More options").click();
    if (visibility === "hidden") {
      await sheet.getByRole("switch", { name: "Show on the booking page" }).click();
      await sheet.getByRole("button", { name: "Save" }).click();
      await expect(edit).toHaveAccessibleDescription(/Hidden/);
      // The owner's tab shows the change at once and saves it a moment later; the customer's tab sees it once saved.
      await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("salong-eko-demo")!) as DemoState).services.find(service => service.name === "Basic foot care")?.hidden)).toBe(true);
    } else {
      await sheet.getByRole("button", { name: "Delete", exact: true }).click();
      await sheet.getByRole("button", { name: "Delete, keep bookings" }).click();
      await expect(edit).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem("salong-eko-demo")!) as DemoState).services.some(service => service.name === "Basic foot care"))).toBe(false);
    }

    await page.getByRole("button", { name: "Book again" }).click();
    await page.getByRole("button", { name: "Choose a treatment from the list" }).click();
    await expect(page.getByRole("button", { name: /^Basic foot care/ })).toHaveCount(0);
    await page.getByRole("button", { name: /^Medical foot care/ }).click();
    await expect(page.getByRole("heading", { name: "Medical foot care" })).toBeVisible();
  });
}

test("two tabs cannot confirm the same public booking time", async ({ context, page }) => {
  const other = await context.newPage();
  await other.clock.install({ time: new Date("2026-11-17T10:00:00+01:00") });
  const ask = "Footcare day after tomorrow with Anna";
  async function prepare(tab: Page, name: string, phone: string) {
    await tab.goto("/boka/salong-eko");
    const field = tab.getByRole("textbox", { name: /What would you like to book/ });
    await field.fill(ask);
    await field.press("Enter");
    const slot = tab.getByRole("button", { name: /until \d\d:\d\d/ }).first();
    const time = await slot.innerText();
    await slot.click();
    await tab.getByLabel("Your name", { exact: true }).fill(name);
    await tab.getByLabel("Mobile number").fill(phone);
    return { time, confirm: tab.getByRole("button", { name: "Confirm booking", exact: true }) };
  }
  const [first, second] = await Promise.all([
    prepare(page, "First Caller", "070-000 99 61"),
    prepare(other, "Second Caller", "070-000 99 62"),
  ]);
  expect(first.time).toBe(second.time);
  // Model a renderer observing the previous snapshot briefly after the other
  // tab commits. Web Locks alone do not make localStorage reads coherent.
  await Promise.all([page, other].map(tab => tab.evaluate(() => {
    const read = Storage.prototype.getItem;
    const initial = localStorage.getItem("salong-eko-demo");
    const write = Storage.prototype.setItem;
    let localWrite = false;
    Storage.prototype.setItem = function (key, value) {
      if (key === "salong-eko-demo") localWrite = true;
      write.call(this, key, value);
    };
    let caughtUpAt: number | undefined;
    Storage.prototype.getItem = function (key) {
      const value = read.call(this, key);
      if (!localWrite && key === "salong-eko-demo" && value !== initial) {
        caughtUpAt ??= performance.now() + 200;
        if (performance.now() < caughtUpAt) return initial;
      }
      return value;
    };
  })));
  await Promise.all([first.confirm.click(), second.confirm.click()]);
  const conflicts = [page, other].map((tab) => tab.getByText("Sorry, that time was just taken. Please choose another.", { exact: true }));
  await expect.poll(async () => (await Promise.all(conflicts.map((message) => message.count()))).reduce((sum, count) => sum + count, 0)).toBe(1);
  const [rejected, accepted] = await conflicts[0].count() ? [page, other] : [other, page];
  await expect(accepted.getByRole("heading", { name: "You are booked" })).toBeVisible();
  await expect(rejected.getByRole("heading", { name: "You are booked" })).toHaveCount(0);
  await expect(rejected.getByRole("button", { name: "Show all times" })).toBeVisible();
  const nextSlot = rejected.getByRole("button", { name: /until \d\d:\d\d/ }).first();
  await expect(nextSlot).toBeVisible();
  await expect(nextSlot).not.toHaveText(first.time, { useInnerText: true });
  expect(await rejected.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(rejected.viewportSize()!.width);
  const snapshot = await state(page);
  const contacts = snapshot.customers.filter((customer) => customer.lastName === "Caller");
  expect(contacts).toHaveLength(1);
  expect(snapshot.bookings.filter((booking) => booking.customerId === contacts[0].id)).toHaveLength(1);
});

test("the treatment list offers a complete visit and remembers contact only by consent", async ({ page }) => {
  const home = "/boka/salong-eko";
  await page.goto(home);
  const service = fixture.services.find(item => item.id === "medical-foot-care")!;
  await page.getByRole("button", { name: copy("booking.bookService", { service: service.name }), exact: true }).click();
  const name = page.getByLabel(copy("booking.yourName"), { exact: true });
  const mobile = page.getByLabel(copy("booking.yourPhone"));
  const remember = page.getByRole("checkbox", { name: copy("booking.rememberContact") });
  const confirm = page.getByRole("button", { name: copy("booking.confirm") });
  await expect(page.getByText(copy("booking.nextAvailable"), { exact: true })).toBeVisible();
  const form = page.locator("form").filter({ has: name });
  await expect(form.getByText(copy("protection.alreadyLate", { hours: 24 }), { exact: true })).toBeVisible();
  await expect(form.getByText(/free to change or cancel online until/i)).toHaveCount(0);
  await expect(form.getByText(copy("booking.summary.deadlinePassedPhone", { phone: fixture.salon.phone }), { exact: true })).toBeVisible();
  await expect(remember).not.toBeChecked();
  await name.fill("Nova Demo");
  await mobile.fill("070-000 99 11");
  await confirm.click();
  const again = page.getByRole("link", { name: copy("booking.me.rebook") });
  await again.click();
  await expect(name).toHaveValue("");
  await name.fill("Nova Demo");
  await mobile.fill("070-000 99 11");
  const chooseTime = page.getByRole("combobox", { name: copy("booking.changeTime") });
  const alternative = await chooseTime.locator("optgroup option:not([value$='/wait'])").last().getAttribute("value");
  await chooseTime.selectOption(alternative!);
  await expect(page.getByText(copy("booking.yourVisit"), { exact: true })).toBeVisible();
  await expect(mobile).toHaveValue("070-000 99 11");
  await remember.check();
  await confirm.click();
  await again.click();
  await expect(name).toHaveValue("Nova Demo");
  await expect(mobile).toHaveValue("070-000 99 11");
  await expect(remember).toBeChecked();
  await mobile.fill("070-000 99 12");
  await expect(remember).not.toBeChecked();
  await mobile.fill("070-000 99 11");
  await remember.uncheck();
  await confirm.click();
  await expect(again).toBeVisible();
  const saved = await state(page);
  const visits = saved.bookings.slice(-3);
  expect(new Set(visits.map(b => b.id)).size).toBe(3);
  expect(new Set(visits.map(b => [b.serviceId, b.staffId, b.customerId].join("/"))).size).toBe(1);
  await page.goto(home);
  await page.getByRole("link", { name: copy("booking.myBookings"), exact: true }).click();
  await expect(page.getByRole("heading", { name: copy("booking.me.lookupTitle") })).toBeVisible();
  await mobile.fill("070-000 99 11");
  await page.getByRole("button", { name: copy("booking.me.find") }).click();
  await expect(page.getByRole("link", { name: copy("booking.me.details") })).toHaveCount(3);
});

test("opting out while confirmation waits keeps contact details off the device", async ({ page }) => {
  await page.goto("/boka/salong-eko");
  await page.getByRole("button", { name: "Book Basic foot care" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 11");
  const remember = page.getByRole("checkbox", { name: "Remember my details on this device" });
  await remember.check();

  const release = await holdBookingLock(page);
  const confirm = page.getByRole("button", { name: "Confirm booking" });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await remember.uncheck();
  await release();
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("booking-guest-opt-in:salong-eko"))).toBeNull();
  await page.getByRole("link", { name: "Book again" }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("");
});

test.describe("customers in another time zone", () => {
  test.use({ timezoneId: "America/New_York" });

  test("availability and confirmation use Stockholm time for the booking lead", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-17T14:00:00+01:00"));
    await page.goto("/boka/salong-eko");
    await page.evaluate(() => {
      const saved: DemoState = JSON.parse(localStorage.getItem("salong-eko-demo")!);
      saved.bookings = [];
      saved.exceptions = [];
      localStorage.setItem("salong-eko-demo", JSON.stringify(saved));
    });
    await page.reload();
    await page.getByRole("button", { name: "Book Basic foot care" }).click();
    await expect(page.getByText(/Tuesday 17 November, 15:00–15:45/)).toBeVisible();
    const times = page.getByRole("combobox", { name: "Choose another time" });
    await expect(times.locator('optgroup[label="Tuesday 17 November"] option').first()).toHaveText(/15:00/);
    await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
    await page.getByLabel("Mobile number").fill("070-000 99 11");

    const release = await holdBookingLock(page);
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await page.clock.setFixedTime(new Date("2026-11-17T14:01:00+01:00"));
    await release();
    await expect(page.getByText("Sorry, that time was just taken. Please choose another.")).toBeVisible();
    expect((await state(page)).bookings).toHaveLength(0);
  });

  test("the online change cutoff and calendar export refer to the same Stockholm visit", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-17T09:59:00+01:00"));
    await page.goto("/boka/salong-eko");
    const id = await page.evaluate(() => {
      const saved: DemoState = JSON.parse(localStorage.getItem("salong-eko-demo")!);
      const booking = saved.bookings.find(visit => visit.status === "booked")!;
      Object.assign(booking, { date: "2026-11-18", start: 600 });
      localStorage.setItem("salong-eko-demo", JSON.stringify(saved));
      return booking.id;
    });
    await page.goto(`/boka/salong-eko/booking/${id}`);
    const google = new URL((await page.getByRole("link", { name: "Google Calendar" }).getAttribute("href"))!);
    expect(google.searchParams.get("dates")).toMatch(/^20261118T090000Z\//);
    await page.getByRole("button", { name: "Cancel booking", exact: true }).click();
    const release = await holdBookingLock(page);
    await page.getByRole("button", { name: "Yes, cancel it" }).click();
    await page.clock.setFixedTime(new Date("2026-11-17T10:01:00+01:00"));
    await release();
    await expect(page.getByText("This visit has changed. Check the current booking details.")).toBeVisible();
    expect((await state(page)).bookings.find(booking => booking.id === id)?.status).toBe("booked");
    await page.reload();
    await expect(page.getByText(/Less than 24 hours left/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel booking", exact: true })).toHaveCount(0);
  });
});

test("the landing clip uses the suggested appointment as its booking poster", async ({ page, baseURL }) => {
  let frame: Locator | undefined;
  await bookingScene(page, {
    async shot(target: Locator) {
      await expect(target).toBeVisible();
      frame = target;
    },
    click: (target: Locator) => target.click(),
    type: (target: Locator, value: string) => target.fill(value),
    async poster() { await expect(frame!).toHaveText("Next available appointment"); },
  }, baseURL);
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
});

test("the confirmation link moves the same visit, exports its new time and enforces the new cutoff", async ({ page }) => {
  await startBooking(page);
  const before = (await state(page)).bookings.at(-1)!;
  const manage = page.getByRole("link", { name: "Manage this booking" });
  await expect(manage).toHaveAttribute("href", `/boka/salong-eko/booking/${before.id}#manage`);
  await manage.click();
  await page.getByRole("button", { name: "Reschedule" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Move to / }).first().click();
  await expect(page.getByText("Your booking is moved", { exact: true })).toBeVisible();
  const saved = await state(page);
  const moved = saved.bookings.find(b => b.id === before.id)!;
  expect(saved.log[0]).toMatchObject({ type: "booking/move", actor: "customer", source: "customer-page" });
  expect([moved.date, moved.start]).not.toEqual([before.date, before.start]);
  expect(moved.status).toBe("booked");
  const google = new URL((await page.getByRole("link", { name: "Google Calendar" }).getAttribute("href"))!);
  expect(google.hostname).toBe("calendar.google.com");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download calendar file/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`salong-eko-${moved.date}.ics`);
  const contents = await file.createReadStream();
  const bytes = [];
  for await (const part of contents!) bytes.push(part);
  const [start, end] = google.searchParams.get("dates")!.split("/");
  expect(Buffer.concat(bytes).toString()).toContain(`DTSTART:${start}\r\nDTEND:${end}`);
  // The first replacement is later today, inside the online change window.
  await expect(page.getByText(/Less than 24 hours left/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel booking", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Book again" })).toBeVisible();
});

test("a shared gift card shows its ledger balance and a printed card can be looked up", async ({ page }) => {
  const home = "/boka/salong-eko";
  const code = "EKO-7K2Q-93XD";
  await page.goto(home);
  await page.getByRole("button", { name: "Book Medical foot care" }).waitFor();
  await page.evaluate(code => {
    const s: DemoState = JSON.parse(localStorage.getItem("salong-eko-demo")!);
    s.giftCards.push({
      id: "card-demo", code, amount: 600, recipient: "Nova Demo", message: "", soldOn: s.generatedFor,
      redemptions: [{ bookingId: s.bookings.find(b => b.status === "completed")!.id, amount: 200, date: s.generatedFor }],
    });
    localStorage.setItem("salong-eko-demo", JSON.stringify(s));
  }, code);
  await page.goto(`${home}/gift?code=${code}&amount=900&to=Nova`);
  await expect(page.getByText("SEK 400 left", { exact: true })).toBeVisible();
  await expect(page.getByText("SEK 600", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Book a treatment" }).click();
  await page.locator("summary").filter({ hasText: "Gift card balance" }).click();
  await page.getByLabel("Gift card code").fill(code);
  await page.getByRole("button", { name: "Check balance" }).click();
  await expect(page.getByRole("status").filter({ hasText: "SEK 400 left" })).toBeVisible();
  await page.goto(`${home}/gift?code=unknown&amount=600&to=Nova`);
  await expect(page.getByText("The current balance is unavailable on this device.")).toBeVisible();
});
