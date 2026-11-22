import { randomUUID } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { expect, test, type Page } from "@playwright/test";
import { addDays, formatTime } from "../../src/concept/data/dates";
import { englishDemoState, salonState } from "./fixtures";
import { createDemoState } from "../../src/concept/data/generate";
import { freeStarts } from "../../src/concept/data/slots";
import type { DemoState } from "../../src/concept/data/types";
import { fullName } from "../../src/concept/selectors";
import { ASSISTANT } from "../../src/concept/brand";
import { DEV_TOKEN } from "../../src/concept/server/token";
import { salonClock } from "../../src/concept/tools/clock";

// Whole journeys through the owner's studio and the customer page. They run
// on the real date (the server's demo business for agents does too), and use
// the browser's saved demo state as the single source of truth.

const today = salonClock().today;
const tomorrow = addDays(today, 1);
const errors = new WeakMap<Page, string[]>();

async function state(page: Page): Promise<DemoState> {
  return salonState(page) as Promise<DemoState>;
}
/** Quick commands go through the assistant panel: the button on phones, Ctrl+K (the keyboard shortcut) from tablet width. */
async function command(page: Page, text: string) {
  if (page.viewportSize()!.width < 640) await page.getByRole("button", { name: ASSISTANT.name, exact: true }).locator("visible=true").click();
  const message = page.getByRole("textbox", { name: "Message" });
  // The shortcut only works once the studio has hydrated: press until the panel is there.
  if (page.viewportSize()!.width >= 640) await expect(async () => {
    await page.keyboard.press("Control+K");
    await expect(message).toBeVisible({ timeout: 1000 });
  }).toPass();
  await message.fill(text);
  await message.press("Enter");
}

/** A booking tomorrow, and a free time that day to move it to. */
function moveTarget(initial: DemoState) {
  for (const booking of initial.bookings.filter(b => b.status === "booked" && b.date >= tomorrow)) {
    for (let i = 0; i < 14; i++) {
      const date = addDays(booking.date, i);
      const start = freeStarts(initial, booking.staffId, date, booking, { ignoreId: booking.id }).find(s => s !== booking.start || date !== booking.date);
      if (start !== undefined && date >= tomorrow) return { booking, date, start };
    }
  }
  throw new Error("No booking to move in the demo data");
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

test("a customer books online and the booking appears in the studio", async ({ page }) => {
  await page.goto("/boka/salong-eko");
  const ask = page.getByRole("textbox", { name: /What would you like to book/ });
  await ask.fill("Foot care day after tomorrow with Anna");
  await ask.press("Enter");
  await page.getByRole("button", { name: /until \d\d:\d\d/ }).first().click();
  await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 12");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();

  await page.goto("/studio/customers");
  await page.getByRole("searchbox").or(page.getByPlaceholder("Search name or phone")).first().fill("Nova Demo");
  await page.getByRole("link", { name: /Nova Demo/ }).click();
  await expect(page.getByRole("heading", { name: "Nova Demo" })).toBeVisible();
  const saved = await state(page);
  const booking = saved.bookings.at(-1)!;
  expect(booking.status).toBe("booked");
  await page.goto("/studio/inbox");
  await expect(page.getByText(/Nova Demo/).first()).toBeVisible();
});

test("a customer books for someone else and the studio shows the guest and the contact", async ({ page }) => {
  await page.goto("/boka/salong-eko");
  const ask = page.getByRole("textbox", { name: /What would you like to book/ });
  await ask.fill("Foot care day after tomorrow with Anna");
  await ask.press("Enter");
  await page.getByRole("button", { name: /until \d\d:\d\d/ }).first().click();
  const who = page.getByRole("radiogroup", { name: "Who is the visit for?" });
  await expect(who.getByRole("radio", { name: "For me" })).toBeChecked();
  await expect(page.getByLabel("Name of the person visiting")).toHaveCount(0);
  await who.getByRole("radio", { name: "For someone else" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 13");
  await expect(page.getByRole("button", { name: "Confirm booking", exact: true })).toBeDisabled();
  await page.getByLabel("Name of the person visiting").fill("Elsa Demo");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You are booked" })).toBeVisible();
  await expect(page.getByText("Visit for Elsa Demo")).toBeVisible();
  await expect(page.getByText(/The visit is for Elsa Demo\./)).toBeVisible();

  const saved = await state(page);
  const booking = saved.bookings.at(-1)!;
  const contact = saved.customers.find(c => c.id === booking.customerId)!;
  expect(booking.visitFor).toBe("Elsa Demo");
  expect(fullName(contact)).toBe("Nova Demo");
  expect(saved.customers.some(c => c.firstName === "Elsa" && c.lastName === "Demo")).toBe(false);

  await page.goto(`/studio/customers/${contact.id}`);
  await page.getByRole("button", { name: /Visit for Elsa Demo/ }).first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Elsa Demo" })).toBeVisible();
  await expect(sheet.getByText("Booked by")).toBeVisible();
  await expect(sheet.getByText("Nova Demo")).toBeVisible();
  await expect(sheet.getByRole("link", { name: /070-000 99 13/ })).toBeVisible();
});

test("the owner moves a booking with a quick command and undoes it", async ({ page }) => {
  await page.goto("/studio");
  const { booking, date, start } = moveTarget(await state(page));
  const owner = fullName((await state(page)).customers.find(c => c.id === booking.customerId)!);
  await command(page, `Move ${owner} to ${date} at ${formatTime(start)}`);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(async () => (await state(page)).bookings.find(b => b.id === booking.id)?.start).toBe(start);
  expect((await state(page)).bookings.find(b => b.id === booking.id)?.date).toBe(date);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await state(page)).bookings.find(b => b.id === booking.id)?.start).toBe(booking.start);
  expect((await state(page)).bookings.find(b => b.id === booking.id)?.date).toBe(booking.date);
});

test("a journal entry typed after a visit is structured and saved", async ({ page }) => {
  const initial = createDemoState(today);
  const customer = initial.customers.find(c => initial.bookings.some(b => b.customerId === c.id && b.status === "completed"))!;
  await page.goto(`/studio/customers/${customer.id}`);
  await page.getByRole("radio", { name: /^Journal/ }).click();
  await page.getByRole("button", { name: "Dictate entry", exact: true }).click();
  await page.getByLabel("What happened").fill("Did the usual foot care. Some dry skin on both heels. Recommend cream every evening. Next visit in 6 weeks.");
  await page.getByRole("button", { name: "Structure entry", exact: true }).click();
  await expect(page.getByLabel("Treatment", { exact: true })).not.toHaveValue("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Journal entry saved")).toBeVisible();
  await expect.poll(async () => (await state(page)).journals.filter(j => j.customerId === customer.id).length)
    .toBe(initial.journals.filter(j => j.customerId === customer.id).length + 1);
});

test("a campaign goes from a Today suggestion to published", async ({ page }) => {
  await page.goto("/studio");
  // Suggestions are rows in the attention card: each has its own action and can be dismissed.
  await expect(page.getByRole("button", { name: "Dismiss suggestion" }).first()).toBeVisible();
  const more = page.getByRole("button", { name: /Show \d+ more suggestions?/ });
  if (await more.isVisible()) await more.click();
  await page.getByRole("link", { name: /Make a campaign|Make an offer/ }).first().click();
  await expect(page.getByRole("heading", { name: "Campaign studio" })).toBeVisible();
  await page.getByRole("button", { name: "Write the texts" }).click();
  await page.getByRole("button", { name: "Make the poster" }).click();
  await page.getByRole("button", { name: "See it in each channel" }).click();
  await page.getByRole("button", { name: "Publish everywhere" }).click();
  await expect(page.getByText(/^Published: /)).toBeVisible();
  await expect.poll(async () => (await state(page)).campaigns.filter(c => c.status !== "draft").length).toBeGreaterThan(0);
});

test("a proposal from an outside AI waits in the Inbox until the owner approves it", async ({ page, baseURL }) => {
  await page.goto("/studio");
  await page.evaluate(() => fetch("/api/concept/proposals", { method: "DELETE" }));
  const initial = await state(page);
  const { booking, date, start } = moveTarget(initial);

  const client = new Client({ name: "concept-e2e", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("/api/concept/mcp", baseURL), { requestInit: { headers: { authorization: `Bearer ${DEV_TOKEN}`, "user-agent": "claude-code/e2e" } } }));
  try {
    const result = await client.callTool({ name: "propose_move", arguments: { bookingId: booking.id, date, time: formatTime(start), idempotencyKey: randomUUID() } });
    expect(JSON.stringify(result.content), "propose_move result").not.toContain("error");
    expect(result.isError).toBeFalsy();
  } finally {
    await client.close();
  }

  await page.goto("/studio/inbox");
  await expect(page.getByText("Claude", { exact: false }).first()).toBeVisible();
  await expect(state(page).then(s => s.bookings.find(b => b.id === booking.id)?.start)).resolves.toBe(booking.start);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect.poll(async () => (await state(page)).bookings.find(b => b.id === booking.id)?.start).toBe(start);
});

/** A weekday at least two days ahead on which Anna has bookings, so the journey never depends on today's date or time. */
function annaBookedWeekday(initial: DemoState): string {
  const anna = initial.staff.find(member => member.firstName === "Anna");
  if (!anna) throw new Error("No Anna in the demo data");
  for (let offset = 2; offset <= 6; offset++) {
    const date = addDays(today, offset);
    if (initial.bookings.some(b => b.staffId === anna.id && b.date === date && b.status === "booked"))
      return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
  }
  throw new Error("Anna has no bookings in the coming week of the demo data");
}

test("the owner marks Anna off on a booked day and Today asks to move the affected bookings", async ({ page }) => {
  await page.goto("/studio");
  await command(page, `Anna is off on ${annaBookedWeekday(englishDemoState(today))}`);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.goto("/studio");
  await expect(page.getByText(/\d+ bookings? needs? moving/)).toBeVisible();
  await expect(page.getByText(/Anna is off/).first()).toBeVisible();
});

test("a sheet traps focus, closes with Escape and gives focus back", async ({ page }) => {
  await page.goto("/studio");
  const trigger = page.getByRole("button", { name: "Someone is calling" });
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // A modal dialog lets Tab pass through the browser's own UI (focus on <body>) once per round; it never reaches the page behind.
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest("dialog")), `Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("staff preview starts in Advanced, works both ways on a phone and survives a reload", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "Checks the phone navigation");
  await page.setViewportSize({ width: 390, height: 844 });
  const initial = createDemoState(today);
  const viewer = initial.staff[1];
  const tabs = page.getByRole("navigation", { name: "Main navigation" });
  const preview = page.getByRole("button", { name: "Preview the staff view", exact: true });
  await page.goto("/studio");
  await expect(tabs.getByRole("link", { name: "More" })).toBeVisible();
  await expect(preview).toHaveCount(0);
  await expect(page.locator('[data-help="role-switch"]')).toHaveCount(0);

  await tabs.getByRole("link", { name: "More" }).click();
  await page.getByRole("main").getByRole("link", { name: /^Advanced/ }).click();
  await preview.click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(tabs.getByRole("link", { name: "More" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(`Staff preview · ${viewer.firstName}`, { exact: true })).toBeVisible();
  const back = page.getByRole("button", { name: "Back to the owner view", exact: true });
  await expect(back).toBeVisible();
  await expect(tabs.getByRole("link", { name: "More" })).toHaveCount(0);

  await back.click();
  await expect(tabs.getByRole("link", { name: "More" })).toBeVisible();
  await page.reload();
  await expect(tabs.getByRole("link", { name: "More" })).toBeVisible();
  await expect(back).toHaveCount(0);
  await page.goto("/studio/more/advanced");
  await expect(preview).toBeVisible();
});

test("Edit on a proposal brings the words back into the message box and retires the old proposal", async ({ page }) => {
  await page.goto("/studio");
  await command(page, "Anna is off on Friday");
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  await expect(approve).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("Anna is off on Friday");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeFocused();
  await expect(approve).toHaveCount(0);
  await expect(page.getByText("Edited · your words are back in the message box")).toBeVisible();
});

test("finance charts mark the period before with an outline or dashes, not colour alone (Codex #10)", async ({ page }) => {
  await page.goto("/studio/more/finance");
  await expect(page.getByRole("heading", { name: "Left over this month" })).toBeVisible();
  await expect(page.getByText(/^vs .+ at this point last month$/)).toBeVisible();
  const previous = page.locator("figure svg rect[fill=none]");
  await expect(previous.first()).toBeAttached();
  expect(await previous.first().evaluate(el => getComputedStyle(el).stroke)).not.toBe("none");
  expect(await page.locator("[data-series=previous]").first().evaluate(el => getComputedStyle(el).backgroundImage)).toContain("repeating-linear-gradient");
  await page.getByRole("button", { name: "Send to my accountant" }).click();
  const sheet = page.getByRole("dialog", { name: "Send to my accountant" });
  await expect(sheet.getByText(/^The files cover /)).toBeVisible();
  for (const [name, filename] of [
    ["Download bookkeeping file", "cresavo-bookkeeping.sie"],
    ["Download sales spreadsheet", "cresavo-sales.csv"],
  ]) {
    const downloading = page.waitForEvent("download");
    await sheet.getByRole("button", { name }).click();
    expect((await downloading).suggestedFilename()).toBe(filename);
  }
});

test("Today names the staff member on every booking, not just a colour (#26)", async ({ page }) => {
  // A fixed weekday: the demo salon has no bookings at weekends.
  const day = "2026-11-17";
  await page.clock.install({ time: new Date(day + "T10:00:00+01:00") });
  const initial = createDemoState(day);
  await page.goto("/studio");
  // Today shows the next few rows first; the whole day is one tap away.
  await page.getByRole("button", { name: /^Show all \(\d+\)$/ }).click();
  for (const booking of initial.bookings.filter(b => b.date === day).slice(0, 6)) {
    const customer = initial.customers.find(c => c.id === booking.customerId)!;
    const staff = initial.staff.find(s => s.id === booking.staffId)!;
    await expect(page.getByRole("button").filter({ hasText: fullName(customer) }).first()).toContainText(`${staff.firstName} · `);
  }
});

test("switches, segmented options, assistant composer buttons and the booking header link are 44 px targets (Codex #11, #30)", async ({ page }) => {
  const heights = (selector: string) => page.locator(selector).evaluateAll(els => els.filter(e => e.getBoundingClientRect().width > 0).map(e => Math.round(e.getBoundingClientRect().height)));
  await page.goto("/studio/more/features");
  await expect(page.getByRole("switch").first()).toBeVisible();
  const switches = await heights("[role=switch]");
  expect(switches.length).toBeGreaterThan(3);
  for (const h of switches) expect(h).toBeGreaterThanOrEqual(44);
  await page.goto("/studio/more/settings");
  await expect(page.getByRole("radio").first()).toBeVisible();
  for (const h of await heights("[role=radiogroup] [role=radio]")) expect(h).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Control+K");
  await page.getByRole("textbox", { name: "Message" }).fill("hello");
  for (const h of await heights("dialog form button, dialog [data-sheet-header] button")) expect(h).toBeGreaterThanOrEqual(44);
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  for (const h of await heights("header a")) expect(h).toBeGreaterThanOrEqual(44);
});

test("at 200 % zoom on a 390 px phone the main pages fit, the assistant is one icon and tabs do not overlap (#25)", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "A phone check; one project is enough");
  await page.setViewportSize({ width: 195, height: 422 });
  for (const url of ["/studio", "/studio/customers", "/studio/more/settings", "/boka/salong-eko"]) {
    await page.goto(url);
    await expect(page.locator("main").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), url).toBeLessThanOrEqual(0);
  }
  await page.goto("/studio");
  const ask = page.getByRole("button", { name: ASSISTANT.name, exact: true }).locator("visible=true");
  expect((await ask.boundingBox())!.width).toBeLessThanOrEqual(48);
  const tabs = await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link").evaluateAll(links => links.map(l => {
    const r = l.getBoundingClientRect();
    return { left: r.left, right: r.right, name: l.textContent };
  }));
  expect(tabs.map(t => t.name)).toEqual(["Today", "Calendar", "Customers", "Inbox", "More"].map(n => expect.stringContaining(n)));
  for (let i = 1; i < tabs.length; i++) expect(tabs[i].left).toBeGreaterThanOrEqual(tabs[i - 1].right - 0.5);
  await ask.click();
  await expect(page.getByRole("dialog", { name: ASSISTANT.name })).toBeVisible();
});
