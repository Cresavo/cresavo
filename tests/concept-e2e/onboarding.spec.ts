import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { translate, type MessageKey } from "../../src/concept/i18n";
import { createSalon, salonDraft } from "../../src/concept/onboarding/salon";
import { salonClock } from "../../src/concept/tools/clock";

const axe = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const screens = "docs/design/cresavo/screens/onboarding";
const frames = ["01-name", "02-language", "03-hours", "04-treatments", "05-staff", "06-address", "07-live"] as const;

async function capture(page: Page, frame: string) {
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
  const jpg = await page.screenshot({ path: `${screens}-${frame}.jpg`, quality: 75, animations: "disabled" });
  expect(jpg.length).toBeLessThan(200_000);
}

async function audit(page: Page) {
  await page.addScriptTag({ path: axe });
  const issues = await page.evaluate(async () => {
    const { violations } = await (window as typeof window & { axe: typeof import("axe-core") }).axe.run();
    return violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) }));
  });
  expect(issues).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const language of ["sv", "en"] as const) {
  test.describe(language, () => {
    test.use({ locale: language === "sv" ? "sv-SE" : "en-GB", colorScheme: language === "sv" ? "light" : "dark",
      permissions: ["clipboard-read", "clipboard-write"] });

    test("sets up a salon, shares its link and books a first visit", async ({ page }) => {
      test.setTimeout(180_000);
      const m = (key: MessageKey) => translate(language, key);
      const pictures = language === "sv" && process.env.CONCEPT_SCREENSHOTS === "1" && page.viewportSize()?.width === 390;
      const frame = async (i: number) => { await audit(page); if (pictures) await capture(page, frames[i]); };
      const next = () => page.getByRole("button", { name: m("welcome.next"), exact: true }).click();
      await page.goto("/studio");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await page.getByRole("link", { name: translate("en", "setup.entry") }).click();
      if (language === "sv") {
        await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("sv");
        await expect(page.locator("html")).toHaveAttribute("lang", "sv");
      }
      await page.getByLabel(m("settings.name"), { exact: true }).fill("Studio Vide");
      await page.getByLabel(m("setup.type")).selectOption("beauty");
      await frame(0);
      await next();
      const bookingLanguage = page.getByLabel(m("language.businessDefault"));
      await expect(bookingLanguage).toHaveValue("en");
      if (language === "sv") await bookingLanguage.selectOption({ label: "Svenska" });
      await expect(bookingLanguage).toHaveValue(language);
      await expect(page.getByLabel(m("setup.currency"))).toHaveValue("SEK");
      if (language === "en") await page.getByLabel(m("setup.currency")).selectOption("EUR");
      await frame(1);
      await next();
      await page.getByRole("button", { name: m("setup.saturday") }).click();
      await page.getByText(m("setup.editDays")).click();
      await page.getByRole("switch").first().click();
      await page.getByText(m("setup.editDays")).click();
      await frame(2);
      await next();
      await expect(page.getByRole("textbox").first()).toHaveValue(m("setup.beauty1"));
      await page.getByRole("spinbutton").first().fill("650");
      await page.getByRole("button", { name: m("services.add") }).click();
      await page.getByRole("textbox").last().fill("Extra Demo");
      await page.getByRole("button", { name: translate(language, "setup.remove", { name: "Extra Demo" }) }).click();
      await expect(page.getByRole("textbox")).toHaveCount(2);
      await frame(3);
      await next();
      await page.getByLabel(m("setup.ownerName")).fill("Lo Demo");
      await page.getByRole("radio", { name: m("setup.team") }).click();
      await page.getByRole("textbox").nth(1).fill("Kim Demo");
      await frame(4);
      await next();
      const slug = page.getByRole("textbox");
      await expect(slug).toHaveValue("studio-vide");
      await slug.fill("vide-studio");
      const otherLanguage = language === "en" ? "sv" : "en";
      await page.getByRole("combobox", { name: m("language.label"), exact: true }).selectOption(otherLanguage);
      await expect(page.getByRole("heading", { name: translate(otherLanguage, "setup.address") })).toBeVisible();
      await expect(slug).toHaveValue("vide-studio");
      await page.getByRole("combobox", { name: translate(otherLanguage, "language.label"), exact: true }).selectOption(language);
      await expect(page.getByRole("heading", { name: m("setup.address") })).toBeVisible();
      await expect(slug).toHaveValue("vide-studio");
      await slug.fill("admin");
      await expect(page.getByRole("button", { name: m("setup.publish") })).toBeDisabled();
      await slug.fill("studio-vide");
      await frame(5);
      await page.getByRole("button", { name: m("setup.publish") }).click();
      await expect(page.getByRole("heading", { name: m("setup.live") })).toBeVisible();
      await frame(6);
      await page.getByRole("button", { name: m("share.copyLink") }).click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(new URL("/boka/studio-vide", page.url()).href);
      await page.getByRole("link", { name: m("setup.today") }).click();
      await expect(page.getByText(translate(language, "setup.progress", { done: 3, total: 4 }))).toBeVisible();
      await audit(page);
      if (pictures) {
        await capture(page, "checklist");
        const gif = `${screens}-wizard.gif`;
        execFileSync("convert", ["-delay", "120", ...frames.map(f => `${screens}-${f}.jpg`), "-loop", "0", "-layers", "Optimize", gif]);
        expect((await stat(gif)).size).toBeLessThan(3_000_000);
      }
      await page.goto("/studio/setup");
      await page.getByRole("link", { name: m("setup.try") }).click();
      await page.getByLabel(m("booking.yourName"), { exact: true }).fill("Nova Demo");
      await page.getByLabel(m("booking.yourPhone")).fill("0700009911");
      await page.getByRole("button", { name: m("booking.confirm"), exact: true }).click();
      await expect(page).toHaveURL(/\/boka\/studio-vide\/booking\//);
      await page.goto("/studio");
      await expect(page.getByText(translate(language, "setup.progress", { done: 4, total: 4 }))).toBeVisible();
      await page.getByRole("button", { name: m("setup.hide") }).click();
      await page.getByRole("button", { name: m("setup.demo") }).click();
      await expect(page.getByRole("button", { name: m("setup.resume") })).toBeVisible();
      await page.goto("/studio/setup");
      await expect(page.getByLabel(m("settings.name"), { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: m("setup.resume") }).click();
      await expect(page.getByRole("button", { name: m("setup.demo") })).toBeVisible();
      await expect(page.getByRole("heading", { name: m("setup.checklist") })).toHaveCount(0);
    });
  });
}

test("all seven fresh studio views offer an action", async ({ page }) => {
  test.setTimeout(150_000);
  const state = createSalon(salonClock().today, { ...salonDraft("en"), treatments: [] });
  await page.addInitScript(salon => {
    if (!localStorage.getItem("salong-eko-demo")) localStorage.setItem("salong-eko-demo", JSON.stringify(salon));
  }, state);
  for (const [path, key] of [
    ["", "today"], ["/calendar", "calendar"], ["/customers", "customers"], ["/inbox", "inbox"],
    ["/more/services", "treatments"], ["/more/campaigns", "campaigns"], ["/more/finance", "finance"],
  ] as const) {
    await page.goto("/studio" + path);
    const sentence = page.getByText(translate("en", `setup.empty.${key}`, {}, { customer: "client", service: "service" }), { exact: true });
    await expect(sentence).toBeVisible();
    await audit(page);
    const action = sentence.locator("..").locator("a,button");
    await expect(action).toHaveCount(1);
    await expect(action).toBeEnabled();
    await action.click();
    if (key === "finance") await expect(page.getByRole("spinbutton")).toBeVisible();
  }
});

test("every setup question can be skipped from Settings", async ({ page }) => {
  await page.goto("/studio/more/settings");
  await page.getByRole("link", { name: "Start with your own salon" }).click();
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Skip this step" }).click();
  await expect(page.getByRole("link", { name: "/boka/my-salon" })).toBeVisible();
});

test("tour follows its targets, restores focus and stays dismissed on reload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toBeFocused();
  await audit(page);
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: "Make room in your calendar" })).toBeFocused();
  await expect(page.locator('[data-tour-active][href="/studio/calendar"]:visible')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Explore the demo salon" })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore the demo salon" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Finish tour" }).click();
  await expect(dialog).toHaveCount(0);
});
