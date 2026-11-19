import { test, expect } from "./fixtures";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { createBooking } from "../../src/lib/domain";
import { cancelBooking } from "../../src/lib/booking-mutations";
import { formatBookingTime } from "../../src/lib/format";

test("cancellation updates the calendar, dismissals persist, and campaign drafts are correct", async ({
  page,
  request,
  synthetic,
}, testInfo) => {
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
        name: "Massage – sidprov",
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
    async function booking(
      hour: number,
      cancelled: boolean,
      at = day,
      minute = 0,
    ) {
      const b = await createBooking(
        {
          serviceId,
          staffId,
          start: at.set({ hour, minute }).toUTC().toISO()!,
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
    // Ten early rebooked cancellations must not hide the actionable eleventh.
    for (let i = 0; i < 10; i++) {
      const hour = 9 + Math.floor(i / 2),
        minute = (i % 2) * 30;
      await booking(hour, true, day.minus({ days: 1 }), minute);
      await booking(hour, false, day.minus({ days: 1 }), minute);
    }
    const source = await booking(9, true);
    await booking(10, true);
    await booking(11, true);
    await booking(11, false);
    await page.goto("/admin/overview");
    const card = page
      .locator(".capacity-card")
      .filter({ hasText: formatBookingTime(source.startsAt, "sv") });
    await expect(card).toHaveCount(0);
    if (process.env.PROACTIVE_CAPTURE === "1")
      await page.screenshot({
        path: testInfo.outputPath("capacity-page-1.png"),
        fullPage: false,
      });
    await page
      .getByRole("link", { name: "Nästa förslag", exact: true })
      .click();
    await expect(page).toHaveURL(/cursor=/);
    const overviewUrl = page.url();
    await expect(
      card.getByRole("heading", { name: "Massage – sidprov", exact: true }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      "Syntetisk ej visad kund",
    );
    await page.route(/\/api\/admin\/capacity(?:\?.*)?$/, (route) =>
      route.fulfill({ status: 503, json: { error: "Synthetic unavailable" } }),
    );
    await page
      .getByRole("button", { name: "Uppdatera förslagen", exact: true })
      .click();
    const overviewError = page
      .getByRole("region", { name: "Förslag från ledig kapacitet" })
      .getByRole("alert");
    await expect(overviewError).toContainText("Översikten kunde inte hämtas");
    await expect(card).toBeVisible();
    await page.unroute(/\/api\/admin\/capacity(?:\?.*)?$/);
    await page
      .getByRole("button", { name: "Uppdatera förslagen", exact: true })
      .click();
    await expect(overviewError).toHaveCount(0);
    const originalViewport = page.viewportSize();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
    if (process.env.PROACTIVE_CAPTURE === "1")
      await page.screenshot({
        path: testInfo.outputPath("capacity-page-2.png"),
        fullPage: false,
      });
    await card
      .getByRole("button", { name: "Öppna kalendern", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin\\?date=${day.toISODate()}&view=day&staffId=`),
    );
    await page.goto(overviewUrl);
    const second = page
      .locator(".capacity-card")
      .filter({ hasText: formatBookingTime(day.set({ hour: 10 }).toJSDate(), "sv") });
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
    await expect(
      page.locator(`#campaign-${decision.campaignId} h2`),
    ).toBeFocused();
    await expect(
      page.locator(`#campaign-${decision.campaignId} h2`),
    ).toBeInViewport();
    await page
      .getByRole("link", { name: "Till översikten", exact: true })
      .click();
    await expect
      .poll(() => new URL(page.url()).pathname + new URL(page.url()).search)
      .toBe(new URL(overviewUrl).pathname + new URL(overviewUrl).search);
    const invalid = await page.goto("/admin/overview?cursor=foreign-source");
    expect(invalid?.status()).toBe(200);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Ogiltigt sidval. Visar första sidan.",
    );
  } finally {
    await db.$disconnect();
  }
});
