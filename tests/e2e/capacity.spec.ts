import { test, expect } from "./fixtures";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { createBooking } from "../../src/lib/domain";
import { cancelBooking } from "../../src/lib/booking-mutations";
import { formatBookingTime } from "../../src/lib/format";

test("avbokning till kalender, beständigt avfärdande och korrekt kampanjutkast", async ({
  page,
  request,
  synthetic,
}) => {
  expect((await request.get("/api/admin/capacity")).status()).toBe(403);
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  synthetic.trackSession(login.headers()["set-cookie"] ?? "");
  await page.goto("/admin/overview");
  await expect(
    page.getByRole("heading", {
      name: "Inga avbokade tider att ta ställning till",
    }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/admin/capacity", {
        headers: { origin: "https://untrusted.example.test" },
        data: { action: "dismiss", input: {} },
      })
    ).status(),
  ).toBe(403);
  const db = createDatabaseClient(),
    serviceId = synthetic.marker,
    staffId = synthetic.marker;
  synthetic.trackResource("service", serviceId);
  synthetic.trackResource("staff", staffId);
  const actor = { kind: "admin" as const, id: synthetic.admin.id };
  const day = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 2 })
    .startOf("day");
  try {
    await db.service.create({
      data: {
        id: serviceId,
        businessId: "demo",
        name: synthetic.marker,
        duration: 30,
        priceOre: 45000,
      },
    });
    await db.staff.create({
      data: {
        id: staffId,
        businessId: "demo",
        name: "Syntetisk medarbetare",
        serviceIds: [serviceId],
        weekly: Array.from({ length: 7 }, (_, i) => ({
          weekday: i + 1,
          periods: [{ start: "09:00", end: "17:00" }],
          breaks: [],
        })),
        exceptions: [],
      },
    });
    async function booking(hour: number, cancelled: boolean) {
      const b = await createBooking(
        {
          serviceId,
          staffId,
          start: day.set({ hour }).toUTC().toISO()!,
          customerName: "Syntetisk ej visad kund",
          customerEmail: `${synthetic.marker}-${hour}@example.test`,
        },
        randomUUID(),
        undefined,
        actor,
      );
      if (cancelled) {
        const key = randomUUID();
        synthetic.trackWorkspaceRequest(key);
        await cancelBooking(
          { id: b.id, expectedVersion: b.version },
          key,
          actor,
        );
      }
      return b;
    }
    const source = await booking(9, true);
    await booking(10, true);
    await booking(11, true);
    await booking(11, false);
    await page.goto("/admin/overview");
    const card = page
      .locator(".capacity-card")
      .filter({ hasText: formatBookingTime(source.startsAt) });
    await expect(
      card.getByRole("heading", { name: synthetic.marker, exact: true }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      "Syntetisk ej visad kund",
    );
    await page.route("**/api/admin/capacity", (route) =>
      route.fulfill({ status: 503, json: { error: "Synthetic unavailable" } }),
    );
    await page
      .getByRole("button", { name: "Uppdatera förslagen", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Översikten kunde inte hämtas",
    );
    await expect(card).toBeVisible();
    await page.unroute("**/api/admin/capacity");
    await page
      .getByRole("button", { name: "Uppdatera förslagen", exact: true })
      .click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await card
      .getByRole("button", { name: "Öppna kalendern", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin\\?date=${day.toISODate()}&view=day&staffId=`),
    );
    await page.goto("/admin/overview");
    const second = page
      .locator(".capacity-card")
      .filter({ hasText: formatBookingTime(day.set({ hour: 10 }).toJSDate()) });
    await second
      .getByRole("button", { name: "Avfärda förslaget", exact: true })
      .click();
    await expect(second).toContainText("Avfärdat");
    await page.reload();
    await expect(second).toContainText("Avfärdat");
    await card.getByText("Förbered kampanjutkast", { exact: true }).click();
    await card.getByLabel("Rubrik", { exact: true }).fill(synthetic.title);
    await card.getByLabel("Rabatt i procent", { exact: true }).fill("15");
    await expect(card).toContainText("alla bokningsbara tider och utförare");
    await card
      .getByRole("button", { name: "Förhandsgranska utkast", exact: true })
      .click();
    await expect(
      card.getByRole("heading", { name: "Förhandsgranskning", exact: true }),
    ).toBeVisible();
    await card
      .getByRole("button", { name: "Spara kampanjutkast", exact: true })
      .click();
    await expect(
      card.getByRole("link", {
        name: "Granska sparat kampanjutkast",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(card).toContainText("Utkast sparat");
    const decision = await db.capacityDecision.findFirstOrThrow({
      where: { bookingId: source.id },
    });
    expect(
      await db.campaign.count({ where: { id: decision.campaignId! } }),
    ).toBe(1);
    expect(
      (
        await db.campaign.findUniqueOrThrow({
          where: { id: decision.campaignId! },
        })
      ).published,
    ).toBe(false);
    await booking(9, false);
    await page
      .getByRole("button", { name: "Uppdatera förslagen", exact: true })
      .click();
    await expect(card).toContainText("Inaktuellt underlag");
    await expect(card).toContainText(
      "Utkastet finns kvar, men tiden är inte längre bokningsbar",
    );
    await card
      .getByRole("link", { name: "Granska sparat kampanjutkast", exact: true })
      .click();
    await expect(
      page.locator(`#campaign-${decision.campaignId}`),
    ).toContainText("15 %");
  } finally {
    await db.$disconnect();
  }
});
