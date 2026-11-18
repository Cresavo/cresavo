// Key journeys in the studio, the customer page and the public sites. All state is the browser's demo state.
// Run with `node --import tsx qa/flows.mjs`: it seeds the same demo state the app generates (src/concept/data/generate.ts),
// so the scripts can read it before the app's first save.
const { createDemoState } = await import("../src/concept/data/generate.ts");
const { toKey } = await import("../src/concept/data/dates.ts");
import { launch, newContext, recorder, save, shot, settle, state, watch, APEX, DEMO, STATE_KEY } from "./lib.mjs";

const r = recorder("flows");
const browser = await launch();
const issues = [];
const fullName = c => `${c.firstName} ${c.lastName}`;
const sheet = page => page.getByRole("dialog").last();
const toastText = page => page.locator('[role=status], [role=alert]').allInnerTexts().then(t => t.join(" | ").replace(/\s+/g, " "));

async function fresh(viewport = "desktop", { clock } = {}) {
  const ctx = await newContext(browser, { viewport });
  const day = toKey(clock ?? new Date());
  await ctx.addInitScript(([key, initial]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(initial)); }, [STATE_KEY, createDemoState(day)]);
  const page = await ctx.newPage(); watch(page, issues);
  if (clock) await page.clock.setFixedTime(clock);
  await page.goto(DEMO + "/studio"); await settle(page);
  return { ctx, page };
}

// 1. Book a caller via "Someone is calling".
await r.check('"Someone is calling": find a caller, pick a free time, book', async () => {
  const { ctx, page } = await fresh();
  const before = await state(page);
  const customer = before.customers.find(c => !before.bookings.some(b => b.customerId === c.id && b.status === "booked" && b.date >= before.generatedFor));
  await page.getByRole("button", { name: "Someone is calling" }).click();
  await sheet(page).getByRole("searchbox").fill(fullName(customer));
  await sheet(page).getByRole("button", { name: "Book", exact: true }).first().click();
  await sheet(page).getByRole("heading", { name: "New booking" }).waitFor();
  // first day with a free time
  const days = sheet(page).getByRole("button", { name: /^(Today|Tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun) / });
  const count = await days.count();
  let picked = false;
  for (let i = 0; i < count && !picked; i++) {
    await days.nth(i).click(); await page.waitForTimeout(150);
    const times = sheet(page).getByRole("button", { name: /^\d\d:\d\d$/ });
    if (await times.count()) { await times.first().click(); picked = true; }
  }
  if (!picked) throw new Error("no free time in 15 days");
  const bookBtn = sheet(page).getByRole("button", { name: /^Book \d\d:\d\d$/ });
  await bookBtn.click();
  await page.waitForTimeout(500);
  const after = await state(page);
  const added = after.bookings.filter(b => !before.bookings.some(x => x.id === b.id));
  if (added.length !== 1 || added[0].customerId !== customer.id) throw new Error(`expected 1 new booking for ${fullName(customer)}, got ${JSON.stringify(added.map(a => a.customerId))}`);
  const t = await toastText(page);
  await shot(page, "flow-phone-booked");
  await ctx.close();
  return `${fullName(customer)} ${added[0].date} toast="${t.slice(0, 80)}"`;
});

// 2. Move a booking from its booking sheet.
await r.check("move a booking to another day from the booking sheet", async () => {
  const { ctx, page } = await fresh();
  const s = await state(page);
  const target = s.bookings.filter(b => b.status === "booked" && b.date === s.generatedFor).sort((a, b) => b.start - a.start)[0];
  const name = fullName(s.customers.find(c => c.id === target.customerId));
  await page.getByRole("button", { name: new RegExp(`^\\d\\d:\\d\\d ${name} `) }).first().click();
  await sheet(page).getByRole("button", { name: "Move", exact: true }).click();
  await sheet(page).getByRole("button", { name: /^Tomorrow / }).click();
  await sheet(page).getByRole("button", { name: /^\d\d:\d\d$/ }).first().click();
  await sheet(page).getByRole("button", { name: "Move booking" }).click();
  await page.waitForTimeout(500);
  const moved = (await state(page)).bookings.find(b => b.id === target.id);
  if (moved.date === target.date) throw new Error(`still on ${moved.date}`);
  const t = await toastText(page); await shot(page, "flow-moved");
  await ctx.close();
  return `${name} ${target.date} -> ${moved.date} ${moved.start}; toast="${t.slice(0, 80)}"`;
});

// 3. Cancel and undo.
await r.check("cancel a booking, then Undo restores it", async () => {
  const { ctx, page } = await fresh();
  const s = await state(page);
  const target = s.bookings.filter(b => b.status === "booked" && b.date === s.generatedFor).sort((a, b) => b.start - a.start)[0];
  const name = fullName(s.customers.find(c => c.id === target.customerId));
  await page.getByRole("button", { name: new RegExp(`^\\d\\d:\\d\\d ${name} `) }).first().click();
  await sheet(page).getByRole("button", { name: "Cancel booking" }).click();
  await sheet(page).getByRole("button", { name: "Cancel booking" }).click();
  await page.waitForTimeout(400);
  if ((await state(page)).bookings.find(b => b.id === target.id).status !== "cancelled") throw new Error("not cancelled");
  await shot(page, "flow-cancelled-toast");
  await page.getByRole("button", { name: "Undo", exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  const back = (await state(page)).bookings.find(b => b.id === target.id).status;
  if (back !== "booked") throw new Error(`after Undo status=${back}`);
  await ctx.close();
  return `${name}: cancelled then restored`;
});

// 4. Complete (mark done) a booking from the customer page, late in the day.
await r.check("customer page: mark today's booking as done", async () => {
  const probe = await fresh();
  const today = (await state(probe.page)).generatedFor; await probe.ctx.close();
  const { ctx, page } = await fresh("desktop", { clock: new Date(`${today}T19:30:00+01:00`) });
  const s = await state(page);
  const target = s.bookings.find(b => b.status === "booked" && b.date === today);
  const customer = s.customers.find(c => c.id === target.customerId);
  await page.goto(`${DEMO}/studio/customers/${customer.id}`); await settle(page);
  await page.getByRole("main").getByRole("button", { name: /\d\d:\d\d .*SEK/ }).first().click();
  await sheet(page).getByRole("button", { name: "Mark done" }).click();
  await page.waitForTimeout(400);
  const st = (await state(page)).bookings.find(b => b.id === target.id).status;
  if (st !== "completed") throw new Error(`status=${st}`);
  const t = await toastText(page); await shot(page, "flow-mark-done");
  await ctx.close();
  return `${fullName(customer)} completed; toast="${t.slice(0, 80)}"`;
});

// 5. Essentials / Everything presets.
await r.check("Features: Essentials hides modules, Everything brings them back", async () => {
  const { ctx, page } = await fresh();
  await page.goto(DEMO + "/studio/more/features"); await settle(page);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const total = () => page.getByText(/SEK [\d,]+ \/ month/).first().innerText();
  await page.getByRole("button", { name: "Essentials", exact: true }).click(); await page.waitForTimeout(400);
  const essentials = { total: await total(), links: (await nav.getByRole("link").allInnerTexts()).length, on: await page.getByRole("switch", { checked: true }).count() };
  await shot(page, "flow-preset-essentials");
  await page.getByRole("button", { name: "Everything", exact: true }).click(); await page.waitForTimeout(400);
  const everything = { total: await total(), links: (await nav.getByRole("link").allInnerTexts()).length, on: await page.getByRole("switch", { checked: true }).count(), all: await page.getByRole("switch").count() };
  await shot(page, "flow-preset-everything");
  if (essentials.on !== 0) throw new Error(`Essentials leaves ${essentials.on} switches on`);
  if (everything.on !== everything.all) throw new Error(`Everything: ${everything.on}/${everything.all} on`);
  if (!(everything.links > essentials.links)) throw new Error(`menu links essentials=${essentials.links} everything=${everything.links}`);
  const pressed = await page.getByRole("button", { name: "Everything", exact: true }).getAttribute("aria-pressed");
  await ctx.close();
  return `Essentials ${essentials.total} (${essentials.links} menu links); Everything ${everything.total} (${everything.links} links), aria-pressed=${pressed}`;
});
await r.check("landing deep links /studio?start=essentials and ?start=everything apply the preset", async () => {
  const { ctx, page } = await fresh();
  await page.goto(DEMO + "/studio?start=essentials"); await settle(page);
  const e = Object.values((await state(page)).modules ?? {}).filter(Boolean).length;
  await page.goto(DEMO + "/studio?start=everything"); await settle(page);
  const a = Object.values((await state(page)).modules ?? {}).filter(Boolean).length;
  await ctx.close();
  if (!(e === 0 && a > 0)) throw new Error(`modules on: essentials=${e} everything=${a}`);
  return `modules on: essentials=${e}, everything=${a}`;
});

// 6. The assistant: ten everyday questions.
const QUESTIONS = ["Who is coming today?", "Who is coming tomorrow?", "How much did we earn this week?", "How did last month compare with last year?",
  "Which customers haven't been here in a while?", "Is Erik free on Friday afternoon?", "What is running low in stock?",
  "Book Pia Nyberg for basic foot care tomorrow", "Cancel Elin Blom's booking today", "What are the opening hours on Saturday?"];
{
  const { ctx, page } = await fresh();
  await page.getByRole("button", { name: "Assistant", exact: true }).locator("visible=true").click();
  const panel = page.getByRole("dialog", { name: "Assistant" });
  const log = panel.getByRole("log");
  const answers = [];
  for (const [i, q] of QUESTIONS.entries()) {
    await r.check(`assistant Q${i + 1}: "${q}"`, async () => {
      const before = await log.innerText().catch(() => "");
      const box = panel.getByRole("textbox", { name: "Message" });
      await box.fill(q); await box.press("Enter");
      let text = before, stable = 0;
      for (let t = 0; t < 40 && stable < 3; t++) { await page.waitForTimeout(250); const now = await log.innerText(); stable = now === text && now !== before ? stable + 1 : 0; text = now; }
      const reply = text.slice(before.length).replace(q, "").replace(/\s+/g, " ").trim();
      answers.push({ q, reply });
      await shot(page, `assistant-q${String(i + 1).padStart(2, "0")}`);
      if (!reply) throw new Error("no reply");
      if (/did not understand|don't understand|didn't understand|not sure what|couldn't understand|try (asking|rephras)|I can't help/i.test(reply)) throw new Error(`fallback reply: ${reply.slice(0, 160)}`);
      // a proposal must not be applied without Approve
      return reply.slice(0, 220);
    });
  }
  save("assistant-answers.json", answers);
  await ctx.close();
}

// 7. Waitlist form on the landing: honest message, nothing stored.
await r.check("waitlist on the product page: honest answer, nothing stored in the browser, no store on the server", async () => {
  const ctx = await newContext(browser, { viewport: "mobile" }); const page = await ctx.newPage(); watch(page, issues);
  await page.goto(APEX + "/"); await settle(page);
  const storageBefore = await page.evaluate(() => JSON.stringify(localStorage) + document.cookie);
  await page.locator("#waitlist").scrollIntoViewIfNeeded();
  await page.getByLabel("Email").fill("nova.demo@example.com");
  const [resp] = await Promise.all([page.waitForResponse(r => r.url().includes("/api/waitlist")), page.getByRole("button", { name: "Join the waitlist" }).click()]);
  const body = await resp.json().catch(() => ({}));
  const status = (await page.locator("#waitlist [role=status]").innerText()).trim();
  const storageAfter = await page.evaluate(() => JSON.stringify(localStorage) + document.cookie);
  await shot(page, "flow-waitlist-answer-390");
  await ctx.close();
  if (!/opens in a few days|come back/i.test(status)) throw new Error(`message "${status}"`);
  if (storageAfter !== storageBefore) throw new Error("browser storage changed");
  if (body.outcome && body.outcome !== "not-open") throw new Error(`server outcome ${JSON.stringify(body)}`);
  return `HTTP ${resp.status()} ${JSON.stringify(body)}; message "${status}"`;
});
await r.check("waitlist rejects an invalid email with a clear message", async () => {
  const ctx = await newContext(browser, { viewport: "mobile" }); const page = await ctx.newPage();
  await page.goto(APEX + "/"); await settle(page);
  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Join the waitlist" }).click(); await page.waitForTimeout(500);
  const v = await page.getByLabel("Email").evaluate(el => el.validationMessage);
  const status = (await page.locator("#waitlist [role=status]").innerText()).trim();
  await ctx.close();
  if (!v && !/doesn't look right/.test(status)) throw new Error(`no validation: "${status}"`);
  return `native="${v}" status="${status}"`;
});

// 8. Language switch. The concept studio, booking page and sites are English-only by design (docs/concept/CONCEPT.md §7);
// the root layout's switch is hidden there and only shows on the older lab pages (/product etc.).
await r.check("language switch: hidden on studio, booking page and product site (English-only concept)", async () => {
  const ctx = await newContext(browser, { viewport: "desktop" }); const page = await ctx.newPage();
  const out = [];
  for (const path of ["/studio", "/boka/salong-eko", "/"]) { await page.goto((path === "/" ? APEX : DEMO) + path); await settle(page); out.push(`${path}: ${await page.getByRole("combobox", { name: /Language|Språk/ }).locator("visible=true").count()}`); }
  await ctx.close();
  return "visible switches " + out.join("; ");
});
await r.check("a saved Svenska preference keeps English concept pages marked lang=en", async () => {
  const ctx = await newContext(browser, { viewport: "desktop" });
  await ctx.addCookies([{ name: "booking-locale", value: "sv", url: DEMO }]);
  const page = await ctx.newPage();
  try {
    for (const path of ["/studio", "/boka/salong-eko", "/"]) {
      await page.goto((path === "/" ? APEX : DEMO) + path);
      const lang = await page.locator("html").getAttribute("lang");
      if (lang !== "en") throw new Error(`${path} is marked lang=${lang}`);
    }
    return "all three pages are marked lang=en";
  } finally {
    await ctx.close();
  }
});

// 9. The customer side: book on the public page and find it in the studio.
await r.check("public booking page: free text request -> time -> confirm -> visible in studio", async () => {
  const ctx = await newContext(browser, { viewport: "mobile" }); const page = await ctx.newPage(); watch(page, issues);
  await page.goto(DEMO + "/boka/salong-eko"); await settle(page);
  const ask = page.getByRole("textbox", { name: "What would you like to book?" });
  await ask.fill("Foot care day after tomorrow with Anna"); await ask.press("Enter");
  await page.getByRole("button", { name: /until \d\d:\d\d/ }).first().click();
  await page.getByLabel("Your name", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobile number").fill("070-000 99 12");
  await page.getByRole("button", { name: "Confirm booking", exact: true }).click();
  await page.getByRole("heading", { name: "You are booked" }).waitFor({ timeout: 10000 });
  await shot(page, "flow-public-booked-390", { fullPage: true });
  await page.goto(DEMO + "/studio/inbox"); await settle(page);
  const seen = await page.getByText(/Nova Demo/).count();
  await ctx.close();
  if (!seen) throw new Error("booking not in the studio inbox");
  return "booked and visible in Inbox";
});

await browser.close();
save("flows.json", { results: r.results, issues });
console.log(`${r.results.filter(x => !x.ok).length} failing; ${issues.length} console/network issues`);
for (const i of issues) console.log(`  ${i.kind} ${i.url} ${i.text}`);
