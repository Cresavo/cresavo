import { readFile } from "node:fs/promises";
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
  const response = await page.goto("/studio");
  expect(await response?.text()).toMatch(/<html\b[^>]*\blang="en"/);
  await expect(page.getByRole("heading", { name: "Good morning, Anna" })).toBeVisible();
  await page.goto("/studio/more/settings");
  const studioLanguage = page.getByRole("combobox", { name: "Language", exact: true });
  await expect(studioLanguage).toHaveValue("en");
  await studioLanguage.selectOption("sv");
  await expect(page.getByRole("combobox", { name: "Språk", exact: true })).toHaveValue("sv");
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
  await page.goto("/studio/more/settings");
  await page.getByRole("combobox", { name: "Default booking language" }).selectOption("sv");
  await page.getByRole("checkbox", { name: "Let visitors switch between English and Swedish" }).uncheck();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Default booking language" })).toHaveValue("sv");

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
  await expect(page.getByRole("link", { name: "Boka igen", exact: true })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: /betalas (i|på) salongen/ })).toContainText(/\bkr\b/);
  const manageLink = page.getByRole("link", { name: "Hantera din bokning", exact: true });
  await expect(manageLink).toHaveAttribute("href", /\/booking\/[^/]+#manage$/);
  await manageLink.click();
  await expect(page).toHaveURL(/#manage$/);
  const google = new URL((await page.getByRole("link", { name: "Google Kalender" }).getAttribute("href"))!);
  expect(google.searchParams.get("text")).toBe("Medicinsk fotvård hos Salong Eko");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lägg till i kalendern" }).click();
  const file = await readFile(await (await download).path(), "utf8");
  expect(file).toContain("SUMMARY:Medicinsk fotvård hos Salong Eko");
  expect(file).toContain("DESCRIPTION:Du har en bokad tid om en timme");
  const [start, end] = google.searchParams.get("dates")!.split("/");
  expect(file).toContain(`DTSTART:${start}\r\nDTEND:${end}`);
  await capture(page, "confirmation");
  await page.getByRole("link", { name: "Se alla mina bokningar" }).click();
  await expect(page.getByRole("heading", { name: "Hej Nova, här är dina bokningar" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
});

test("the bilingual demo starts in English and lets visitors switch to Swedish independently of the studio", async ({ page }) => {
  await page.goto("/studio/more/settings");
  await expect(page.getByRole("combobox", { name: "Default booking language" })).toHaveValue("en");
  await expect(page.getByRole("checkbox", { name: "Let visitors switch between English and Swedish" })).toBeChecked();
  await page.getByRole("main").getByRole("combobox", { name: "Language", exact: true }).selectOption("sv");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Ordinarie bokningsspråk" })).toHaveValue("en");

  const response = await page.goto(bookingUrl);
  const html = await response?.text();
  expect(html).toMatch(/<html\b[^>]*\blang="en"/);
  expect(html).toContain("<title>Book online</title>");
  expect(html).toContain("Book your visit online. Demo with fictional data.");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "Book your visit online. Demo with fictional data.");
  await expect(page.getByRole("textbox", { name: "What would you like to book?" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const visitorLanguage = page.getByRole("banner").getByRole("combobox", { name: "Language", exact: true });
  await expect(visitorLanguage).toHaveValue("en");
  await expect(visitorLanguage).toBeInViewport({ ratio: 1 });
  expect((await visitorLanguage.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await visitorLanguage.selectOption({ label: "Svenska" });
  await expect(page.getByRole("textbox", { name: "Vad vill du boka?" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page).toHaveTitle("Boka tid");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("link", { name: "Mina bokningar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Find your bookings", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("combobox", { name: "Language", exact: true })).toHaveCount(0);
});
