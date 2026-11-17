import { randomUUID } from "node:crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { expect, test, type Page } from "@playwright/test";
import { addDays, formatTime } from "../../src/concept/data/dates";
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
  return page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo")!));
}
/** Quick commands go through the assistant panel: the button on phones, Ctrl+K (the keyboard shortcut) from tablet width. */
async function command(page: Page, text: string) {
  if (page.viewportSize()!.width < 640) await page.getByRole("button", { name: `Ask ${ASSISTANT.name}`, exact: true }).locator("visible=true").click();
  else await page.keyboard.press("Control+K");
  const message = page.getByRole("textbox", { name: "Message" });
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
  }, createDemoState(today));
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
  await expect(page.getByText("Suggestion", { exact: true }).first()).toBeVisible();
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

test("the owner marks Anna off on Friday and Today asks to move the affected bookings", async ({ page }) => {
  await page.goto("/studio");
  await command(page, "Anna is off on Friday");
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
  for (let i = 0; i < 25; i++) await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("the owner/staff demo switch works both ways from the top bar on a phone, and the choice survives a reload", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "The top bar is the phone and tablet shell; desktop has the switch above the content");
  await page.setViewportSize({ width: 390, height: 844 });
  const initial = createDemoState(today);
  const viewer = initial.staff[1];
  const tabs = page.getByRole("navigation", { name: "Main navigation" });
  await page.goto("/studio");
  await expect(tabs.getByRole("link", { name: "More" })).toBeVisible();

  await page.getByRole("button", { name: `Owner view. Switch to Staff · ${viewer.firstName}` }).click();
  await expect(tabs.getByRole("link", { name: "More" })).toHaveCount(0);
  await page.reload();
  const back = page.getByRole("button", { name: `${viewer.firstName} view. Switch to Owner` });
  await expect(back).toBeVisible();
  await expect(tabs.getByRole("link", { name: "More" })).toHaveCount(0);

  await back.click();
  await expect(tabs.getByRole("link", { name: "More" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Owner view. Switch to Staff · ${viewer.firstName}` })).toBeVisible();
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
  const previous = page.locator("figure svg rect[fill=none]");
  await expect(previous.first()).toBeAttached();
  expect(await previous.first().evaluate(el => getComputedStyle(el).stroke)).not.toBe("none");
  expect(await page.locator("[data-series=previous]").first().evaluate(el => getComputedStyle(el).backgroundImage)).toContain("repeating-linear-gradient");
});

test("Today names the staff member on every booking, not just a colour (#26)", async ({ page }) => {
  const initial = createDemoState(today);
  await page.goto("/studio");
  for (const booking of initial.bookings.filter(b => b.date === today).slice(0, 6)) {
    const customer = initial.customers.find(c => c.id === booking.customerId)!;
    const staff = initial.staff.find(s => s.id === booking.staffId)!;
    await expect(page.getByRole("button").filter({ hasText: fullName(customer) }).first()).toContainText(` · ${staff.firstName}`);
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
  for (const h of await heights("dialog form button, dialog header button")) expect(h).toBeGreaterThanOrEqual(44);
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  for (const h of await heights("header a")) expect(h).toBeGreaterThanOrEqual(44);
});
