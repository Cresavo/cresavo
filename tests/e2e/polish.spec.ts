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
    const help = await page.locator(".calendar-guidance summary").boundingBox();
    expect(help!.height).toBeGreaterThanOrEqual(44);
    const checkbox = await page
      .getByLabel("Visa avbokade", { exact: true })
      .boundingBox();
    expect(checkbox!.width).toBeGreaterThanOrEqual(24);
    expect(checkbox!.height).toBeGreaterThanOrEqual(24);
    if (width < 768)
      expect(
        await page
          .getByLabel("Medarbetare", { exact: true })
          .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Översikt", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Översikt", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Kunder", exact: true }).click();
    const archived = page.getByLabel("Visa även arkiverade", { exact: true });
    await expect(archived).toBeVisible();
    expect((await archived.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    expect(
      await archived.evaluate(
        (e) => e.closest("label")!.getBoundingClientRect().height,
      ),
    ).toBeGreaterThanOrEqual(44);
    if (width < 768)
      expect(
        await page
          .getByRole("searchbox")
          .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      ).toBeGreaterThanOrEqual(16);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("korta kalenderbesök har riktiga tryckytor och hover kan inte stjäla nästa boknings klick", async ({
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
    const longId = `${id}-long`;
    synthetic.trackResource("service", longId);
    await db.service.create({
      data: {
        id: longId,
        businessId: "demo",
        name: "Långt syntetiskt besök",
        duration: 30,
        priceOre: 45000,
      },
    });
    await db.staff.create({
      data: {
        id,
        businessId: "demo",
        name: "Syntetisk korttidspersonal",
        serviceIds: [id, longId],
        weekly: Array.from({ length: 7 }, (_, i) => ({
          weekday: i + 1,
          periods: [
            { start: "09:00", end: "09:05" },
            { start: "09:05", end: "09:10" },
            { start: "09:10", end: "09:15" },
            { start: "09:15", end: "17:00" },
          ],
          breaks: [],
        })),
        exceptions: [],
      },
    });
    // Seeded Anna/Erik plus BA place the selected staff at the brown tone3.
    for (const [suffix, name] of [["a", "BA Palette Demo"]]) {
      const staffId = `${id}-${suffix}`;
      synthetic.trackResource("staff", staffId);
      await db.staff.create({
        data: {
          id: staffId,
          businessId: "demo",
          name,
          serviceIds: [id],
          weekly: [],
          exceptions: [],
        },
      });
    }
    const bookings = [];
    for (const minute of [0, 5, 10, 15, 45]) {
      bookings.push(
        await createBooking(
          {
            serviceId: minute >= 15 ? longId : id,
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
    const url = `/admin?date=${day.toISODate()}&staffId=${id}`;
    for (const width of [1180, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url);
      const cards = bookings.map((booking) =>
        page.locator(`.calendar-booking[href="/admin/bookings/${booking.id}"]`),
      );
      await expect(cards[0]).toHaveAccessibleName(
        /09:00–09:05.*Kort syntetiskt besök.*Korttid Demo.*Syntetisk korttidspersonal/,
      );
      await expect(cards[3]).toHaveAttribute("data-tone", "3");
      const contrast = await cards[3]
        .locator("span")
        .last()
        .evaluate((label) => {
          const style = getComputedStyle(label);
          const rgb = (v: string) =>
            v
              .match(/[0-9.]+/g)!
              .slice(0, 3)
              .map(Number);
          const background = rgb(
            getComputedStyle(label.parentElement!).backgroundColor,
          );
          const foreground = rgb(style.color).map(
            (c, i) =>
              c * Number(style.opacity) +
              background[i] * (1 - Number(style.opacity)),
          );
          const luminance = (colors: number[]) =>
            colors
              .map((c) => c / 255)
              .map((c) =>
                c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
              )
              .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
          const a = luminance(foreground),
            b = luminance(background);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      const boxes = await Promise.all(cards.map((card) => card.boundingBox()));
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i]!;
        expect(a.height).toBeGreaterThanOrEqual(24);
        expect(a.width).toBeGreaterThanOrEqual(24);
        for (const value of boxes.slice(i + 1)) {
          const b = value!;
          expect(
            a.x < b.x + b.width &&
              b.x < a.x + a.width &&
              a.y < b.y + b.height &&
              b.y < a.y + a.height,
          ).toBe(false);
        }
      }
      await cards[0].focus();
      await expect(cards[0]).toBeFocused();
      expect(await cards[0].boundingBox()).toEqual(boxes[0]);
      await cards[0].press("Enter");
      await expect(page).toHaveURL(
        new RegExp(`/admin/bookings/${bookings[0].id}`),
      );
      await expect(
        page.getByRole("heading", { name: "Bokning", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Kort syntetiskt besök", { exact: true }),
      ).toBeVisible();
      // Start the independent pointer probe on a fully rendered calendar again.
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: "Kalender", exact: true }),
      ).toBeVisible();
      await expect(cards[1]).toBeVisible();
      const pointerBoxes = await Promise.all(
        cards.map((card) => card.boundingBox()),
      );
      await cards[0].hover();
      expect(await cards[0].boundingBox()).toEqual(pointerBoxes[0]);
      // The original centre of the SECOND visit must still hit that visit.
      const second = pointerBoxes[1]!;
      await page.mouse.click(
        second.x + second.width / 2,
        second.y + second.height / 2,
      );
      await expect(page).toHaveURL(
        new RegExp(`/admin/bookings/${bookings[1].id}`),
      );
    }
  } finally {
    await db.$disconnect();
  }
});
