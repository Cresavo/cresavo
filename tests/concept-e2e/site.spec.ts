import { expect, test } from "@playwright/test";
import { site } from "../../src/concept/site/en";
import { sv } from "../../src/concept/site/sv";

test("while the waiting list takes no sign-ups, the page ends with the demo instead of a form", async ({ page }) => {
  await page.goto("/");
  const closing = page.locator("#waitlist");
  await expect(closing.locator("form")).toHaveCount(0);
  await expect(closing.getByRole("heading", { level: 2 })).toHaveText(site["closing.heading"]);
  await expect(closing).toContainText(site["closing.text"]);
  await expect(closing.getByRole("link", { name: site["soon.demo"] })).toHaveAttribute("href", "/studio");
  await expect(closing.getByRole("link", { name: site["how.client"] })).toHaveAttribute("href", "/boka/salong-eko");
});

test("the product homepage links directly to the studio", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("link", { name: site["soon.demo"], exact: true });
  await expect(links).toHaveCount(4);
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

test("the homepage says who it is for, where it stands and shows the studio in each language", async ({ page }) => {
  for (const [path, copy, lang] of [["/", site, "en"], ["/sv", sv, "sv"]] as const) {
    await page.goto(path);
    await expect(page.getByText(copy["hero.eyebrow"], { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy["hero.heading"]);
    await expect(page.getByText(copy["hero.note"])).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: copy["how.heading"] })).toBeVisible();
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

test("on a phone, the demo button docks once the hero scrolls away and steps aside for the waiting list", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const dock = page.locator("[data-show]");
  await expect(dock).toHaveCount(0);
  await page.locator("#why").scrollIntoViewIfNeeded();
  await expect(dock).toHaveCount(1);
  await expect(dock.getByRole("link", { name: site["soon.demo"] })).toBeVisible();
  await page.locator("#waitlist").scrollIntoViewIfNeeded();
  await expect(dock).toHaveCount(0);
});

test("the sample booking can be completed and reset offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: site["tour.client"] }).click();
  const sample = page.getByRole("region", { name: site["mini.label"] });
  await context.setOffline(true);
  await sample.getByRole("button", { name: /Basic foot care/ }).click();
  await sample.getByRole("button", { name: "13:00" }).click();
  await expect(sample.getByRole("heading")).toHaveText(site["mini.booked"]);
  await expect(sample.getByRole("heading")).toBeFocused();
  await expect(sample.getByText("13:00 · Basic foot care")).toBeVisible();
  await sample.getByRole("button", { name: site["mini.reset"] }).click();
  await expect(sample.getByRole("button", { name: /Spa foot care/ })).toBeVisible();
});

test("tour clips respect visibility, a manual pause and a live motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("combobox", { name: site["tour.choose"] }).selectOption({ label: site["tour.day"] });
  const video = page.locator("#tour video");
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute("poster", "/site/day-dark.webp");
  await expect(page.locator("video[src]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused && el.currentTime > 0)).toBe(true);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await video.scrollIntoViewIfNeeded();
  const section = page.locator("#tour");
  await section.getByRole("button", { name: /Pause recording/ }).click();
  await page.locator("footer").scrollIntoViewIfNeeded();
  await video.scrollIntoViewIfNeeded();
  await expect(section.getByRole("button", { name: /Play recording/ })).toBeVisible();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await section.getByRole("button", { name: /Play recording/ }).click();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await expect(video).toHaveAttribute("poster", "/site/day-light.webp");
  await expect(video).not.toHaveAttribute("src");
  await section.getByRole("button", { name: /Play recording/ }).click();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused)).toBe(true);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(video).not.toHaveAttribute("src");
  await video.scrollIntoViewIfNeeded();
  await expect(section.getByRole("button", { name: /Play recording/ })).toBeVisible();
  await expect(video).not.toHaveAttribute("src");
});

test("the apex tour keeps the poster until requested under reduced motion and exposes its music control", async ({ page }) => {
  const videoRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp4")) videoRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/coming-soon");
  const film = page.getByLabel(site["soon.tour.description"]);
  await film.scrollIntoViewIfNeeded();
  await expect(film).toHaveAttribute("preload", "none");
  await expect(film).not.toHaveAttribute("src");
  expect(videoRequests).toHaveLength(0);

  await page.getByRole("button", { name: /Play recording/ }).click();
  await expect.poll(() => film.evaluate((v: HTMLVideoElement) => !v.paused && v.muted)).toBe(true);
  await page.getByRole("button", { name: site["soon.tour.unmute"] }).click();
  await expect.poll(() => film.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  await page.getByRole("button", { name: /Pause recording/ }).click();
  await expect(film).not.toHaveAttribute("src");
});

test("Expand opens and closes the tour dialog", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const expand = page.getByRole("button", { name: site["clip.expand"], exact: true }).first();
  await expand.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: site["clip.close"] });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  const large = dialog.locator("video");
  await expect.poll(() => large.evaluate((v: HTMLVideoElement) => v.paused && !v.muted && v.controls)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(expand).toBeFocused();

  await page.getByRole("button", { name: /^Expand —/ }).first().click();
  await close.click();
  await expect(dialog).toHaveCount(0);
  const inline = page.locator("video").first();
  await expect.poll(() => inline.evaluate((v: HTMLVideoElement) => v.paused && v.muted)).toBe(true);
});

test("the expanded film keeps the playhead and returns muted on a backdrop click", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/coming-soon");
  const inline = page.locator("figure video");
  await inline.scrollIntoViewIfNeeded();
  await expect.poll(() => inline.evaluate((v: HTMLVideoElement) => v.readyState >= 2 && !v.paused)).toBe(true);
  await inline.evaluate((v: HTMLVideoElement) => { v.currentTime = 9; });
  await inline.click();
  const dialog = page.getByRole("dialog");
  const large = dialog.locator("video");
  await expect.poll(() => large.evaluate((v: HTMLVideoElement) => !v.paused && !v.muted && v.currentTime >= 9)).toBe(true);
  await expect.poll(() => inline.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  await large.evaluate((v: HTMLVideoElement) => { v.currentTime = 18; });
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => inline.evaluate((v: HTMLVideoElement) => v.muted && !v.paused && v.currentTime >= 18)).toBe(true);
  await expect(page.getByRole("button", { name: /^Expand —/ })).toBeFocused();
});

test("the film section separates the salon's view from the client's and the FAQ opens from the keyboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const tour = page.locator("#tour");
  const client = tour.getByRole("button", { name: site["tour.client"] });
  await client.focus();
  await page.keyboard.press("Space");
  await expect(client).toHaveAttribute("aria-pressed", "true");
  await expect(tour.getByRole("link", { name: site["landing.book.link"] })).toHaveAttribute("href", "/boka/salong-eko");
  const question = page.locator("#questions summary", { hasText: site["faq.import"] });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(site["faq.import.answer"])).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});
