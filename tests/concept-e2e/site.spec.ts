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
