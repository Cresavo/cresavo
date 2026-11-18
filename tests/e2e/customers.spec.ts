import { chooseDemoSalon } from "./booking-entry";
import { test, expect } from "./fixtures";
import { chooseDay, chooseSlot } from "./date-controls";
import { DateTime } from "luxon";

test("long customer names fit in details, lists, and booking controls without mobile zoom", async ({
  page,
  synthetic,
}) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  const name = "S".repeat(80);
  await page.goto("/admin/customers/new");
  await page.locator("#customer-name").fill(name);
  await page.locator("#customer-email").fill("s".repeat(64) + "@example.test");
  await page.getByRole("button", { name: "Skapa kund", exact: true }).click();
  await expect(page).toHaveURL(
    /\/admin\/customers\/(?!new(?:[/?]|$))[^/?]+(?:\?[^#]*)?$/,
  );
  const card = new URL(page.url()).origin + new URL(page.url()).pathname;
  async function fits(selector: string, width: number) {
    await expect(page.locator(selector).first()).toBeVisible();
    expect(await page.evaluate(() => innerWidth)).toBe(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const node of await page.locator(selector).all())
      expect(
        await node.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(card);
    await fits(".customer-card-heading h1", width);
    await fits(".customer-contact", width);
    await page.getByRole("link", { name: "Ny bokning", exact: true }).click();
    await fits(".customer-picker p", width);
    await page.getByRole("button", { name: "Byt kund", exact: true }).click();
    await page.locator("#booking-customer-search").fill(name);
    await page.getByRole("button", { name: "Sök kund", exact: true }).click();
    await fits(".customer-choices button", width);
    await page.getByRole("button", { name, exact: true }).click();
    await fits(".customer-picker p", width);
    await page.goto("/admin/customers?q=" + name);
    await fits(".customer-row strong", width);
    await page.locator(".customer-row").filter({ hasText: name }).click();
    await expect(page).toHaveURL((url) => url.origin + url.pathname === card);
  }
});

test("customer details link booking, edits, rescheduling, cancellation, and a repeat visit", async ({
  page,
  synthetic,
}) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  await page.goto("/admin/customers");
  await page.getByRole("link", { name: "Ny kund", exact: true }).click();
  await page.locator("#customer-name").fill(synthetic.marker);
  await page
    .locator("#customer-email")
    .fill(`${synthetic.marker}@example.test`);
  await page.getByRole("button", { name: "Skapa kund", exact: true }).click();
  await expect(page).toHaveURL(
    /\/admin\/customers\/(?!new(?:[/?]|$))[^/?]+(?:\?[^#]*)?$/,
  );
  const customerUrl = new URL(page.url()).origin + new URL(page.url()).pathname;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: synthetic.marker, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ny bokning", exact: true }).click();
  await expect(page.getByText("Vald kund:")).toContainText(synthetic.marker);
  await page.locator("#booking-service").selectOption("massage");
  let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 33 });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  await chooseDay(page, "booking-date", day.toISODate()!);
  await chooseSlot(page, "booking-slot");
  await page
    .getByRole("button", { name: "Skapa bokning", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/admin\/bookings\/(?!new(?:[/?]|$))[^/?]+(?:\?[^#]*)?$/,
  );
  const bookingUrl = new URL(page.url()).origin + new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Öppna kundkort", exact: true }).click();
  await page.getByText("Redigera kunduppgifter", { exact: true }).click();
  await page.locator("#customer-name").fill(synthetic.marker + " ändrad");
  await page
    .getByRole("button", { name: "Spara kundkort", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: synthetic.marker + " ändrad",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Kundkortet är sparat");
  await page.goto(bookingUrl);
  await expect(page.locator(".booking-summary")).toContainText(
    synthetic.marker,
  );
  await expect(page.locator(".booking-summary")).not.toContainText(
    synthetic.marker + " ändrad",
  );
  await page.getByRole("button", { name: "Flytta", exact: true }).click();
  day = day.plus({ days: 1 });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  await chooseDay(page, "booking-date", day.toISODate()!);
  await chooseSlot(page, "booking-slot");
  await page.getByRole("button", { name: "Spara flytt", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("har flyttats");
  await page.getByRole("button", { name: "Avboka", exact: true }).click();
  await page.getByRole("button", { name: "Ja, avboka", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("är avbokad");
  await page.goto(customerUrl + "?view=history");
  await expect(page.locator(".customer-visits")).toContainText("Avbokad");
  await page.getByRole("link", { name: "Boka återbesök", exact: true }).click();
  await expect(page.getByText("Vald kund:")).toContainText(
    synthetic.marker + " ändrad",
  );
  await chooseDay(page, "booking-date", day.toISODate()!);
  await chooseSlot(page, "booking-slot");
  await page
    .getByRole("button", { name: "Skapa bokning", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/admin\/bookings\/(?!new(?:[/?]|$))[^/?]+(?:\?[^#]*)?$/,
  );
  await page.goto("/admin/customers");
  await page
    .locator("#customer-search")
    .fill(`${synthetic.marker}@example.test`);
  await page.getByRole("button", { name: "Sök kunder", exact: true }).click();
  await expect(page.locator(".customer-list")).toContainText(
    synthetic.marker + " ändrad",
  );
  await page.goto(customerUrl);
  await page.getByText("Redigera kunduppgifter", { exact: true }).click();
  await page.getByRole("checkbox", { name: /Arkivera kundkortet/ }).check();
  await page
    .getByRole("button", { name: "Spara kundkort", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Kundkortet är sparat");
  await expect(page.locator(".eyebrow")).toContainText("arkiverat");
  await page.goto(customerUrl + "?view=history");
  await expect(page.locator(".customer-visits")).toContainText("Avbokad");
  await expect(
    page.getByRole("link", { name: "Ny bokning", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the product entry and customer API expose clear paths and enforce access controls", async ({
  page,
}) => {
  for (const path of [
    "/api/admin/customers",
    "/api/admin/customers/guessed-id",
  ])
    expect((await page.request.get(path)).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/admin/customers", {
        headers: { origin: "http://localhost:3000" },
        data: {
          action: "create",
          name: "Obehörig demo",
          email: "denied@example.test",
        },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/");
  await chooseDemoSalon(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
