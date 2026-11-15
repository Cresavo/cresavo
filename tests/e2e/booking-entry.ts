import { expect, type Page } from "@playwright/test";

// Follow the same salon choice as a customer, including the mobile track tab.
export async function chooseDemoSalon(page: Page) {
  const customer = page.getByTestId("track-customer");
  await expect(customer.getByRole("combobox", { name: /^(Treatment|Behandling)$/ })).toBeHidden();
  await page.locator('[data-testid="salon-card"][data-salon="eko"]')
    .getByRole("button", { name: /^(Choose salon|Välj salong)/ }).click();
  const customerTab = page.getByRole("tab", { name: /^(Book yourself|Boka själv)/ });
  if (await customerTab.isVisible()) await customerTab.click();
  await expect(customer.getByRole("combobox", { name: /^(Treatment|Behandling)$/ })).toBeVisible();
  await expect(customer.getByRole("combobox", { name: /^(Treatment|Behandling)$/ })).toBeEnabled();
}
