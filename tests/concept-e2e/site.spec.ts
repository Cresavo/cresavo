import { expect, test } from "@playwright/test";
import { site } from "../../src/concept/site/en";
import { sv } from "../../src/concept/site/sv";

test("the waiting list answer is announced and takes focus when it replaces the form", async ({ page }) => {
  await page.goto("/");
  const status = page.locator("#waitlist [role=status]");
  await expect(status).toHaveCount(1);
  await expect(status).toBeAttached();
  await page.getByLabel(site["waitlist.email"]).fill("nova.demo@example.com");
  await page.getByRole("button", { name: site["waitlist.submit"] }).click();
  await expect(status).toHaveText(site["waitlist.outcome.not-open"]);
  await expect(page.locator("#waitlist form")).toHaveCount(0);
  await expect(status).toBeFocused();
});

test("the product homepage links directly to the studio", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("link", { name: site["soon.demo"], exact: true });
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) await expect(link).toHaveAttribute("href", "/studio");
  await links.first().click();
  await expect(page).toHaveURL(/\/studio$/);
});

test("the demo host opens the studio and the retired landing is gone", async ({ request }) => {
  const root = await request.get("/?visit=demo", { headers: { Host: "demo.localhost" }, maxRedirects: 0 });
  expect(root.status()).toBe(307);
  expect(root.headers().location).toMatch(/\/studio\?visit=demo$/);
  for (const path of ["/landing", "/en/landing"]) expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(404);
});

test("the homepage leads with the promise and shows the studio in each language", async ({ page }) => {
  for (const [path, copy, lang] of [["/", site, "en"], ["/sv", sv, "sv"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy["hero.heading"]);
    await expect(page.getByRole("heading", { level: 2, name: copy["why.heading"] })).toBeVisible();
    const shots = page.locator(`img[src^="/site/landing/${lang}-"]`);
    await expect(shots).toHaveCount(4);
    for (const shot of await shots.all()) {
      await shot.scrollIntoViewIfNeeded();
      await expect.poll(() => shot.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
  }
});

test("the about page tells the founder's story in both languages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: site["why.story"] }).click();
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

test("on a phone, the demo button docks once the hero scrolls away and steps aside for the waiting list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const dock = page.locator("[data-show]");
  await expect(dock).toHaveCount(0);
  await page.locator("#friday").scrollIntoViewIfNeeded();
  await expect(dock).toHaveCount(1);
  await expect(dock.getByRole("link", { name: site["soon.demo"] })).toBeVisible();
  await page.locator("#waitlist").scrollIntoViewIfNeeded();
  await expect(dock).toHaveCount(0);
});
