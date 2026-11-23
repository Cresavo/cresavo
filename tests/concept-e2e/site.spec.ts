import { expect, test } from "@playwright/test";
import { site } from "../../src/concept/site/en";
import { sv } from "../../src/concept/site/sv";

test("while the waiting list takes no sign-ups, the page ends with the demo and a line to the founder", async ({ page }) => {
  await page.goto("/");
  const closing = page.locator("#closing");
  await expect(page.locator("form")).toHaveCount(0);
  await expect(closing.getByRole("heading", { level: 2 })).toHaveText(site["closing.heading"]);
  await expect(closing).toContainText(site["closing.text"]);
  await expect(closing.getByRole("link", { name: site["home.demo"] })).toHaveAttribute("href", "/studio?lang=en");
  await expect(closing.getByRole("link", { name: site["closing.mail"] })).toHaveAttribute("href", /^mailto:info@cresavo\.com\?subject=/);
  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("link", { name: site["home.footer.booking"] })).toHaveAttribute("href", "/boka/salong-eko?lang=en");
  await expect(footer.getByRole("link", { name: site["home.footer.story"] })).toHaveAttribute("href", "/about");
  await expect(footer.getByRole("link", { name: site["waitlist.privacy"] })).toHaveAttribute("href", "/privacy");
});

test("the product homepage opens the studio in English, even after an earlier Swedish visit", async ({ page, context }) => {
  await context.addCookies([{ name: "booking-locale", value: "sv", url: "http://127.0.0.1:3017" }]);
  await page.goto("/");
  const studio = page.locator('a[href*="/studio"]');
  expect(await studio.count()).toBeGreaterThanOrEqual(4);
  for (const link of await studio.all()) await expect(link).toHaveAttribute("href", "/studio?lang=en");
  await page.getByRole("link", { name: site["home.hero.demo"] }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("the demo host opens the studio and the retired landing is gone", async ({ request }) => {
  const root = await request.get("/?visit=demo", { headers: { Host: "demo.localhost" }, maxRedirects: 0 });
  expect(root.status()).toBe(307);
  expect(root.headers().location).toMatch(/\/studio\?visit=demo$/);
  for (const path of ["/landing", "/en/landing"]) expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(404);
});

test("the homepage says who it is for and shows the product in each language", async ({ page }) => {
  for (const [path, copy] of [["/", site], ["/sv", sv]] as const) {
    await page.goto(path);
    await expect(page.getByText(copy["home.hero.kicker"], { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy["home.hero.heading"]);
    await expect(page.getByRole("heading", { level: 2, name: copy["home.product.heading"] })).toBeVisible();
    for (const label of ["home.book.label", "home.today.label", "home.card.label", "home.call.label", "home.next.label"] as const) {
      const panel = page.getByRole("figure", { name: copy[label] });
      await panel.scrollIntoViewIfNeeded();
      await expect(panel).toBeVisible();
    }
    await expect(page.getByRole("heading", { level: 2, name: copy["closing.heading"] })).toBeVisible();
  }
});

test("the about page tells the founder's story in both languages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: site["founder.story"] }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(site["about.heading"]);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);
  await page.getByRole("banner").getByRole("link", { name: site["language.switch"] }).click();
  await expect(page).toHaveURL(/\/sv\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(sv["about.heading"]);
  await page.getByRole("link", { name: sv["about.back"] }).click();
  await expect(page).toHaveURL(/\/sv$/);
});

test("on a phone the page never scrolls sideways and the section menu opens and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const menu = page.getByRole("button", { name: site["home.menu"] });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  const sheet = page.getByRole("navigation", { name: site["home.nav.sections"] });
  await expect(sheet.getByRole("link", { name: site["home.nav.product"] })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(menu).toBeFocused();
  await menu.click();
  await sheet.getByRole("link", { name: site["nav.pricing"] }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/#pricing$/);
});

test("the theme follows the system until the toggle pins it, and the choice survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const root = page.locator("#main").locator("..");
  const toggle = page.getByRole("button", { name: site["home.theme"] });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(root).not.toHaveAttribute("data-theme");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  expect(await root.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(250, 247, 243)");
});

test("the dot wordmark takes the colours of a saved theme that differs from the system's", async ({ page }) => {
  // Average colour of the drawn dots: plum on the light page, near-white on the dark one.
  const ink = () => page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) { sum += (data[i] + data[i + 1] + data[i + 2]) / 3; count++; }
    return count ? sum / count : 128;
  });
  // Both with and without reduced motion: its near-zero transitions used to hand the dots the old colours.
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    for (const [system, saved] of [["dark", "light"], ["light", "dark"]] as const) {
      await page.emulateMedia({ colorScheme: system, reducedMotion });
      await page.goto("/");
      await page.evaluate((value) => localStorage.setItem("cresavo-site-theme", value), saved);
      await page.reload();
      await expect(page.locator("[data-ready]")).toHaveCount(1);
      if (saved === "light") await expect.poll(ink, `${reducedMotion} ${saved}`).toBeLessThan(110);
      else await expect.poll(ink, `${reducedMotion} ${saved}`).toBeGreaterThan(200);
    }
  }
});

test("the dot fields size from their host and never grow", async ({ page }) => {
  await page.goto("/");
  const stage = page.locator("[data-ready]").first();
  await expect(stage).toBeVisible();
  const size = () => stage.evaluate((host) => {
    const canvas = host.querySelector("canvas")!;
    return { host: host.getBoundingClientRect().width, canvas: canvas.getBoundingClientRect().width };
  });
  const first = await size();
  expect(first.canvas - first.host).toBeGreaterThan(0);
  expect(first.canvas - first.host).toBeLessThanOrEqual(80);
  await page.waitForTimeout(1500);
  expect(await size()).toEqual(first);
  // The hero wordmark is the page's one moving moment; nothing else draws in dots.
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("the client card's tabs follow the arrow keys and the questions open from the keyboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.getByRole("figure", { name: site["home.card.label"] });
  await card.scrollIntoViewIfNeeded();
  const overview = card.getByRole("tab", { name: site["home.card.overview"] });
  await overview.click();
  await page.keyboard.press("ArrowRight");
  const history = card.getByRole("tab", { name: site["home.card.history"] });
  await expect(history).toBeFocused();
  await expect(history).toHaveAttribute("aria-selected", "true");
  await expect(card.getByRole("tabpanel")).toContainText(site["home.card.earlier"]);
  const question = page.locator("#questions summary", { hasText: site["faq.import"] });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(site["faq.import.answer"])).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});
