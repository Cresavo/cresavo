import { test, expect } from "./fixtures";
import { DateTime } from "luxon";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { createBooking } from "../../src/lib/domain";

test("arbetsytans navigation och filter ryms på smal mobil och bred desktop", async ({
  page,
  synthetic,
}) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Kalender", exact: true }),
    ).toBeVisible();
    const controls = [
      page.getByRole("link", { name: "Ny bokning", exact: true }),
      page.getByRole("link", { name: "Kunder", exact: true }),
      page.locator(".calendar-date-choice > summary"),
      page.getByLabel("Medarbetare", { exact: true }),
    ];
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Översikt", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Översikt", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("korta kalenderbesök överlappar inte visuellt och har läsbar tangentbordsdetalj", async ({
  page,
  synthetic,
}) => {
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  const db = createDatabaseClient();
  const id = synthetic.marker;
  synthetic.trackResource("service", id);
  synthetic.trackResource("staff", id);
  const day = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 18 })
    .startOf("day");
  try {
    await db.service.create({
      data: {
        id,
        businessId: "demo",
        name: "Kort syntetiskt besök",
        duration: 5,
        priceOre: 10000,
      },
    });
    await db.staff.create({
      data: {
        id,
        businessId: "demo",
        name: "Syntetisk korttidspersonal",
        serviceIds: [id],
        weekly: Array.from({ length: 7 }, (_, i) => ({
          weekday: i + 1,
          periods: [
            { start: "09:00", end: "09:05" },
            { start: "09:05", end: "09:10" },
            { start: "09:30", end: "17:00" },
          ],
          breaks: [],
        })),
        exceptions: [],
      },
    });
    const bookings = [];
    for (const minute of [0, 5]) {
      bookings.push(
        await createBooking(
          {
            serviceId: id,
            staffId: id,
            customerName: "Korttid Demo",
            customerEmail: `${id}@example.test`,
            start: day.set({ hour: 9, minute }).toUTC().toISO()!,
          },
          undefined,
          undefined,
          { kind: "admin", id: synthetic.admin.id },
        ),
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/admin?date=${day.toISODate()}&staffId=${id}`);
    const cards = bookings.map((booking) =>
      page.locator(`.calendar-booking[href="/admin/bookings/${booking.id}"]`),
    );
    await expect(cards[0]).toHaveAccessibleName(
      /09:00–09:05.*Kort syntetiskt besök.*Korttid Demo/,
    );
    const boxes = await Promise.all(cards.map((card) => card.boundingBox()));
    expect(boxes[0]!.y + boxes[0]!.height).toBeLessThanOrEqual(boxes[1]!.y);
    await cards[0].focus();
    await expect(cards[0]).toBeFocused();
    const expanded = await cards[0].boundingBox();
    expect(expanded!.height).toBeGreaterThanOrEqual(82);
    await cards[0].press("Enter");
    await expect(
      page.getByRole("heading", { name: "Bokning", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Kort syntetiskt besök", { exact: true }),
    ).toBeVisible();
  } finally {
    await db.$disconnect();
  }
});
