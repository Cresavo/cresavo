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
  await expect(
    page.getByRole("heading", { name: "Din bokning är klar", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Din bokning är klar", exact: true }),
  ).toBeInViewport();
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
    if (path === "/admin/services")
      await page
        .getByRole("link", { name: /Fotvård/ })
        .first()
        .click();
    if (path === "/admin/staff")
      await page.getByRole("link", { name: /Anna/ }).first().click();
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin?view=week");
  await expect(
    page.getByRole("region", { name: "Veckokalender" }),
  ).toBeVisible();
  const lane = page.locator(".staff-headings span").first();
  expect((await lane.boundingBox())!.width).toBeGreaterThanOrEqual(150);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#calendar-staff").selectOption("staff-demo");
  await expect(page).toHaveURL(/staffId=staff-demo/);
  expect((await lane.boundingBox())!.width).toBeGreaterThanOrEqual(150);
});

test("bred veckokalender behåller tidsaxeln vid sidscroll", async ({
  page,
  synthetic,
}) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  for (const i of [1, 2]) {
    const key = `${synthetic.marker}-scroll-${i}`;
    synthetic.trackWorkspaceRequest(key);
    const response = await page.request.post("/api/admin/staff", {
      headers: { origin: "http://localhost:3000", "Idempotency-Key": key },
      data: {
        name: `Syntetisk scroll ${i}`,
        serviceIds: ["massage"],
        weekly: [],
        active: true,
      },
    });
    expect(response.status()).toBe(200);
    synthetic.trackResource("staff", (await response.json()).id);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin?view=week");
  const region = page.getByRole("region", { name: "Veckokalender" });
  await expect(page.locator(".staff-headings span")).toHaveCount(28);
  await region.focus();
  const rect = (await region.boundingBox())!;
  const end = await region.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(end).toBeGreaterThan(1800);
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => region.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  // Jump deterministically to the far end after checking native keyboard input.
  // This exercises sticky layout without depending on OS scroll animation speed.
  await region.evaluate((el) =>
    el.scrollTo({ left: el.scrollWidth, behavior: "instant" }),
  );
  await expect
    .poll(() => region.evaluate((el) => el.scrollLeft))
    .toBeGreaterThanOrEqual(end - 1);
  const axis = (await page.locator(".calendar-axis").boundingBox())!;
  expect(Math.abs(axis.x - rect.x)).toBeLessThanOrEqual(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("demoinloggning är stängd i normalt läge även med falska miljöheaders", async ({
  request,
}) => {
  const response = await request.post(
    "/api/demo/session?BOOKING_DEMO_ACCESS=1&VERCEL_ENV=preview",
    {
      headers: {
        origin: "http://localhost:3000",
        VERCEL: "1",
        VERCEL_ENV: "preview",
        BOOKING_DEMO_ACCESS: "1",
      },
      data: { BOOKING_DEMO_ACCESS: "1", VERCEL: "1", VERCEL_ENV: "preview" },
    },
  );
  expect(response.status()).toBe(403);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect((await request.get("/api/demo/session")).status()).toBe(405);
});
