import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { createDemoState } from "../../src/concept/data/generate";
import { salonClock } from "../../src/concept/tools/clock";

// Brand v0.9: the studio's light / dark / system choice, applied before first
// paint; tenant booking pages keep their own colours whatever the studio
// says; and no accessibility violations on the main pages in either theme.

const today = salonClock().today;
const initial = createDemoState(today);
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
/** The computed background as "rgb(r, g, b)", whatever colour syntax the browser reports (color-mix gives color(srgb …)). */
const background = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.fillStyle = getComputedStyle(el).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  });

async function violations(page: Page) {
  await page.addScriptTag({ path: AXE });
  const result = await page.evaluate(() => (window as unknown as { axe: { run: () => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe.run());
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${today}T08:30:00Z`));
  await page.addInitScript((state) => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(state));
  }, initial);
});

test("the theme choice is saved, applied before first paint and offered in Settings", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/studio/more/settings");
  expect(await theme(page)).toBe("system");
  const light = await background(page, "body");
  await page.getByRole("radiogroup", { name: "Appearance" }).first().getByRole("radio", { name: "Dark" }).click();
  expect(await theme(page)).toBe("dark");
  expect(await background(page, "body")).not.toBe(light);

  // A fresh load is dark from the very first frame: the attribute is in place before any script of the app runs.
  await page.addInitScript(() => {
    document.addEventListener("readystatechange", () => document.readyState === "interactive" && ((window as unknown as { first: string }).first = document.documentElement.dataset.theme ?? ""), { once: true });
  });
  await page.goto("/studio");
  expect(await page.evaluate(() => (window as unknown as { first: string }).first)).toBe("dark");

  await page.goto("/studio/more/settings");
  await page.getByRole("radiogroup", { name: "Appearance" }).first().getByRole("radio", { name: "System" }).click();
  expect(await theme(page)).toBe("system");
  expect(await page.evaluate(() => localStorage.getItem("ui-theme"))).toBe("system");
});

test("a booking page keeps the business's colours whatever the studio theme is", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  const own = await background(page, ".booking-theme");
  expect(own).toBe("rgb(247, 244, 239)");
  await page.evaluate(() => localStorage.setItem("ui-theme", "dark"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  await expect.poll(() => background(page, ".booking-theme")).toBe(own);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page, ".booking-theme")).toBe(own);
});

test("without a palette the booking page is neutral and follows the visitor, not the studio", async ({ page }) => {
  await page.addInitScript(() => {
    const saved = JSON.parse(localStorage.getItem("salong-eko-demo")!);
    saved.page.theme.colors = null;
    localStorage.setItem("salong-eko-demo", JSON.stringify(saved));
    localStorage.setItem("ui-theme", "dark");
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("heading", { name: "Salong Eko", level: 1 })).toBeVisible();
  await expect.poll(() => background(page, ".booking-theme")).toBe("rgb(246, 246, 245)");
  await page.getByRole("textbox", { name: /What would you like to book/ }).fill("Foot care tomorrow");
  await expect.poll(() => background(page, "button[type=submit]:not(:disabled)")).toBe("rgb(29, 29, 31)");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page, ".booking-theme")).toBe("rgb(20, 20, 21)");
});

for (const scheme of ["light", "dark"] as const) {
  test(`no accessibility violations on the main pages in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript((value) => localStorage.setItem("ui-theme", value), scheme);
    const pages = ["/studio", "/studio/calendar", "/studio/customers", `/studio/customers/${initial.customers[0].id}`, "/studio/inbox", "/studio/more", "/studio/more/booking-page", "/studio/more/settings", "/boka/salong-eko", `/boka/salong-eko?service=${initial.services[0].id}`];
    for (const url of pages) {
      await page.goto(url);
      await expect(page.locator("main").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await violations(page), `${scheme} ${url}`).toEqual([]);
    }
  });
}
