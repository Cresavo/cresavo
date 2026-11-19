import { expect, test, type Page } from "@playwright/test";

// The journey that has to stay short: from the demo to your own salon's booking page
// in at most three setup screens and ten inputs, with no question setup can answer itself.
const MAX_SCREENS = 3;
const MAX_INPUTS = 10;

test("own salon to own booking page", async ({ page }) => {
  let screens = 0;
  let inputs = 0;
  const screen = async (page: Page) => {
    screens++;
    inputs += await page.getByRole("main").locator("input, select, textarea").count();
  };

  await page.goto("/studio");
  await page.getByRole("link", { name: "Start with your own salon" }).click();
  await expect(page.getByRole("heading", { name: "What’s your salon called?" })).toBeVisible();
  await screen(page);
  await page.getByLabel("Name", { exact: true }).fill("Studio Linnea");
  await page.getByRole("radio", { name: "Lashes & brows" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByRole("heading", { name: "What can clients book?" })).toBeVisible();
  await screen(page);
  await expect(page.getByText("Lash lift", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create my salon" }).click();

  await expect(page.getByRole("heading", { name: "Your salon is ready" })).toBeVisible();
  await screen(page);
  expect(screens).toBeLessThanOrEqual(MAX_SCREENS);
  expect(inputs).toBeLessThanOrEqual(MAX_INPUTS);

  await page.getByRole("link", { name: "See your booking page" }).click();
  await expect(page).toHaveURL(/\/boka\/studio-linnea$/);
  await expect(page.getByRole("heading", { name: "Studio Linnea", level: 1 })).toBeVisible();
  await expect(page.getByText("Lash lift").first()).toBeVisible();

  // Today is not empty: the next customer is an example, and a one-person salon has no role switch.
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: /^Getting started/ })).toBeVisible();
  await expect(page.getByText("Example", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("This trial salon lives only in this browser and is removed after 24 hours without use.")).toBeVisible();
  await page.goto("/studio/more/advanced");
  await expect(page.getByRole("heading", { name: "Advanced", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview the staff view", exact: true })).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("salong-eko-demo-own")!));
  expect(Object.values(state.modules).some(Boolean)).toBe(false);
});
