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

for (const path of ["/coming-soon", "/landing"]) {
  test(`Expand opens and closes the tour dialog on ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
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
}

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

for (const path of ["/coming-soon", "/landing"]) {
  test(`channel selections change the request, draft and calendar proposal on ${path}`, async ({ page }) => {
    await page.goto(path);
    const map = page.locator("#channel-map");
    const assistant = map.getByRole("switch", { name: "Assistant" });
    await expect(assistant).not.toBeChecked();
    await assistant.click();
    await expect(assistant).toBeChecked();
    const examples = [
      ["SMS", "Can I get foot care on Friday?", "I can offer you 14:30 with Anna.", "14:30"],
      ["Instagram", "Do you have a manicure after lunch?", "Yes, Erik has time at 13:15 on Tuesday.", "13:15"],
      ["Phone", "Is there an opening this afternoon?", "Anna can see you at 14:45 today.", "14:45"],
      ["Booking page", "Could I book a brow shape before work?", "We have 08:30 with Erik on Thursday.", "08:30"],
      ["AI agents", "Does Anna have a spa appointment for my client?", "Anna has an opening at 10:00 on Monday.", "10:00"],
    ];
    for (const [channel, request, draft, time] of examples) {
      const input = map.getByRole("button", { name: channel, exact: true });
      await input.click();
      await expect(input).toHaveAttribute("aria-pressed", "true");
      await expect(map.getByText(request, { exact: false })).toBeVisible();
      await expect(map.getByText(draft, { exact: false })).toBeVisible();
      await expect(map.locator("time")).toHaveText(time);
      await expect(map.getByText("Proposed time")).toBeVisible();
    }
    await expect(map.getByText(/Customer-agent booking · Coming soon/)).toBeVisible();
    await map.getByRole("button", { name: "Approve reply & booking" }).click();
    await expect(map.getByText("Booked in the preview")).toBeVisible();
    await map.getByRole("button", { name: "Undo booking" }).click();
    await expect(map.getByText("Proposed time")).toBeVisible();
  });
}

test("a written reply survives switching modes and belongs only to its channel", async ({ page }) => {
  await page.goto("/coming-soon");
  const map = page.locator("#channel-map");
  const send = map.getByRole("button", { name: "Send reply & book" });
  const field = map.getByRole("textbox", { name: "Your reply" });
  await field.fill("  ");
  await expect(send).toBeDisabled();
  await field.fill("Friday at 14:30 is yours.");
  const assistant = map.getByRole("switch", { name: "Assistant" });
  await assistant.click();
  await expect(field).toHaveCount(0);
  await assistant.click();
  await expect(field).toHaveValue("Friday at 14:30 is yours.");
  await send.click();
  await expect(map.getByText("Booked in the preview")).toBeVisible();
  await map.getByRole("button", { name: "Phone", exact: true }).click();
  await expect(send).toBeDisabled();
  await expect(map.getByText("Proposed time")).toBeVisible();
  await map.getByRole("button", { name: "SMS", exact: true }).click();
  await expect(map.getByText("Friday at 14:30 is yours.")).toBeVisible();
  await map.getByRole("button", { name: "Undo booking" }).click();
  await expect(field).toHaveValue("Friday at 14:30 is yours.");
});
