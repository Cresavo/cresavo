// Reproduces each candidate finding of this round (own + Codex) in a fresh browser context and records what happened.
// Each check returns an observation; "REPRO" means the problem shows, "NO-REPRO" means it does not.
import { launch, newContext, save, settle, shot, state, DEMO, TENANT, APEX, PRODUCT, getHost as get } from "./lib.mjs";

const browser = await launch();
const results = [];
const b = (p, name) => p.getByRole("button", { name, exact: true });
const dlg = p => p.getByRole("dialog").last();
async function check(id, title, fn, viewport = "mobile") {
  const ctx = await newContext(browser, { viewport });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await page.clock.setFixedTime(new Date("2026-11-18T08:00:00+01:00"));
  try { const r = await fn(page, ctx); results.push({ id, title, ...r }); console.log(`${r.verdict} ${id} ${title} :: ${r.observed}`); }
  catch (e) { results.push({ id, title, verdict: "ERROR", observed: String(e.message).split("\n")[0] }); console.log(`ERROR ${id} ${title} :: ${String(e.message).split("\n")[0]}`); await shot(page, `verify-${id}-error`).catch(() => {}); }
  finally { await ctx.close(); }
}
const go = async (p, url) => { await p.goto(url.startsWith("http") ? url : DEMO + url); await settle(p); };
async function publicBook(p, origin, name, phone, time = "13:00", confirm = true) {
  await go(p, origin);
  await b(p, "Book Medical foot care").click();
  await b(p, "Tomorrow").or(p.getByRole("radio", { name: /^Tomorrow/ })).first().click().catch(() => {});
  await b(p, time).click();
  await p.getByPlaceholder("First and last name").fill(name);
  await p.getByPlaceholder("070-123 45 67").fill(phone);
  if (confirm) { await b(p, "Confirm booking").click(); await p.waitForTimeout(600); }
}

// ---- Codex findings ----
await check("C01", "second tab overwrites a confirmed booking", async (p, ctx) => {
  const q = await ctx.newPage();
  await publicBook(p, "/boka/salong-eko", "Tab One Demo", "070-000 11 11", "13:00", false);
  await publicBook(q, "/boka/salong-eko", "Tab Two Demo", "070-000 22 22", "13:00", false);
  await b(p, "Confirm booking").click(); await p.waitForTimeout(600);
  await b(q, "Confirm booking").click(); await q.waitForTimeout(600);
  const secondConfirmed = await q.getByRole("heading", { name: "You are booked" }).count();
  const s = await state(q);
  const names = s.customers.filter(c => /Tab (One|Two) Demo/.test(`${c.firstName} ${c.lastName}`)).map(c => `${c.firstName} ${c.lastName}`);
  await shot(q, "verify-C01-second-tab");
  return { verdict: secondConfirmed || !names.includes("Tab One Demo") ? "REPRO" : "NO-REPRO", observed: `second tab confirmed: ${!!secondConfirmed}; customers in saved state: ${JSON.stringify(names)}` };
});
await check("C02", "booking on the salon subdomain is invisible in the demo studio", async (p) => {
  await publicBook(p, TENANT + "/", "Subdomain Demo", "070-000 33 33");
  const confirmText = await p.getByText(/saved in the owner's Inbox/).count();
  await go(p, "/studio/inbox");
  const seen = await p.getByText(/Subdomain Demo/).count();
  await shot(p, "verify-C02-demo-inbox");
  return { verdict: confirmText && !seen ? "REPRO" : "NO-REPRO", observed: `confirmation claims owner's Inbox: ${confirmText > 0}; demo-host Inbox shows it: ${seen > 0} (each origin has its own localStorage)` };
});
await check("C03", "apex 'Explore the demo' loops back to the coming-soon page", async (p) => {
  const html = (await get(PRODUCT, "/")).body;
  const href = (html.match(/href="([^"]*)"[^>]*>[^<]*Explore the demo/) ?? [])[1];
  await go(p, APEX + "/");
  await p.getByRole("link", { name: /Explore the demo/ }).first().click(); await settle(p);
  await shot(p, "verify-C03-after-explore");
  return { verdict: href === "/" ? "REPRO" : "NO-REPRO", observed: `server-rendered href=${JSON.stringify(href)}; after click url=${p.url()} title=${await p.title()}` };
});
await check("C04", "a first-time caller cannot be added from 'Someone is calling'", async (p) => {
  await go(p, "/studio");
  await b(p, "Someone is calling").click();
  await dlg(p).getByRole("searchbox").fill("QA New Customer"); await p.waitForTimeout(300);
  const addInCaller = await dlg(p).getByRole("button", { name: /new customer|add/i }).count();
  await dlg(p).getByRole("button", { name: /^\d\d:\d\d Anna/ }).first().click();
  await dlg(p).getByRole("searchbox").fill("QA New Customer"); await p.waitForTimeout(300);
  const text = (await dlg(p).innerText()).replace(/\s+/g, " ");
  const addInForm = await dlg(p).getByRole("button", { name: /new customer|add customer|create/i }).count();
  await shot(p, "verify-C04-new-caller");
  return { verdict: !addInCaller && !addInForm ? "REPRO" : "NO-REPRO", observed: `add action in caller sheet: ${addInCaller}; in New booking: ${addInForm}; form says "${(text.match(/No customer[^.]*\.?/) ?? ["(no message)"])[0]}"` };
});
await check("C05", "caller lookup needs the stored phone formatting", async (p) => {
  await go(p, "/studio");
  const s0 = await state(p) ?? null;
  await b(p, "Someone is calling").click();
  const box = dlg(p).getByRole("searchbox");
  const out = [];
  for (const v of ["070-173 74 60", "0701737460", "+46 70 173 74 60"]) { await box.fill(v); await p.waitForTimeout(250); out.push(`${v}: ${await dlg(p).getByText("Agneta Ek", { exact: true }).count()}`); }
  await go(p, "/studio/customers");
  await p.getByPlaceholder("Search name or phone").fill("0701737460"); await p.waitForTimeout(300);
  out.push(`Customers search 0701737460: ${await p.getByText("Agneta Ek").count()}`);
  return { verdict: /0701737460: 0/.test(out.join()) ? "REPRO" : "NO-REPRO", observed: out.join("; ") + (s0 ? "" : "") };
});
await check("C06", "a free 45-min gap preselects a 60-min treatment", async (p) => {
  await go(p, "/studio");
  await b(p, "Someone is calling").click();
  const gap = dlg(p).getByRole("button", { name: /^\d\d:\d\d Anna · 45 min/ }).first();
  const label = await gap.innerText(); await gap.click();
  const pressed = await dlg(p).locator('button[aria-pressed="true"]').first().innerText();
  await dlg(p).getByRole("searchbox").fill("Agneta Ek"); await dlg(p).getByText("Agneta Ek", { exact: true }).first().click();
  const bookBtn = dlg(p).getByRole("button", { name: /^Book \d\d:\d\d$/ });
  const enabled = await bookBtn.isEnabled();
  const noFree = await dlg(p).getByText("No free times this day").count();
  if (enabled) await bookBtn.click();
  await p.waitForTimeout(500);
  const after = (await p.locator("body").innerText()).match(/That time is no longer free[^\n]*/)?.[0] ?? "";
  await shot(p, "verify-C06-gap-default");
  return { verdict: enabled && /1 h/.test(pressed) ? "REPRO" : "NO-REPRO", observed: `gap "${label.replace(/\s+/g, " ")}"; preselected "${pressed.replace(/\s+/g, " ")}"; "No free times" shown: ${noFree > 0}; Book enabled: ${enabled}; after click: "${after}"` };
});
await check("C07", "public booking accepts an all-zero mobile number", async (p) => {
  await publicBook(p, "/boka/salong-eko", "Zero Phone Demo", "00000000", "13:00", false);
  const confirm = b(p, "Confirm booking");
  if (await confirm.isDisabled()) return { verdict: "NO-REPRO", observed: "Confirmation is disabled for 00000000." };
  await confirm.click();
  await p.waitForTimeout(600);
  const ok = await p.getByRole("heading", { name: "You are booked" }).count();
  await shot(p, "verify-C07-zero-phone");
  return { verdict: ok ? "REPRO" : "NO-REPRO", observed: ok ? "booking confirmed with 00000000" : "rejected" };
});
await check("C08", "Morning brief still says the cancelled 15:00 slot is free after it is filled", async (p) => {
  await go(p, "/studio");
  await b(p, "Someone is calling").click();
  await dlg(p).getByRole("searchbox").fill("Agneta Ek");
  await dlg(p).getByRole("button", { name: "Book", exact: true }).first().click();
  await dlg(p).getByRole("button", { name: /^Basic foot care/ }).click();
  await dlg(p).getByRole("button", { name: "14:45", exact: true }).click();
  await dlg(p).getByRole("button", { name: "Book 14:45" }).click(); await p.waitForTimeout(600);
  const brief = await p.getByText(/cancelled 15:00 today: the slot is free/).count();
  const row = await p.getByRole("button", { name: /^14:45 Agneta Ek/ }).count();
  await p.getByText(/Morning brief/).scrollIntoViewIfNeeded(); await shot(p, "verify-C08-brief");
  return { verdict: row && brief ? "REPRO" : "NO-REPRO", observed: `Agneta booked 14:45-15:30: ${row > 0}; brief still says 15:00 is free: ${brief > 0}` };
});
await check("C09", "room filter shows 0 bookings under an unqualified '81% booked'", async (p) => {
  await go(p, "/studio/calendar");
  await b(p, "Rooms").click(); await p.waitForTimeout(300);
  await p.getByRole("dialog").last().getByText("Room 2", { exact: true }).click().catch(async () => p.getByText("Room 2", { exact: true }).first().click());
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  const t = (await p.locator("main").innerText()).replace(/\s+/g, " ");
  await shot(p, "verify-C09-room2");
  const pct = t.match(/\d+% booked/)?.[0], n = t.match(/\d+ bookings?/)?.[0];
  return { verdict: pct && /^0 /.test(n ?? "") ? "REPRO" : "NO-REPRO", observed: `header "${pct}", column "${n}"` };
});
await check("C10", "public reschedule to the same time says 'moved'", async (p) => {
  await publicBook(p, "/boka/salong-eko", "Same Time Demo", "070-000 44 44");
  await p.getByText("Reschedule", { exact: true }).first().click(); await p.waitForTimeout(300);
  const currentTime = b(p, "13:00");
  if (!await currentTime.count()) return { verdict: "NO-REPRO", observed: "The current slot is excluded from the move picker." };
  await currentTime.click();
  const confirm = p.getByRole("button", { name: /^Move to / });
  const enabled = await confirm.isEnabled();
  if (enabled) await confirm.click();
  await p.waitForTimeout(400);
  const moved = await p.getByText("Your booking is moved").count();
  await shot(p, "verify-C10-same-time");
  return { verdict: moved ? "REPRO" : "NO-REPRO", observed: `same time selectable: ${enabled}; "Your booking is moved" shown: ${moved > 0}` };
});
await check("C11", "Back from details to times clears name and phone", async (p) => {
  await publicBook(p, "/boka/salong-eko", "Keep Me Demo", "070-000 55 55", "13:00", false);
  await b(p, "Back").click(); await b(p, "14:00").click();
  const n = await p.getByPlaceholder("First and last name").inputValue(), ph = await p.getByPlaceholder("070-123 45 67").inputValue();
  await shot(p, "verify-C11-after-back");
  return { verdict: !n && !ph ? "REPRO" : "NO-REPRO", observed: `name="${n}" phone="${ph}"` };
});
await check("C12", "floating Assistant button covers the 15:00 'Cancelled' badge at 390", async (p) => {
  await go(p, "/studio");
  const fab = await b(p, "Assistant").locator("visible=true").boundingBox();
  const badge = await p.getByText("Cancelled", { exact: true }).first().boundingBox();
  const overlap = fab && badge && !(badge.x > fab.x + fab.width || badge.x + badge.width < fab.x || badge.y > fab.y + fab.height || badge.y + badge.height < fab.y);
  await shot(p, "verify-C12-fab");
  return { verdict: overlap ? "REPRO" : "NO-REPRO", observed: `fab ${JSON.stringify(fab)} badge ${JSON.stringify(badge)}` };
});
await check("C13", "'three times' heading above two suggestions", async (p) => {
  await go(p, "/boka/salong-eko");
  const ask = p.getByRole("textbox", { name: "What would you like to book?" });
  await ask.fill("Ingrown nail treatment tomorrow after work");
  await ask.press("Enter");
  const head = (await p.locator("body").innerText()).match(/Here are [^\n]*/)?.[0] ?? "";
  const cards = await p.getByRole("button", { name: /until \d\d:\d\d/ }).count();
  await shot(p, "verify-C13-three-times");
  return { verdict: /three/.test(head) && cards < 3 ? "REPRO" : "NO-REPRO", observed: `heading "${head}", ${cards} suggestions` };
});
await check("C14", "cancel offers the slot to the waiting list by default; offer missing from Sent log", async (p) => {
  await go(p, "/studio");
  await p.getByRole("button", { name: /^17:00 / }).first().click();
  await dlg(p).getByRole("button", { name: "Cancel booking" }).click();
  const sw = dlg(p).getByRole("switch").or(dlg(p).getByRole("checkbox"));
  const defaultOn = (await sw.count()) ? await sw.first().isChecked() : "no switch";
  await dlg(p).getByRole("button", { name: "Cancel booking" }).click(); await p.waitForTimeout(500);
  await go(p, "/studio/inbox");
  const inAll = await p.getByText(/offered/i).count();
  await p.getByRole("radio", { name: "Sent log", exact: true }).click(); await p.waitForTimeout(300);
  const sent = (await p.locator("main").innerText()).replace(/\s+/g, " ");
  await shot(p, "verify-C14-sent-log");
  return { verdict: defaultOn === true ? "REPRO" : "NO-REPRO", observed: `waiting-list offer default on: ${defaultOn}; 'offered' items in All: ${inAll}; Sent log mentions offer: ${/offered/i.test(sent)}` };
});
await check("C15", "Staff Today shows a bare schedule on a day off", async (p) => {
  await go(p, "/studio");
  await p.getByRole("button", { name: /Owner view\. Switch to Staff/ }).or(p.getByRole("radio", { name: /^Staff/ })).first().click(); await settle(p);
  const t = (await p.locator("main").innerText()).replace(/\s+/g, " ");
  await shot(p, "verify-C15-staff-today", { fullPage: true });
  const sched = t.match(/Today's schedule(.{0,80})/)?.[1] ?? "(no schedule heading)";
  return { verdict: /day off|no bookings|nothing booked|no visits/i.test(t) ? "NO-REPRO" : "REPRO", observed: `after "Today's schedule": "${sched}"` };
});

// ---- own findings (re-run from a clean context) ----
await check("O01", "assistant cannot answer three everyday questions", async (p) => {
  await go(p, "/studio");
  await b(p, "Assistant").locator("visible=true").click();
  const panel = p.getByRole("dialog", { name: "Assistant" });
  const out = [];
  for (const q of ["Is Erik free on Friday afternoon?", "What is running low in stock?", "What are the opening hours on Saturday?"]) {
    await panel.getByRole("textbox", { name: "Message" }).fill(q); await panel.getByRole("textbox", { name: "Message" }).press("Enter"); await p.waitForTimeout(1500);
    out.push(`${q} -> ${(await panel.getByRole("log").innerText()).includes("I did not understand") ? "did not understand" : "answered"}`);
    await panel.getByRole("log").evaluate(el => el.scrollTop = el.scrollHeight);
  }
  await shot(p, "verify-O01-assistant");
  return { verdict: out.some(x => x.endsWith("did not understand")) ? "REPRO" : "NO-REPRO", observed: out.join("; ") };
}, "desktop");
await check("O02", "inbox shows today's messages with future timestamps early in the morning", async (p) => {
  await p.clock.setFixedTime(new Date(`${new Date().toISOString().slice(0, 10)}T06:30:00+01:00`));
  await go(p, "/studio/inbox");
  const times = (await p.locator("main").innerText()).match(/^\d\d:\d\d$/gm) ?? [];
  await shot(p, "verify-O02-inbox-0630");
  return { verdict: times.some(t => t > "06:30") ? "REPRO" : "NO-REPRO", observed: `clock 06:30, message times ${times.join(", ")}` };
});
await check("O03", "coming-soon page on the apex is served with X-Robots-Tag noindex", async () => {
  const r = await get(PRODUCT, "/");
  return { verdict: r.headers["x-robots-tag"] ? "REPRO" : "NO-REPRO", observed: `x-robots-tag=${r.headers["x-robots-tag"]}; x-middleware-rewrite=${r.headers["x-middleware-rewrite"]}` };
});
await check("O04", "unknown host friendly page answers 200 (soft 404)", async () => {
  const r = await get("some-unknown-salon.example", "/");
  return { verdict: r.status === 200 ? "REPRO" : "NO-REPRO", observed: `status ${r.status}` };
});
await check("O05", "'Your data & AI' links to discovery documents that answer 503", async (p) => {
  await go(p, "/studio/more/data");
  const hrefs = await p.locator('a[href*="/api/concept/"]').evaluateAll(as => as.map(a => a.getAttribute("href")));
  const st = [];
  for (const h of hrefs) st.push(`${h} ${(await get(`demo.${PRODUCT}`, h)).status}`);
  await shot(p, "verify-O05-data-page", { fullPage: true });
  return { verdict: st.some(s => / 503$/.test(s)) ? "REPRO" : "NO-REPRO", observed: st.join("; ") + " (needs BOOKING_PUBLIC_ORIGIN; check the Vercel env)" };
}, "desktop");
await check("O06", "a saved Svenska preference marks the English studio lang=sv", async (p, ctx) => {
  await ctx.addCookies([{ name: "booking-locale", value: "sv", url: DEMO }]);
  await go(p, "/studio");
  const lang = await p.evaluate(() => document.documentElement.lang);
  const greet = (await p.locator("h1").first().innerText());
  return { verdict: lang === "sv" ? "REPRO" : "NO-REPRO", observed: `studio html lang=${lang}, h1 "${greet}"` };
}, "desktop");
await check("O07", "staff calendar settings page asks /api/concept/calendar and gets 403 over plain http", async (p) => {
  const codes = []; p.on("response", r => { if (r.url().includes("/api/concept/calendar")) codes.push(r.status()); });
  await go(p, "/studio/more/staff");
  return { verdict: codes.includes(403) ? "REPRO" : "NO-REPRO", observed: `status ${codes.join(",")} in a secure context (https-like); 403 only appears on plain http where Chrome sends no Sec-Fetch-Site` };
}, "desktop");

await browser.close();
save("verify-findings.json", results);
