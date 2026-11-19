import { expect, test, type Locator } from "@playwright/test";

test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "Desktop form layout");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

async function expectWidthAtMost(control: Locator, max: number) {
  await expect(control).toBeVisible();
  expect(await control.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(max);
}

test("campaign controls fit their content and the treatments follow the studio language", async ({ page }) => {
  await page.goto("/studio/more/settings");
  await page.getByRole("main").getByRole("combobox", { name: "Language", exact: true }).selectOption("sv");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");

  await page.goto("/studio/more/campaigns/new");
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Medicinsk fotvård", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Klassisk massage 60 min", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Medical foot care", exact: true })).toHaveCount(0);
  await expectWidthAtMost(main.getByLabel("Kampanjnamn"), 400);
  await expectWidthAtMost(main.getByRole("combobox", { name: "Utgå från" }), 640);
  await expectWidthAtMost(main.getByLabel("Erbjudandet börjar"), 260);
  await expectWidthAtMost(main.getByRole("button", { name: "Skriv texterna" }), 360);
});

test("salon details use a bounded form and a natural-width save button", async ({ page }) => {
  await page.goto("/studio/more/settings/salon");
  const form = page.getByRole("main").locator("form");
  const inputs = form.getByRole("textbox");
  await expect(inputs).toHaveCount(5);
  for (const input of await inputs.all()) {
    await expectWidthAtMost(input, 640);
  }
  await expectWidthAtMost(form.getByRole("button", { name: "Save details" }), 360);
});
