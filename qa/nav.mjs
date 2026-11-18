// Navigation: tab bar at 390 px, sidebar at 1280 px, back/forward, deep links + reload, dark mode, overflow.
import { launch, newContext, recorder, save, shot, settle, watch, DEMO } from "./lib.mjs";

import { MAIN_PAGES } from "./pages.mjs";

const r = recorder("navigation");
const browser = await launch();
const issues = [];
const slug = p => p.replace(/^\//, "").replace(/[/?=&]/g, "_") || "root";
const h1 = page => page.locator("h1").first().innerText({ timeout: 8000 }).catch(() => "(no h1)");
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

// 1. Mobile tab bar.
{
  const ctx = await newContext(browser, { viewport: "mobile" }); const page = await ctx.newPage(); watch(page, issues);
  await page.goto(DEMO + "/studio"); await settle(page);
  const tabs = page.getByRole("navigation", { name: "Main navigation" });
  await r.check("390: tab bar shows Today, Calendar, Customers, Inbox, More", async () => {
    const names = (await tabs.getByRole("link").allInnerTexts()).map(t => t.replace(/\s+/g, " ").trim());
    for (const n of ["Today", "Calendar", "Customers", "Inbox", "More"]) if (!names.some(x => x.startsWith(n))) throw new Error(`missing ${n} in ${names.join("|")}`);
    const box = await tabs.boundingBox(); if (!box || box.y + box.height < 800) throw new Error(`tab bar not at the bottom: ${JSON.stringify(box)}`);
    return names.join(" | ");
  });
  for (const [name, path] of [["Calendar", "/studio/calendar"], ["Customers", "/studio/customers"], ["Inbox", "/studio/inbox"], ["More", "/studio/more"], ["Today", "/studio"]])
    await r.check(`390: tab ${name} opens ${path} and is marked current`, async () => {
      await tabs.getByRole("link", { name: new RegExp(`^${name}`) }).click();
      await page.waitForURL(u => new URL(u).pathname === path, { timeout: 10000 });
      const current = await tabs.locator('[aria-current="page"]').innerText().catch(() => "");
      if (!current.startsWith(name)) throw new Error(`aria-current on "${current}"`);
      return `h1=${await h1(page)}`;
    });
  for (const path of MAIN_PAGES) {
    await page.goto(DEMO + path); await settle(page);
    await r.check(`390: no horizontal overflow on ${path}`, async () => { const o = await overflow(page); if (o > 0) throw new Error(`scrollWidth exceeds viewport by ${o}px`); });
    await shot(page, `nav-390-${slug(path)}`, { fullPage: true });
  }
  await ctx.close();
}

// 2. Desktop sidebar + back/forward + deep links.
{
  const ctx = await newContext(browser, { viewport: "desktop" }); const page = await ctx.newPage(); watch(page, issues);
  await page.goto(DEMO + "/studio"); await settle(page);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const links = await nav.getByRole("link").evaluateAll(as => as.map(a => ({ name: a.textContent.trim(), href: a.getAttribute("href") })));
  for (const { name, href } of links)
    await r.check(`1280: sidebar "${name}" opens ${href}`, async () => {
      await nav.locator(`a[href="${href}"]`).first().click();
      await page.waitForURL(u => new URL(u).pathname === href, { timeout: 10000 });
      return `h1=${await h1(page)}`;
    });
  await r.check("back/forward through Today > Calendar > Customers > customer card", async () => {
    await page.goto(DEMO + "/studio"); await settle(page);
    await nav.getByRole("link", { name: "Calendar", exact: true }).click(); await page.waitForURL(/\/studio\/calendar/);
    await nav.getByRole("link", { name: "Customers", exact: true }).click(); await page.waitForURL(/\/studio\/customers$/);
    await page.locator('main a[href^="/studio/customers/k"]').first().click(); await page.waitForURL(/\/studio\/customers\/k\d+/);
    const customer = await h1(page);
    await page.goBack(); await page.waitForURL(/\/studio\/customers$/);
    await page.goBack(); await page.waitForURL(/\/studio\/calendar/);
    await page.goBack(); await page.waitForURL(u => new URL(u).pathname === "/studio");
    await page.goForward(); await page.waitForURL(/\/studio\/calendar/);
    await page.goForward(); await page.waitForURL(/\/studio\/customers$/);
    await page.goForward(); await page.waitForURL(/\/studio\/customers\/k\d+/);
    const again = await h1(page); if (again !== customer) throw new Error(`customer h1 ${customer} then ${again}`);
    return `customer=${customer}`;
  });
  await r.check("in-page back link on a customer card returns to Customers", async () => {
    await page.goto(DEMO + "/studio/customers/k209"); await settle(page);
    await page.getByRole("main").getByRole("link", { name: "Customers", exact: true }).click();
    await page.waitForURL(/\/studio\/customers$/);
  });
  for (const path of ["/studio/customers/k209", "/studio/more/finance", "/studio/more/campaigns/c-autumn", "/studio/calendar", "/boka/salong-eko/me"])
    await r.check(`deep link + reload: ${path}`, async () => {
      await page.goto(DEMO + path); await settle(page); const a = await h1(page);
      await page.reload(); await settle(page); const b = await h1(page);
      if (a === "(no h1)" || a !== b) throw new Error(`h1 "${a}" then "${b}"`);
      return `h1=${a}`;
    });
  for (const path of MAIN_PAGES) {
    await page.goto(DEMO + path); await settle(page);
    await r.check(`1280: no horizontal overflow on ${path}`, async () => { const o = await overflow(page); if (o > 0) throw new Error(`overflow ${o}px`); });
    await shot(page, `nav-1280-${slug(path)}`, { fullPage: true });
  }
  await ctx.close();
}

// 3. Dark mode (system dark), both widths; checks that the page really is dark.
for (const viewport of ["mobile", "desktop"]) {
  const ctx = await newContext(browser, { viewport, dark: true }); const page = await ctx.newPage(); watch(page, issues);
  for (const path of MAIN_PAGES) {
    await page.goto(DEMO + path); await settle(page);
    // A salon's booking page keeps the salon's own colours (Salong Eko's theme is light) by design: screenshot only.
    if (path.startsWith("/boka/")) { await shot(page, `dark-${viewport === "mobile" ? 390 : 1280}-${slug(path)}`, { fullPage: true }); continue; }
    await r.check(`dark ${viewport}: ${path} renders with a dark background`, async () => {
      const lum = await page.evaluate(() => {
        let el = document.querySelector("main") ?? document.body, c = "";
        while (el) { c = getComputedStyle(el).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) break; el = el.parentElement; }
        const [r, g, b] = (c.match(/\d+(\.\d+)?/g) ?? ["255", "255", "255"]).map(Number);
        return { c, l: 0.2126 * r + 0.7152 * g + 0.0722 * b };
      });
      if (lum.l > 100) throw new Error(`background ${lum.c} looks light`);
      return lum.c;
    });
    await shot(page, `dark-${viewport === "mobile" ? 390 : 1280}-${slug(path)}`, { fullPage: true });
  }
  await ctx.close();
}
// 4. The in-app theme switch overrides the system setting and survives reload.
{
  const ctx = await newContext(browser, { viewport: "desktop" }); const page = await ctx.newPage(); watch(page, issues);
  await r.check("Appearance: Dark radio switches the studio to dark and survives reload", async () => {
    await page.goto(DEMO + "/studio"); await settle(page);
    await page.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "Dark" }).click();
    await page.reload(); await settle(page);
    const t = await page.evaluate(() => document.documentElement.dataset.theme); if (t !== "dark") throw new Error(`data-theme=${t}`);
    return `data-theme=${t}`;
  });
  await ctx.close();
}
await browser.close();
save("nav.json", { results: r.results, issues });
console.log(`${r.results.filter(x => !x.ok).length} failing checks; ${issues.length} console/network issues`);
for (const i of issues) console.log(`  ${i.kind} ${i.url} ${i.text}`);
