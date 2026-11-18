// Host routing: apex -> coming soon, demo -> studio, unknown host -> friendly not-found, tenant isolation.
import { APEX, DEMO, OWN_DOMAIN, TENANT, UNKNOWN as UNKNOWN_ORIGIN, getHost as get, hostOrigin, launch, newContext, recorder, save, shot, PRODUCT, settle } from "./lib.mjs";

const expectEq = (a, b, what) => { if (a !== b) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); return `${what}=${JSON.stringify(a)}`; };
const expectMatch = (a, re, what) => { if (!re.test(a)) throw new Error(`${what}: ${JSON.stringify(a.slice(0, 120))} !~ ${re}`); return `${what}=${JSON.stringify(a.slice(0, 80))}`; };

const r = recorder("hosts");
const P = PRODUCT;
const COMING = /More time\. On your terms\./, UNKNOWN = /No booking page here/, BOOK = /Book online/;

await r.check(`${P}/ serves the coming-soon page`, async () => { const x = await get(P); return [expectEq(x.status, 200, "status"), expectMatch(x.title, COMING, "title")].join(" "); });
await r.check(`www.${P}/ serves the coming-soon page`, async () => expectMatch((await get(`www.${P}`)).title, COMING, "title"));
await r.check(`${P}/ is indexable (no X-Robots-Tag noindex)`, async () => { const x = await get(P); if (x.headers["x-robots-tag"]) throw new Error(`X-Robots-Tag: ${x.headers["x-robots-tag"]}`); });
for (const path of ["/", "/coming-soon"]) await r.check(`demo.${P}${path} redirects to the studio`, async () => {
  const response = await get(`demo.${P}`, path);
  expectEq(response.status, 307, "status");
  return expectEq(new URL(response.headers.location, DEMO).pathname, "/studio", "location");
});
await r.check(`demo.${P}/ is noindex`, async () => expectEq((await get(`demo.${P}`)).headers["x-robots-tag"], "noindex, nofollow", "x-robots-tag"));
for (const host of ["some-unknown-salon.example", `admin.${P}`, `x--y.${P}`, `-bad.${P}`])
  await r.check(`${host}/ shows the friendly not-found page`, async () => { const x = await get(host); return expectMatch(x.title, UNKNOWN, "title") + ` status=${x.status}`; });
await r.check(`unknown host answers with 404 status (soft-404 check)`, async () => expectEq((await get("some-unknown-salon.example")).status, 404, "status"));
await r.check(`unknown host on a deep path shows not-found`, async () => expectMatch((await get("some-unknown-salon.example", "/studio")).title, UNKNOWN, "title"));
await r.check(`salong-eko.${P}/ serves the salon booking page`, async () => expectMatch((await get(`salong-eko.${P}`)).title, BOOK, "title"));
for (const path of ["/me", "/gift", "/widget"]) await r.check(`salong-eko.${P}${path} is served`, async () => expectEq((await get(`salong-eko.${P}`, path)).status, 200, "status"));
for (const path of ["/studio", "/studio/customers", "/coming-soon", "/boka/other-salon", "/api/concept/proposals", "/admin"])
  await r.check(`tenant isolation: salong-eko.${P}${path} does not leak`, async () => { const x = await get(`salong-eko.${P}`, path); if (x.status === 200 && !UNKNOWN.test(x.title)) throw new Error(`status ${x.status}, title ${x.title}`); return `status=${x.status} title=${x.title}`; });
await r.check(`demo.${P}/no-such-page returns 404`, async () => expectEq((await get(`demo.${P}`, "/no-such-page")).status, 404, "status"));

// Visual: what a visitor sees on each host.
const browser = await launch();
const ctx = await newContext(browser, { viewport: "mobile" });
const page = await ctx.newPage();
const h1 = async url => { await page.goto(url); await settle(page); await page.waitForTimeout(500); return (await page.locator("h1").first().innerText().catch(() => "(no h1)")).trim(); };
await r.check(`salong-eko.${P}/ shows Salong Eko`, async () => expectMatch(await h1(TENANT + "/"), /Salong Eko/, "h1"));
await r.check(`own domain boka.salong-eko.example shows Salong Eko`, async () => expectMatch(await h1(OWN_DOMAIN + "/"), /Salong Eko/, "h1"));
await r.check(`a second tenant subdomain (annas-fotvard.${P}) does not show Salong Eko`, async () => { const t = await h1(hostOrigin(`annas-fotvard.${P}`) + "/"); if (/Salong Eko/.test(await page.locator("body").innerText())) throw new Error(`h1 "${t}", page shows Salong Eko`); return `h1=${t}`; });
await r.check(`demo.${P}/boka/does-not-exist does not show Salong Eko`, async () => { const t = await h1(DEMO + "/boka/does-not-exist"); if (/Salong Eko/.test(await page.locator("body").innerText())) throw new Error(`h1 "${t}", page shows Salong Eko`); return `h1=${t}`; });
for (const [name, url] of [["host-apex", APEX + "/"], ["host-demo", DEMO + "/"], ["host-tenant", TENANT + "/"], ["host-unknown", UNKNOWN_ORIGIN + "/"], ["host-second-tenant", hostOrigin(`annas-fotvard.${P}`) + "/"]]) {
  await page.goto(url); await settle(page); await shot(page, `${name}-390`);
}
await browser.close();
save("hosts.json", r.results);
