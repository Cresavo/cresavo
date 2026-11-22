import { expect, test } from "@playwright/test";
import { sv } from "../../src/concept/site/sv";

test.use({ colorScheme: "light", reducedMotion: "reduce" });

test("the Swedish homepage declares its language and opens the demo in Swedish", async ({ page }, testInfo) => {
  const width = testInfo.project.name === "mobile" ? 390 : 1440;
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await page.getByRole("link", { name: "Svenska", exact: true }).first().click();
  await expect(page).toHaveURL(/\/sv$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(sv["home.hero.heading"]);
  for (const link of await page.getByRole("link", { name: "English", exact: true }).all()) await expect(link).toHaveAttribute("href", "/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "/sv");
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "sv_SE");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", sv["soon.title"]);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", sv["soon.description"]);
  for (const [lang, path] of [["en", "/"], ["sv", "/sv"], ["x-default", "/"]]) {
    await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveAttribute("href", path);
  }
  const links = page.locator('a[href*="/studio"]');
  expect(await links.count()).toBeGreaterThanOrEqual(4);
  for (const link of await links.all()) await expect(link).toHaveAttribute("href", "/studio?lang=sv");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);

  if (process.env.CONCEPT_SCREENSHOTS === "1") {
    await page.evaluate(async () => { await document.fonts.ready; });
    const shot = await page.screenshot({
      type: "jpeg", quality: 78, animations: "disabled",
      path: `docs/design/cresavo/screens/site-sv-${width}-light.jpg`,
    });
    expect(shot.length).toBeLessThan(400_000);
  }

  await page.getByRole("link", { name: sv["home.hero.demo"] }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByRole("heading", { name: "Dagens schema" })).toBeVisible();
  await page.goto("/boka/salong-eko");
  await expect(page.getByRole("combobox", { name: "Språk" })).toHaveValue("sv");
  await expect(page.getByRole("link", { name: "Mina bokningar" })).toBeVisible();
});

test.describe("the Swedish site without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("serves Swedish HTML with Swedish links to the demo and the client's booking page", async ({ page }) => {
    await page.goto("/sv");
    await expect(page.locator("html")).toHaveAttribute("lang", "sv");
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator("#closing")).toContainText(sv["closing.text"]);
    await expect(page.getByRole("link", { name: sv["home.hero.booking"] })).toHaveAttribute("href", "/boka/salong-eko?lang=sv");
    await expect(page.getByRole("img", { name: sv["home.hero.mark"] })).toHaveCount(1);
    await page.getByRole("contentinfo").getByRole("link", { name: "Integritet" }).click();
    await expect(page).toHaveURL(/\/sv\/privacy$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "sv");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Integritet");
    await expect(page.getByRole("main")).toContainText("Niclas Vestlund");
    await expect(page.getByRole("main")).toContainText("info@cresavo.com");
  });
});

test("both public homepages publish their own canonical and reciprocal language links", async ({ request }) => {
  // Locally there is no public product origin, so links are root-relative; production makes them absolute.
  for (const path of ["/", "/sv"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`rel="canonical" href="${path}"`);
    for (const [lang, href] of [["en", "/"], ["sv", "/sv"], ["x-default", "/"]]) {
      expect(html).toMatch(new RegExp(`hrefLang="${lang}" href="${href}"`, "i"));
    }
    expect(html).toContain(`property="og:locale" content="${path === "/sv" ? "sv_SE" : "en_GB"}"`);
    if (path === "/sv") expect(html).toMatch(/href="[^"]*\/studio\?lang=sv"/);
  }
});
