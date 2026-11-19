import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";
import { translate, type MessageKey } from "../../src/concept/i18n";
import { createSalon, salonDraft } from "../../src/concept/onboarding/salon";
import { salonClock } from "../../src/concept/tools/clock";

const axe = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const screens = "docs/design/cresavo/screens/onboarding";
const frames = ["01-name", "02-treatments", "03-ready"] as const;

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

    test("sets up a salon in three screens, opens its booking page and books a first visit", async ({ page }) => {
      test.setTimeout(180_000);
      const m = (key: MessageKey, vars?: Record<string, string | number>) => translate(language, key, vars);
      const pictures = language === "sv" && process.env.CONCEPT_SCREENSHOTS === "1" && page.viewportSize()?.width === 390;
      const frame = async (i: number) => { await audit(page); if (pictures) await capture(page, frames[i]); };
      await page.goto("/studio");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await page.getByRole("link", { name: translate("en", "setup.entry") }).click();
      if (language === "sv") {
        await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("sv");
        await expect(page.locator("html")).toHaveAttribute("lang", "sv");
      }
      await expect(page.getByText(m("setup.step", { step: 1, total: 3 }))).toBeVisible();
      await page.getByLabel(m("settings.name"), { exact: true }).fill("Studio Vide");
      const types = page.getByRole("radiogroup", { name: m("setup.type") });
      await expect(types.getByRole("radio")).toHaveCount(6);
      await expect(types.getByRole("radio", { name: language === "sv" ? "Klinik" : "Clinic" })).toHaveCount(0);
      await types.getByRole("radio", { name: m("setup.nails"), exact: true }).click();
      await expect(types.getByRole("radio", { name: m("setup.nails"), exact: true })).toHaveAttribute("aria-checked", "true");
      await frame(0);
      await page.getByRole("button", { name: m("welcome.next"), exact: true }).click();

      await expect(page.getByText(m("setup.step", { step: 2, total: 3 }))).toBeVisible();
      await expect(page.getByText(m("setup.nails1"), { exact: true })).toBeVisible();
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await page.getByRole("button", { name: m("setup.edit", { name: m("setup.nails1") }) }).click();
      await page.getByRole("spinbutton").first().fill("650");
      await page.getByRole("button", { name: m("setup.treatmentDone") }).click();
      await page.getByRole("button", { name: m("services.add") }).click();
      await page.getByRole("textbox").fill("Extra Demo");
      await page.getByRole("button", { name: m("setup.treatmentDone") }).click();
      await page.getByRole("button", { name: m("setup.remove", { name: "Extra Demo" }) }).click();
      await expect(page.getByText("Extra Demo")).toHaveCount(0);
      await frame(1);
      await page.getByRole("button", { name: m("setup.create") }).click();

      await expect(page.getByRole("heading", { name: m("setup.ready") })).toBeVisible();
      await expect(page.getByText(m("setup.step", { step: 3, total: 3 }))).toBeVisible();
      await frame(2);
      await page.getByRole("link", { name: m("setup.goToDay") }).click();
      await expect(page.getByRole("heading", { name: new RegExp(m("setup.checklist")) })).toContainText(m("setup.progress", { done: 1, total: 4 }));
      await expect(page.getByText(m("setup.example.tag"), { exact: true }).first()).toBeVisible();
      await expect(page.getByText(m("trial.notice"))).toBeVisible();
      await expect(page.locator('[data-help="role-switch"]')).toHaveCount(0);
      await audit(page);
      if (pictures) {
        await capture(page, "checklist");
        const gif = `${screens}-wizard.gif`;
        execFileSync("convert", ["-delay", "120", ...frames.map(f => `${screens}-${f}.jpg`), "-loop", "0", "-layers", "Optimize", gif]);
        expect((await stat(gif)).size).toBeLessThan(3_000_000);
      }
      await page.goto("/studio/setup");
      await page.getByRole("link", { name: m("setup.seePage") }).click();
      await expect(page).toHaveURL(/\/boka\/studio-vide$/);
      await page.goto("/boka/studio-vide?service=svc-1#book");
      await page.getByLabel(m("booking.yourName"), { exact: true }).fill("Nova Demo");
      await page.getByLabel(m("booking.yourPhone")).fill("0700009911");
      await page.getByRole("button", { name: m("booking.confirm"), exact: true }).click();
      await expect(page).toHaveURL(/\/boka\/studio-vide\/booking\//);
      await page.goto("/studio");
      await expect(page.getByText(m("setup.progress", { done: 3, total: 4 }))).toBeVisible();
      await page.getByRole("button", { name: m("setup.hide") }).click();
      await page.getByRole("button", { name: m("setup.demo") }).click();
      await expect(page.getByRole("button", { name: m("setup.resume") })).toBeVisible();
      await page.goto("/studio/setup");
      await expect(page.getByLabel(m("settings.name"), { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: m("setup.resume") }).click();
      await expect(page.getByRole("button", { name: m("setup.demo") })).toBeVisible();
      await expect(page.getByRole("heading", { name: new RegExp(m("setup.checklist")) })).toHaveCount(0);
    });
  });
}

test("all seven fresh studio views offer an action", async ({ page }) => {
  test.setTimeout(150_000);
  const fresh = createSalon(salonClock().today, { ...salonDraft("en"), treatments: [] });
  const state = { ...fresh, modules: { ...fresh.modules, campaigns: true, finance: true } };
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

test("setup from Settings can be finished with defaults alone", async ({ page }) => {
  await page.goto("/studio/more/settings");
  await page.getByRole("link", { name: "Start with your own salon" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create my salon" }).click();
  await expect(page.getByRole("link", { name: "See your booking page" })).toHaveAttribute("href", "/boka/my-salon");
});

test("an idle trial salon is removed with a friendly screen, and the demo salon stays", async ({ page }) => {
  const own = createSalon(salonClock().today, { ...salonDraft("en"), name: "Studio Vide" });
  await page.addInitScript(salon => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("salong-eko-demo-own", JSON.stringify(salon));
    localStorage.setItem("salong-eko-demo-own-last-used", String(Date.now() - 25 * 60 * 60 * 1000));
    sessionStorage.setItem("salong-eko-workspace", "own");
  }, own);
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "Your trial salon has been cleared" })).toBeVisible();
  await audit(page);
  await page.getByRole("button", { name: "Back to the demo salon" }).click();
  await expect(page.getByRole("button", { name: "Explore the demo salon" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("salong-eko-demo-own"))).toBeNull();
});

test("Delete now asks first and then removes the trial salon", async ({ page }) => {
  const own = createSalon(salonClock().today, { ...salonDraft("en"), name: "Studio Vide" });
  await page.addInitScript(salon => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("salong-eko-demo-own", JSON.stringify(salon));
    sessionStorage.setItem("salong-eko-workspace", "own");
  }, own);
  await page.goto("/studio");
  await page.getByRole("button", { name: "Delete now" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete your trial salon?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("This trial salon lives only in this browser")).toBeVisible();
  await page.getByRole("button", { name: "Delete now" }).click();
  await dialog.getByRole("button", { name: "Delete salon" }).click();
  await expect(page.getByRole("link", { name: "Start with your own salon" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("salong-eko-demo-own"))).toBeNull();
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
