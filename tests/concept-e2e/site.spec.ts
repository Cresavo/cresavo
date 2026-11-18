import { expect, test } from "@playwright/test";
import { site } from "../../src/concept/site/en";

// The demo landing's waiting list and its old English address. Invented address only; the default provider stores nothing.

test("the waiting list answer is announced and takes focus when it replaces the form", async ({ page }) => {
  await page.goto("/landing");
  const status = page.locator("#waitlist [role=status]");
  await expect(status).toHaveCount(1);
  await expect(status).toBeAttached();
  await page.getByLabel(site["waitlist.email"]).fill("nova.demo@example.com");
  await page.getByRole("button", { name: site["waitlist.submit"] }).click();
  await expect(status).toHaveText(site["waitlist.outcome.not-open"]);
  await expect(page.locator("#waitlist form")).toHaveCount(0);
  await expect(status).toBeFocused();
});

test("/en/landing moves permanently to /landing", async ({ request }) => {
  const response = await request.get("/en/landing", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/\/landing$/);
});

test("the sample booking can be completed and reset offline", async ({ page, context }) => {
  await page.goto("/landing");
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
  await page.goto("/landing");
  const video = page.locator("video").nth(1);
  await video.scrollIntoViewIfNeeded();
  await expect(video).toHaveAttribute("poster", "/site/day-dark.webp");
  await expect(page.locator("video[src]")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused && el.currentTime > 0)).toBe(true);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);
  await video.scrollIntoViewIfNeeded();
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: site["landing.day.heading"] }) });
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
