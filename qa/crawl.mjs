// Crawl every internal link reachable from the main entry pages, as owner and as staff.
// Reports non-200 documents, console errors, page errors, failed requests and hydration warnings.
import { launch, newContext, watch, save, settle, APEX, DEMO } from "./lib.mjs";

const STARTS = [APEX + "/", "/studio", "/boka/salong-eko"];
const MAX_PAGES = Number(process.env.QA_CRAWL_MAX ?? 220);
const PER_PATTERN = 3; // e.g. at most 3 different /studio/customers/<id> pages

const pattern = p => p.replace(/\/k\d+\b/g, "/:id").replace(/\/[0-9a-f-]{8,}\b/gi, "/:id").replace(/\?.*$/, "?q");

async function crawl(browser, role) {
  const context = await newContext(browser, { viewport: "desktop", role });
  const page = await context.newPage();
  const issues = watch(page, []);
  const seen = new Set(), perPattern = new Map(), pages = [];
  const queue = STARTS.map(p => ({ path: p, from: "(start)" }));
  while (queue.length && pages.length < MAX_PAGES) {
    const { path, from } = queue.shift();
    if (seen.has(path)) continue;
    const pat = pattern(path);
    if ((perPattern.get(pat) ?? 0) >= PER_PATTERN) continue;
    seen.add(path); perPattern.set(pat, (perPattern.get(pat) ?? 0) + 1);
    const before = issues.length;
    let status = 0, finalUrl = "";
    try {
      const res = await page.goto(new URL(path, DEMO).href, { waitUntil: "domcontentloaded", timeout: 30000 });
      status = res?.status() ?? 0;
      await settle(page);
      await page.waitForTimeout(500); // client-rendered studio
      finalUrl = page.url().replace(DEMO, "");
      const hrefs = await page.$$eval("a[href]", as => as.map(a => a.getAttribute("href")));
      for (const href of hrefs) {
        if (!href || /^(mailto:|tel:|sms:|javascript:|#)/.test(href)) continue;
        let u; try { u = new URL(href, page.url()); } catch { continue; }
        if (![new URL(APEX).host, new URL(DEMO).host].includes(u.host)) continue;
        const next = (u.host === new URL(APEX).host ? APEX : "") + u.pathname + u.search;
        if (!seen.has(next)) queue.push({ path: next, from: path });
      }
    } catch (e) {
      if (/Download is starting/.test(e.message)) { pages.push({ path, from, status: 200, finalUrl: "(download)", issues: [] }); issues.splice(before); continue; }
      issues.push({ kind: "navigation", url: path, text: String(e.message).split("\n")[0] }); }
    pages.push({ path, from, status, finalUrl, issues: issues.slice(before).map(i => `${i.kind}: ${i.text}`) });
  }
  await context.close();
  return { role, pages, issues };
}

const browser = await launch();
const out = [];
for (const role of ["owner", "staff"]) out.push(await crawl(browser, role));
await browser.close();
save("crawl.json", out);
let bad = 0;
for (const r of out) {
  console.log(`\n# ${r.role}: ${r.pages.length} pages`);
  for (const p of r.pages) if (p.status !== 200 || p.issues.length) { bad++; console.log(`${p.status} ${p.path} (from ${p.from}) ${p.issues.join(" ; ")}`); }
}
console.log(`\n${bad} pages with problems`);
process.exitCode = bad ? 1 : 0; // crawl problems are listed above
