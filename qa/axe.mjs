// axe-core on every main page: light 1280, dark 1280, light 390. WCAG 2.x A/AA rules + best practices.
import { axeTags } from "./axe-source.mjs";
import { UNKNOWN, launch, newContext, save, settle, axeSource, DEMO, APEX, TENANT } from "./lib.mjs";

const PAGES = [
  `${APEX}/`, `${DEMO}/`, `${DEMO}/privacy`, `${TENANT}/`, `${UNKNOWN}/`,
  ...["/studio", "/studio/calendar", "/studio/customers", "/studio/customers/k209", "/studio/inbox", "/studio/more", "/studio/more/services",
    "/studio/more/booking-page", "/studio/more/staff", "/studio/more/stock", "/studio/more/giftcards", "/studio/more/packages", "/studio/more/campaigns",
    "/studio/more/campaigns/new", "/studio/more/finance", "/studio/more/reviews", "/studio/more/memory", "/studio/more/routines", "/studio/more/features",
    "/studio/more/data", "/studio/more/log", "/studio/more/settings", "/studio/welcome", "/boka/salong-eko", "/boka/salong-eko/me", "/boka/salong-eko/gift"].map(p => DEMO + p),
];
const MODES = [{ name: "light-1280", viewport: "desktop" }, { name: "dark-1280", viewport: "desktop", dark: true }, { name: "light-390", viewport: "mobile" }];
const source = axeSource();
const browser = await launch();
const all = [], review = [];
for (const mode of MODES) {
  const ctx = await newContext(browser, mode);
  const page = await ctx.newPage();
  for (const url of PAGES) {
    await page.goto(url); await settle(page); await page.waitForTimeout(400);
    await page.evaluate(source); // evaluate, not a <script> tag: no CSP change needed
    const res = await page.evaluate(tags => window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations", "incomplete"] }), axeTags);
    for (const v of res.incomplete.filter(i => i.id === "color-contrast"))
      review.push({ mode: mode.name, url: url.replace(/^http:\/\//, ""), count: v.nodes.length, nodes: v.nodes.slice(0, 3).map(n => `${n.target.join(" ")} :: ${(n.any?.[0]?.message ?? "").slice(0, 120)}`) });
    for (const v of res.violations)
      all.push({ mode: mode.name, url: url.replace(/^http:\/\//, ""), id: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
        nodes: v.nodes.slice(0, 4).map(n => ({ target: n.target.join(" "), html: n.html.slice(0, 160), summary: (n.failureSummary ?? "").split("\n").slice(1, 2).join(" ").slice(0, 200) })) });
  }
  await ctx.close();
}
await browser.close();
save("axe.json", { violations: all, contrastNeedsReview: review });
const byRule = {};
for (const v of all) { const k = `${v.impact} ${v.id}`; (byRule[k] ??= { help: v.help, pages: new Set(), nodes: 0 }); byRule[k].pages.add(`${v.mode} ${v.url}`); byRule[k].nodes += v.count; }
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
for (const [k, x] of Object.entries(byRule).sort((a, b) => order[a[0].split(" ")[0]] - order[b[0].split(" ")[0]]))
  console.log(`${k}: ${x.help} | ${x.nodes} nodes on ${x.pages.size} page-modes`);
console.log(`color-contrast needs manual review: ${review.reduce((n, x) => n + x.count, 0)} nodes on ${review.length} page-modes`);
console.log(`${all.length} violation groups over ${PAGES.length} pages x ${MODES.length} modes`);
