import { expect, test, type Page } from "@playwright/test";
import { createDemoState } from "../../src/concept/data/generate";
import { translate, type MessageKey } from "../../src/concept/i18n";
import { createSalon, salonDraft } from "../../src/concept/onboarding/salon";

// A screenshot walkthrough of "Show me" for review, not a CI check: it runs only when SHOW_ME_SHOTS names a folder.
//   SHOW_ME_SHOTS=/path/to/shots npx playwright test -c <config> show-me-walkthrough
// Each question runs at 390 and 1280 px, light and dark, and saves the answer and every step of the guide.

const shots = process.env.SHOW_ME_SHOTS;
test.skip(!shots, "Set SHOW_ME_SHOTS to a folder to take the walkthrough screenshots.");
test.describe.configure({ mode: "parallel" });
test.setTimeout(120000);

const NOW = new Date("2026-11-17T11:00:00+01:00");
const QUESTIONS = [
  { name: "move-booking", language: "sv", text: "hur flyttar jag en bokning?" },
  { name: "reset-demo", language: "sv", text: "var återställer jag demon?" },
  { name: "opening-hours", language: "en", text: "how do I change opening hours?" },
  { name: "take-payment", language: "sv", text: "ta betalt" },
  { name: "share-link", language: "sv", text: "dela bokningslänken" },
  { name: "connect-claude", language: "sv", text: "koppla Claude" },
  { name: "no-match", language: "sv", text: "var ställer jag in pizzaugnen?" },
] as const;
const LAYOUTS = [{ name: "390", width: 390, height: 844 }, { name: "1280", width: 1280, height: 800 }] as const;
const THEMES = ["light", "dark"] as const;

type Language = "en" | "sv";

async function open(page: Page, language: Language, theme: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(NOW);
  await page.context().addCookies([{ name: "booking-locale", value: language, url: "http://127.0.0.1" }]);
  await page.addInitScript((theme) => {
    localStorage.setItem("ui-theme", theme);
    localStorage.setItem("studio-tour-seen-v1", "1");
  }, theme);
}

async function save(page: Page, file: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${shots}/${file}.png` });
}

async function openHelp(page: Page) {
  await page.locator('[data-help-id="shell.help"]:visible').first().click();
  await expect(page.locator('[data-help-id="help.show-me"]')).toBeVisible();
}

for (const layout of LAYOUTS) {
  for (const theme of THEMES) {
    for (const question of QUESTIONS) {
      test(`${question.name} at ${layout.name} in ${theme}`, async ({ page }) => {
        const text = (key: MessageKey) => translate(question.language, key);
        await open(page, question.language, theme, layout.width, layout.height);
        await page.goto("/studio");
        await openHelp(page);
        await page.getByLabel(text("showMe.fieldLabel")).fill(question.text);
        await page.getByLabel(text("showMe.fieldLabel")).press("Enter");
        const prefix = `${question.name}-${layout.name}-${theme}`;
        if (question.name === "no-match") {
          await expect(page.getByText(text("showMe.none"))).toBeVisible();
          await save(page, `${prefix}-0-no-match`);
          return;
        }
        const choice = page.getByRole("button", { name: new RegExp(`^${text("showMe.submit")}:`) }).first();
        await expect(choice).toBeVisible();
        await save(page, `${prefix}-0-answer`);
        await choice.click();
        const card = page.locator(".studio-show-me-card");
        for (let step = 1; step <= 6; step++) {
          await expect(card).toBeVisible();
          await expect(page.locator("[data-tour-active]").first()).toBeVisible({ timeout: 30000 });
          await save(page, `${prefix}-${step}-step`);
          const takeMe = card.getByRole("button", { name: text("showMe.takeMe") });
          if (!(await takeMe.isVisible())) break;
          await takeMe.click();
        }
        await expect(card).toBeVisible();
      });
    }

    test(`missing setup and a friendly error at ${layout.name} in ${theme}`, async ({ page }) => {
      await open(page, "sv", theme, layout.width, layout.height);
      const demo = createDemoState("2026-11-17");
      const draft = { ...salonDraft("sv"), name: "Studio Vide", treatments: [], hours: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, null])) };
      const own = { ...createSalon("2026-11-17", draft), services: [] };
      await page.addInitScript(({ demo, own }) => {
        if (localStorage.getItem("salong-eko-demo-demo")) return;
        localStorage.setItem("salong-eko-demo", JSON.stringify(own));
        localStorage.setItem("salong-eko-demo-demo", JSON.stringify(demo));
      }, { demo, own });
      await page.route("**/api/concept/help**", (route) => route.abort());
      await page.goto("/studio");
      await openHelp(page);
      await expect(page.getByRole("heading", { name: translate("sv", "setupGaps.title") })).toBeVisible();
      await save(page, `missing-setup-${layout.name}-${theme}`);
      await page.getByLabel(translate("sv", "showMe.fieldLabel")).fill("lägga till en behandling");
      await page.getByLabel(translate("sv", "showMe.fieldLabel")).press("Enter");
      await expect(page.getByText(translate("sv", "help.failed"))).toBeVisible();
      await save(page, `friendly-error-${layout.name}-${theme}`);
    });
  }
}
