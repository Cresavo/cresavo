import { chooseDemoSalon } from "./booking-entry";
import { test, expect } from "./fixtures";

test("language changes preserve booking details and selected day", async ({
  page,
  synthetic,
}) => {
  await page.goto("/");
  await chooseDemoSalon(page);
  await page.getByTestId("track-customer")
    .getByLabel("Namn (påhittat)", { exact: true })
    .fill(synthetic.marker);
  await page.getByTestId("track-customer")
    .getByLabel("E-post (påhittad)", { exact: true })
    .fill(`${synthetic.marker}@example.test`);
  const chosen = await page.getByTestId("track-customer")
    .locator('fieldset.date-picker button[aria-pressed="true"]')
    .first()
    .getAttribute("aria-label");
  await page
    .getByRole("combobox", { name: "Språk", exact: true })
    .selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByTestId("track-customer").getByLabel("Name (fictional)", { exact: true }),
  ).toHaveValue(synthetic.marker);
  await expect(
    page.getByTestId("track-customer").getByLabel("Email (fictional)", { exact: true }),
  ).toHaveValue(`${synthetic.marker}@example.test`);
  await expect(
    page.getByRole("button", { name: "Confirm demo booking", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Language", exact: true })
    .selectOption("sv");
  await expect(page.locator("html")).toHaveAttribute("lang", "sv");
  await expect(page.getByTestId("track-customer").locator('fieldset.date-picker button[aria-pressed="true"]').first()).toHaveAttribute(
    "aria-label",
    chosen!,
  );
  await expect(page.getByLabel("Namn (påhittat)", { exact: true })).toHaveValue(
    synthetic.marker,
  );
});

test.describe("English workspace", () => {
  test.use({ locale: "en-GB" });
  test("opens existing administration and keeps the locale across navigation", async ({
    page,
    synthetic,
  }) => {
    await page.goto("/admin");
    await page
      .getByLabel("Administrator email", { exact: true })
      .fill(synthetic.admin.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(synthetic.admin.password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Calendar", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "New booking", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "New booking", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Treatment", { exact: true })).toBeVisible();
    await page
      .getByRole("link", { name: "Back to calendar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Calendar", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Customers", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Customers", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
