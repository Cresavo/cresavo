import { test, expect } from "./fixtures";
import { chooseDay, chooseSlot } from "./date-controls";
import { DateTime } from "luxon";

test("datum väljs med tryck och tangentbord, tom dag har en väg vidare", async ({
  page,
  synthetic,
}) => {
  await page.goto("/");
  await page.locator("#name").fill("Syntetisk kalenderkund");
  await page.locator("#email").fill(`${synthetic.marker}@example.test`);
  let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 9 });
  while (day.weekday !== 6) day = day.plus({ days: 1 });
  await chooseDay(page, "date", day.toISODate()!);
  await expect(page.getByText(/Inga lediga tider lördag/)).toBeVisible();
  await page
    .getByRole("button", { name: "Hitta nästa lediga dag", exact: true })
    .click();
  await chooseSlot(page, "slot");
  await page.locator("#service").selectOption("massage");
  await expect(
    page.getByRole("button", { name: "Bekräfta testbokning" }),
  ).toBeDisabled();
  await expect(page.locator("#name")).toHaveValue("Syntetisk kalenderkund");
  await expect(page.locator("#email")).toHaveValue(
    `${synthetic.marker}@example.test`,
  );
  await chooseSlot(page, "slot");
  await page.locator("#staff").selectOption("staff-erik");
  await expect(
    page.getByRole("button", { name: "Bekräfta testbokning" }),
  ).toBeDisabled();
  await chooseSlot(page, "slot");
  await expect(
    page
      .getByRole("region", { name: "Din bokning" })
      .or(page.locator(".booking-review")),
  ).toContainText("450,00");
  await page.getByRole("button", { name: "Bekräfta testbokning" }).click();
  await expect(
    page.getByRole("heading", { name: "Din bokning är klar" }),
  ).toBeVisible();
  await expect(page.locator(".booking-success")).toContainText("Erik");
  await expect(page.locator(".booking-success")).toContainText("30 min");
});

test("kalendern går att använda med tangentbord och ryms vid 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  const today = DateTime.now().setZone("Europe/Stockholm").toISODate()!;
  const picker = page.locator("fieldset.date-picker");
  const selected = picker.locator("button[aria-pressed=true]");
  await expect(selected).toBeEnabled();
  await selected.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    picker.locator(
      `button[data-date="${DateTime.fromISO(today).plus({ days: 1 }).toISODate()}"]`,
    ),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#date")).toHaveValue(
    DateTime.fromISO(today).plus({ days: 1 }).toISODate()!,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const targets = await picker
    .locator("button[data-date]:not(:disabled)")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        width: n.getBoundingClientRect().width,
        height: n.getBoundingClientRect().height,
      })),
    );
  expect(targets.every((t) => t.width >= 30 && t.height >= 44)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("customer-calendar-320.png"),
    fullPage: true,
  });
});

test("alla arbetsytans menyer och datumval ryms på en smal telefon", async ({
  page,
  synthetic,
}) => {
  const auth = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(auth.status()).toBe(200);
  await page.setViewportSize({ width: 320, height: 844 });
  for (const [path, ready] of [
    ["/admin", "h1"],
    ["/admin/services", "#service-name"],
    ["/admin/staff", "#staff-name"],
    ["/admin/campaigns", "h1"],
  ]) {
    await page.goto(path);
    await expect(page.locator(ready)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const link of await page
      .locator("nav[aria-label=Administration] a")
      .all()) {
      const rect = await link.boundingBox();
      expect(rect!.width).toBeGreaterThan(100);
      expect(rect!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto("/admin");
  await page.locator(".calendar-date-choice > summary").click();
  await chooseDay(
    page,
    "calendar-date",
    DateTime.now().setZone("Europe/Stockholm").plus({ days: 2 }).toISODate()!,
  );
  await expect(page).toHaveURL(/date=/);
});

test("demoinloggning är stängd i normalt läge även med falska miljöheaders", async ({
  request,
}) => {
  const response = await request.post("/api/demo/session", {
    headers: {
      origin: "http://localhost:3000",
      VERCEL: "1",
      VERCEL_ENV: "preview",
      BOOKING_DEMO_ACCESS: "1",
    },
  });
  expect(response.status()).toBe(403);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect((await request.get("/api/demo/session")).status()).toBe(405);
});
