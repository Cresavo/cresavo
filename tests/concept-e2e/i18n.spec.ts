import { expect, test, type Page } from "@playwright/test";

test.use({ locale: "sv-SE", colorScheme: "light" });

const bookingUrl = "/boka/salong-eko";

async function capture(page: Page, name: string) {
  if (process.env.CONCEPT_SCREENSHOTS !== "1" || page.viewportSize()?.width !== 390) return;
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  const image = await page.screenshot({
    type: "jpeg",
    quality: 76,
    animations: "disabled",
    path: `docs/design/cresavo/screens/i18n-sv-${name}.jpg`,
  });
  expect(image.length).toBeLessThan(300_000);
}

test.beforeEach(async ({ page }, testInfo) => {
  await page.setViewportSize({ width: testInfo.project.name === "mobile" ? 390 : 1440, height: 900 });
  await page.clock.setFixedTime(new Date("2026-11-17T10:00:00+01:00"));
});

test("Swedish studio Today and rules-only assistant", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "God morgon, Anna" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dagens schema" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("link", { name: "Idag", exact: true }).locator("visible=true").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await capture(page, "studio-today");

  await page.getByRole("button", { name: "Assistent", exact: true }).locator("visible=true").first().click();
  const input = page.getByRole("textbox", { name: "Meddelande" });
  await input.fill("Vilka kommer idag?");
  await input.press("Enter");
  await expect(page.getByText(/bokningar? tisdag 17 november/).first()).toBeVisible();
});

test("Swedish booking, confirmation and management", async ({ page }) => {
  await page.goto(bookingUrl);
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("link", { name: "Mina bokningar", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Språk", exact: true })).toHaveCount(0);
  const ask = page.getByRole("textbox", { name: "Vad vill du boka?" });
  await expect(ask).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await capture(page, "booking-page");

  await ask.fill("Fotvård i övermorgon hos Anna");
  await ask.press("Enter");
  await page.getByRole("button", { name: /till \d\d:\d\d/ }).first().click();
  await page.getByLabel("Ditt namn", { exact: true }).fill("Nova Demo");
  await page.getByLabel("Mobilnummer").fill("070-000 99 11");
  await page.getByRole("button", { name: "Bekräfta bokning", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Din tid är bokad" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("button", { name: "Omboka", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Avboka", exact: true })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: /betalas i salongen/ })).toContainText(/\bkr\b/);
  await capture(page, "confirmation");
  await page.getByRole("link", { name: "Se alla mina bokningar" }).click();
  await expect(page.getByRole("heading", { name: "Hej Nova, här är dina bokningar" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
});

test("studio preference and optional visitor switch are independent", async ({ page }) => {
  await page.goto("/studio/more/settings");
  await page.getByRole("main").getByRole("combobox", { name: "Språk", exact: true }).selectOption("en");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("checkbox", { name: "Let visitors switch between English and Swedish" }).check();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Default booking language" })).toHaveValue("sv");

  await page.goto(bookingUrl);
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await page.getByRole("combobox", { name: "Språk", exact: true }).selectOption("en");
  await expect(page.getByRole("textbox", { name: "What would you like to book?" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("link", { name: "My bookings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hitta dina bokningar", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("combobox", { name: "Språk", exact: true })).toHaveCount(0);
});
