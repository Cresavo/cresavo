import { expect, test } from "@playwright/test";
import { channelExamples, site } from "../../src/concept/site/en";

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

test("the sample booking can be completed and reset offline", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: site["mini.pickTreatment"] }).click();
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

test("each channel can be reviewed and booked by the owner", async ({ page }) => {
  await page.goto("/");
  const map = page.locator("#channel-map");
  await map.getByRole("switch").click();
  await expect(map.getByRole("switch")).toBeChecked();
  for (const example of channelExamples) {
    await map.getByRole("button", { name: new RegExp("^" + example.name) }).click();
    await expect(map.getByText(site["map.draft"])).toBeVisible();
    await expect(map.getByText(example.reply)).toBeVisible();
    await expect(map.getByText(site["map.confirmed"])).toBeHidden();
    await map.getByRole("button", { name: site["map.book"], exact: true }).click();
    await expect(map.locator("time")).toHaveText(example.time);
    await expect(map.getByText(site["map.confirmed"])).toBeVisible();
  }
});

test("the story loops, holds on hover and focus, and settles under reduced motion", async ({ page }) => {
  await page.goto("/");
  const map = page.locator("#channel-map");
  await map.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  const selected = map.locator('[aria-pressed="true"]');
  await expect(selected).toHaveText("Instagram", { timeout: 12000 });
  const clock = map.locator("span[aria-hidden]").last();
  await selected.hover();
  await expect(clock).toHaveCSS("animation-play-state", "paused");
  await selected.focus();
  await page.mouse.move(1, 1);
  await expect(clock).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(map.getByRole("listitem")).toHaveCount(3);
  await expect(map.getByRole("list")).toBeVisible();
  await expect(map.getByText(site["map.confirmed"])).toBeVisible();
  await expect(clock).toHaveCSS("animation-name", "none");
});

test("salon photographs and product views are keyboard operable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const next = page.getByRole("button", { name: site["hero.next"] });
  const hero = page.locator("section[aria-labelledby=promise]");
  const first = await hero.getByRole("img").getAttribute("alt");
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(hero.getByRole("img")).not.toHaveAttribute("alt", first!);
  await page.getByRole("button", { name: site["hero.previous"] }).click();
  await expect(hero.getByRole("img")).toHaveAttribute("alt", first!);

  const preview = page.getByRole("region", { name: site["studio.heading"] });
  for (const view of ["calendar", "booking", "assistant", "today"] as const) {
    const button = preview.getByRole("button", { name: site[`studio.${view}`], exact: true });
    await button.focus();
    await page.keyboard.press("Space");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(preview.getByRole("img", { name: site[`studio.${view}.alt`] })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => innerWidth));
});
