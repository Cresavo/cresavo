import { chooseDemoSalon } from "./booking-entry";
import { test, expect } from "./fixtures";
import { chooseDay } from "./date-controls";
import { DateTime } from "luxon";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { createBooking, getAvailability } from "../../src/lib/domain";
import { moveBooking } from "../../src/lib/booking-mutations";
import { LOCAL_WORKSPACE_ACTOR } from "../../src/lib/workspace-write";

test("activity history distinguishes the local A2A trial from public bookings and preserves older events", async ({
  page,
  synthetic,
}, testInfo) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 24 });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const db = createDatabaseClient();
  try {
    for (const [channel, label] of [
      ["public-history-demo", "Kund- eller bokningskanal"],
      ["a2a:local-customer-demo:v1", "Lokalt A2A-prov"],
    ]) {
      const slots = await getAvailability(
        "massage",
        day.toISODate()!,
        undefined,
        "staff-demo",
      );
      expect(slots.length).toBeGreaterThan(0);
      const booking = await createBooking(
        {
          serviceId: "massage",
          staffId: "staff-demo",
          start: slots[0],
          customerName: "Syntetiskt historikprov",
          customerEmail: `${synthetic.marker}@example.test`,
          // Payload claims cannot choose the server-owned history channel.
          actorKind: "local-a2a",
          clientAddress: "a2a:local-customer-demo:v1",
        },
        undefined,
        channel,
      );
      await page.goto(`/admin/bookings/${booking.id}`);
      await page.getByText("Historik", { exact: true }).click();
      await expect(page.locator(".event-list")).toContainText(label);
      const original = await db.bookingEvent.findFirstOrThrow({
        where: { bookingId: booking.id },
      });
      if (channel === "public-history-demo")
        expect(original.actorKind).toBe("public");
      else {
        expect(original.actorKind).toBe("public");
        expect(original.actorId).toBe("local-a2a-demo-channel:v1");
        await page.screenshot({
          path: testInfo.outputPath("local-a2a-history.png"),
          fullPage: true,
        });
        await page
          .context()
          .addCookies([
            {
              name: "booking-locale",
              value: "en",
              url: "http://localhost:3000",
            },
          ]);
        await page.reload();
        await page.getByText("History", { exact: true }).click();
        await expect(page.locator(".event-list")).toContainText(
          "Local A2A demo",
        );
      }
      expect(
        await db.bookingEvent.findUniqueOrThrow({ where: { id: original.id } }),
      ).toEqual(original);
    }
  } finally {
    await db.$disconnect();
  }
});

test("calendar, booking, and customer details preserve date, filters, search, and return position", async ({
  page,
  synthetic,
}, testInfo) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  // Only the established login fields belong to the public contract.
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  const db = createDatabaseClient();
  const id = synthetic.marker;
  synthetic.trackResource("service", id);
  synthetic.trackResource("staff", id);
  synthetic.trackResource("customer", id);
  const day = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 12 })
    .startOf("week")
    .plus({ days: 4 })
    .startOf("day");
  try {
    await db.service.create({
      data: {
        id,
        businessId: "demo",
        name: "Syntetisk sammanhangsbehandling",
        duration: 30,
        priceOre: 45000,
      },
    });
    await db.staff.create({
      data: {
        id,
        businessId: "demo",
        name: "Syntetisk sammanhangspersonal",
        serviceIds: [id],
        weekly: Array.from({ length: 7 }, (_, i) => ({
          weekday: i + 1,
          periods: [{ start: "09:00", end: "17:00" }],
          breaks: [],
        })),
        exceptions: [],
      },
    });
    await db.customer.create({
      data: { id, businessId: "demo", name: id, email: `${id}@example.test` },
    });
    const booking = await createBooking(
      {
        serviceId: id,
        staffId: id,
        customerId: id,
        start: day.set({ hour: 14 }).toUTC().toISO()!,
      },
      undefined,
      undefined,
      { kind: "admin", id: synthetic.admin.id },
    );
    const agentKey = `${id}-agent-move`;
    synthetic.trackWorkspaceRequest(agentKey, "mcp");
    await moveBooking(
      {
        id: booking.id,
        expectedVersion: booking.version,
        staffId: id,
        start: day.set({ hour: 15 }).toUTC().toISO()!,
      },
      agentKey,
      LOCAL_WORKSPACE_ACTOR,
    );
    const calendar = `/admin?date=${day.toISODate()}&view=day&staffId=${id}&status=all`;
    await page.goto(calendar);
    const visit = page
      .locator(`a[href="/admin/bookings/${booking.id}"]`)
      .filter({ visible: true })
      .first();
    await visit.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => scrollY);
    await visit.click();
    await expect(
      page.getByRole("heading", { name: "Bokning", exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(calendar);
    await page.getByText("Historik", { exact: true }).click();
    await expect(page.locator(".event-list")).toContainText(
      "Salongens arbetsyta",
    );
    await expect(page.locator(".event-list")).toContainText(
      "Lokal agentanslutning",
    );
    const detail = page.url();
    await page
      .getByRole("link", { name: "Öppna kundkort", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Till bokningen", exact: true })
      .click();
    await expect(page).toHaveURL(detail);
    await page
      .getByRole("link", { name: "Till kalendern", exact: true })
      .click();
    await expect
      .poll(() => new URL(page.url()).pathname + new URL(page.url()).search)
      .toBe(calendar);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
    await visit.click();
    await expect(
      page.getByRole("heading", { name: "Bokning", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Avboka", exact: true }).click();
    await page
      .getByRole("button", { name: "Behåll bokningen", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Avboka", exact: true }),
    ).toBeFocused();
    await page.goBack();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
    // The week is wider than the desktop viewport: both axes belong to the
    // calendar context, for an explicit return and ordinary browser Back.
    const originalViewport = page.viewportSize()!;
    await page.setViewportSize({ width: 1280, height: 900 });
    const week = calendar
      .replace("view=day", "view=week")
      .replace(`&staffId=${id}`, "");
    await page.goto(week);
    const grid = page.getByRole("region", {
      name: "Veckokalender",
      exact: true,
    });
    await visit.scrollIntoViewIfNeeded();
    const weekX = await grid.evaluate((element) => element.scrollLeft);
    const layout = () => page.evaluate(() => ({
      y: scrollY,
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
      bannerHeight: document.querySelector('.demo-banner')?.getBoundingClientRect().height,
      mainHeight: document.querySelector('main')?.getBoundingClientRect().height,
      savedPositions: Object.keys(sessionStorage).filter(k => k.startsWith('booking-return:')).map(k => JSON.parse(sessionStorage.getItem(k)!)),
    }));
    const originalLayout = await layout();
    expect(weekX).toBeGreaterThan(0);
    for (const browserBack of [false, true]) {
      // Playwright can scroll again while bringing the click point into view,
      // especially with mobile emulation and a wide week. Measure the actual
      // departure independently at the input event, before the app's handler.
      await page.evaluate(() => {
        document.addEventListener("click", () => {
          sessionStorage.setItem("test-departure-scroll", JSON.stringify({
            y: scrollY,
            x: document.querySelector('[data-calendar-scroll]')?.scrollLeft ?? 0,
          }));
        }, { capture: true, once: true });
      });
      await visit.click();
      await expect(
        page.getByRole("heading", { name: "Bokning", exact: true }),
      ).toBeVisible();
      const departure = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test-departure-scroll")!)) as { y: number; x: number };
      if (browserBack) await page.goBack();
      else
        await page
          .getByRole("link", { name: "Till kalendern", exact: true })
          .click();
      await expect
        .poll(() => new URL(page.url()).pathname + new URL(page.url()).search)
        .toBe(week);
      await expect(grid).toBeVisible();
      await testInfo.attach(`return-layout-${browserBack ? 'history' : 'link'}`, {
        body: JSON.stringify({ before: originalLayout, returned: await layout() }),
        contentType: 'application/json',
      });
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeCloseTo(departure.y, 0);
      await expect
        .poll(() => grid.evaluate((element) => element.scrollLeft))
        .toBeCloseTo(departure.x, 0);
    }
    await page.setViewportSize(originalViewport);
    await page.goto(`/admin/customers?q=${id}`);
    await page.locator(".customer-row").filter({ hasText: id }).click();
    await page.getByText("Redigera kunduppgifter", { exact: true }).click();
    await page.locator("#customer-name").fill(`${id} ändrad`);
    await page
      .getByRole("button", { name: "Spara kundkort", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Kundkortet är sparat",
    );
    await page.getByRole("link", { name: "Till kunder", exact: true }).click();
    await expect(page.locator("#customer-search")).toHaveValue(id);
    await expect(page.locator(".customer-row")).toContainText(`${id} ändrad`);
    await page.locator(".customer-row").click();
    await page.goBack();
    await expect(page.locator("#customer-search")).toHaveValue(id);
  } finally {
    await db.$disconnect();
  }
});

test("protects unsaved edits and saves nothing after reverting values or choosing Cancel", async ({
  page,
  synthetic,
}) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  await page.goto("/admin/services?id=massage");
  const name = page.locator("#service-name");
  const original = await name.inputValue();
  await name.fill("Ändring som inte sparas");
  const warning = page.waitForEvent("dialog").then(async (dialog) => {
    expect(dialog.message()).toContain("utan att spara");
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Kunder", exact: true }).click();
  await warning;
  await expect(name).toHaveValue("Ändring som inte sparas");
  await name.fill(original);
  const unexpected: string[] = [];
  page.on("dialog", async (dialog) => {
    unexpected.push(dialog.message());
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Kunder", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kunder", exact: true }),
  ).toBeVisible();
  expect(unexpected).toEqual([]);
  await page.goto("/admin/staff?id=staff-demo");
  const staff = page.locator("#staff-name");
  const staffName = await staff.inputValue();
  await staff.fill("Ändring avbruten");
  await page.getByRole("button", { name: "Avbryt", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/staff$/);
  await page.goto("/admin/staff?id=staff-demo");
  await expect(staff).toHaveValue(staffName);
  await staff.fill("Återställ detta");
  await staff.fill(staffName);
  await page.getByRole("link", { name: "Stäng", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/staff$/);
  expect(unexpected).toEqual([]);
  await page.goto("/admin/bookings/new");
  let future = DateTime.now().setZone("Europe/Stockholm").plus({ days: 16 });
  while (future.weekday > 5) future = future.plus({ days: 1 });
  await chooseDay(page, "booking-date", future.toISODate()!);
  await page.locator("#booking-name").fill("Avbruten demobokning");
  await page
    .getByRole("button", { name: "Avbryt bokning", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kalender", exact: true }),
  ).toBeVisible();
  const db = createDatabaseClient();
  try {
    expect(
      await db.booking.count({
        where: { customerName: "Avbruten demobokning" },
      }),
    ).toBe(0);
  } finally {
    await db.$disconnect();
  }
});

test("three primary actions and dismissible secondary menus work on mobile and desktop", async ({
  page,
  synthetic,
}) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/admin/overview");
    const primary = page.getByRole("navigation", {
      name: "Administration",
      exact: true,
    });
    await expect(primary.getByRole("link")).toHaveCount(3);
    await expect(
      primary.getByRole("link", { name: "Översikt", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const menu = page
      .locator(".workspace-menu")
      .filter({ has: page.locator("summary", { hasText: "Salongen" }) });
    await menu.locator("summary").click();
    await expect(
      menu.getByRole("link", { name: "Personal & tider", exact: true }),
    ).toBeVisible();
    const panel = await menu.locator(".workspace-menu-panel").boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    await menu.getByRole("link", { name: "Tjänster", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(menu).not.toHaveAttribute("open", "");
    await expect(menu.locator("summary")).toBeFocused();
    await menu.locator("summary").click();
    await page.locator(".workspace-brand p").click();
    await expect(menu).not.toHaveAttribute("open", "");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("summary").filter({ hasText: "Konto" }).click();
    const account = page
      .locator(".workspace-menu")
      .filter({ has: page.locator("summary", { hasText: "Konto" }) });
    await account
      .getByRole("button", { name: "Logga ut", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(account).not.toHaveAttribute("open", "");
    await account.locator("summary").click();
    await page
      .getByRole("link", { name: "Visa kundbokningen", exact: true })
      .click();
    await chooseDemoSalon(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
