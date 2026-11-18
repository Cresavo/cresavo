// Shared helpers for the Cresavo concept-demo QA scripts.
// Run against a production build. Each script runs in Node without a test runner.
import { chromium } from "@playwright/test";
import http from "node:http";
import https from "node:https";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const BASE_URL = new URL(process.env.QA_BASE_URL ?? `http://localhost:${process.env.QA_PORT ?? 3100}`);
export const PRODUCT = process.env.QA_PRODUCT_DOMAIN ?? "cresavo.com";
export const hostOrigin = (host) => `${BASE_URL.protocol}//${host}`;
export const DEMO = hostOrigin(`demo.${PRODUCT}`);
export const APEX = hostOrigin(PRODUCT);
export const TENANT = hostOrigin(`salong-eko.${PRODUCT}`);
export const UNKNOWN = hostOrigin("some-unknown-salon.example");
export const OWN_DOMAIN = hostOrigin("boka.salong-eko.example");
export const OUT = process.env.QA_OUT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), "out");
mkdirSync(path.join(OUT, "shots"), { recursive: true });

// Map the QA hostnames to the running server while preserving Host and browser storage origins.
const target = `${BASE_URL.hostname}:${BASE_URL.port || (BASE_URL.protocol === "https:" ? "443" : "80")}`;
const mapped = [PRODUCT, `*.${PRODUCT}`, new URL(UNKNOWN).hostname, new URL(OWN_DOMAIN).hostname];
const resolver = mapped.map((host) => `MAP ${host} ${target}`).join(", ");

export function getHost(host, route = "/") {
  const client = BASE_URL.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    client.get(new URL(route, BASE_URL), { headers: { host } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body, title: body.match(/<title[^>]*>([^<]*)/)?.[1] ?? "" }));
      response.on("error", reject);
    }).on("error", reject);
  });
}

function fallbackChromium() {
  const root = "/opt/pw-browsers";
  try {
    const versions = readdirSync(root).filter((dir) => /^chromium-\d+$/.test(dir));
    versions.sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
    return versions.map((dir) => path.join(root, dir, "chrome-linux64", "chrome")).find(existsSync);
  } catch {
    return undefined;
  }
}

export async function launch() {
  // Use full Chromium so mapped http origins behave as secure contexts.
  const executablePath = process.env.QA_CHROMIUM ||
    (existsSync(chromium.executablePath()) ? undefined : fallbackChromium());
  const secure = [APEX, DEMO, TENANT, UNKNOWN, OWN_DOMAIN, hostOrigin(`annas-fotvard.${PRODUCT}`)].join(",");
  return chromium.launch({ channel: "chromium", executablePath, args: [`--host-resolver-rules=${resolver}`, `--unsafely-treat-insecure-origin-as-secure=${secure}`] });
}

export const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };

export async function newContext(browser, { viewport = "desktop", dark = false, role, storage } = {}) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport] ?? viewport, deviceScaleFactor: 1, locale: "en-GB", timezoneId: "Europe/Stockholm",
    colorScheme: dark ? "dark" : "light", ...(storage ? { storageState: storage } : {}),
  });
  if (role) await context.addInitScript(r => { try { localStorage.setItem("salong-eko-role", r); } catch {} }, role);
  return context;
}

/** Attach collectors: console errors/warnings, page errors, failed requests, HTTP >= 400, hydration warnings. */
export function watch(page, bucket = []) {
  const at = () => { try { return page.url(); } catch { return "?"; } };
  page.on("console", msg => {
    const text = msg.text();
    if (msg.type() === "error" || /hydrat/i.test(text)) bucket.push({ kind: /hydrat/i.test(text) ? "hydration" : "console-error", url: at(), text: text.slice(0, 400) });
  });
  page.on("pageerror", e => bucket.push({ kind: "pageerror", url: at(), text: String(e.message).slice(0, 400) }));
  page.on("requestfailed", r => {
    const f = r.failure()?.errorText ?? "";
    if (/ERR_ABORTED/.test(f) && /_rsc=|\/_next\//.test(r.url())) return; // cancelled prefetches on navigation
    bucket.push({ kind: "requestfailed", url: at(), text: `${r.method()} ${r.url()} ${f}` });
  });
  page.on("response", r => { if (r.status() >= 400) bucket.push({ kind: "http", url: at(), text: `${r.status()} ${r.request().method()} ${r.url()}` }); });
  return bucket;
}

export async function shot(page, name, opts = {}) {
  const file = path.join(OUT, "shots", `${name}.png`);
  await page.screenshot({ path: file, animations: "disabled", ...opts });
  return path.basename(file);
}

export function save(name, data) {
  writeFileSync(path.join(OUT, name), typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

/** The demo keeps its whole state in this localStorage key. */
export const STATE_KEY = "salong-eko-demo";
export const state = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) ?? "null"), STATE_KEY);

export async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
}

export function axeSource() {
  const candidates = [process.env.QA_AXE, "axe-core/axe.min.js"].filter(Boolean);
  const require = createRequire(import.meta.url);
  for (const c of candidates) { try { return readFileSync(existsSync(c) ? c : require.resolve(c), "utf8"); } catch {} }
  throw new Error("axe-core not found: npm i -D axe-core, or set QA_AXE=/path/axe.min.js");
}

/** A tiny result recorder: check(name, ok, detail). */
export function recorder(area) {
  const results = [];
  return {
    results,
    async check(name, fn) {
      try { const detail = await fn(); results.push({ area, name, ok: true, detail: detail ?? "" }); console.log(`PASS ${area} :: ${name}`); }
      catch (e) { results.push({ area, name, ok: false, detail: String(e.message ?? e).split("\n").slice(0, 4).join(" | ") }); console.log(`FAIL ${area} :: ${name} -> ${String(e.message ?? e).split("\n")[0]}`); }
    },
  };
}
