// Start the existing socket wrapper first, without loading .env:
// PORT=3199 node scripts/server.mjs
// Then: node scripts/capture-landing.mjs
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const url = process.argv[2] ?? "http://127.0.0.1:3199/landing";
const output = resolve(process.argv[3] ?? "/workspace/booking-lab/landing-shots");
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname), "Use a local server");
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.locator("h1").waitFor();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    assert(await page.locator("img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), "Logo failed to load");
    assert(await page.evaluate(() => document.getAnimations().length === 0), "Reduced motion must be static");
    await page.screenshot({ path: resolve(output, `landing-${width}.png`), fullPage: true });
  }
  await page.getByRole("link", { name: "Följ bygget", exact: true }).click();
  assert.equal(new URL(page.url()).hash, "#folj-bygget");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByText("Pausa animation", { exact: true }).click();
  assert(await page.locator("#pause-motion").isChecked(), "Pause control");
  await page.evaluate(async () => {
    const animations = document.getAnimations();
    await Promise.all(animations.map(animation => animation.ready));
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = 7600;
    }
  });
  await page.getByRole("img", { name: /^Illustrerat framtida flöde:/ }).screenshot({ path: resolve(output, "landing-mid-animation.png") });
  assert.deepEqual(errors, [], "Browser errors");
  assert(!requests.some(request => /\/api\//.test(request)), "Unexpected API request");
  assert(requests.every(request => new URL(request).origin === new URL(url).origin), "Unexpected external request");
  console.log(`PASS: local /landing, logos, overflow, reduced motion, anchor, no API/external requests.\nSaved 3 screenshots in ${output}\nVisual review still required.`);
  await context.close();
} finally {
  await browser.close();
}
