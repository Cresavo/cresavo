import { chooseDemoSalon } from "./booking-entry";
import { chooseDay, chooseSlot } from "./date-controls";
import { test, expect } from "./fixtures";
import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { socketClient } from "./http-client";

test("manuella adminbokningar har egen budget och kan inte kringgå kundskyddet", async ({
  page,
  synthetic,
}, testInfo) => {
  const address =
    testInfo.project.name === "desktop" ? "127.87.0.11" : "127.87.0.12";
  const http = socketClient(address);
  const origin = { origin: "http://localhost:3000" };
  const authenticated = await http.post("/api/admin/login", {
    headers: origin,
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(authenticated.status()).toBe(200);
  const rawCookie = String(authenticated.headers()["set-cookie"]);
  synthetic.trackSession(rawCookie);
  const cookie = rawCookie.split(";")[0];
  let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 28 });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const response = await page.request.get(
    `/api/availability?serviceId=massage&date=${day.toISODate()}`,
  );
  const slots: string[] = await response.json();
  expect(slots.length).toBeGreaterThanOrEqual(13);
  const payload = (
    index: number,
    email = `${synthetic.marker}@example.test`,
  ) => ({
    serviceId: "massage",
    start: slots[index],
    customerName: "Syntetisk telefonkund",
    customerEmail: email,
  });
  const adminPost = async (index: number) => {
    const key = randomUUID();
    synthetic.trackWorkspaceRequest(key);
    const data = { action: "create", ...payload(index) };
    const headers = { ...origin, cookie, "Idempotency-Key": key };
    return {
      result: await http.post("/api/admin/bookings", { headers, data }),
      headers,
      data,
    };
  };
  for (let i = 0; i < 7; i++)
    expect((await adminPost(i)).result.status()).toBe(201);
  const publicPost = (index: number, email?: string) =>
    http.post("/api/bookings", {
      headers: { ...origin, "Idempotency-Key": randomUUID() },
      data: payload(index, email),
    });
  for (let i = 7; i < 10; i++) expect((await publicPost(i)).status()).toBe(201);
  expect((await publicPost(10)).status()).toBe(429); // Still three per e-mail.
  for (let i = 10; i < 12; i++)
    expect(
      (await publicPost(i, `${synthetic.marker}-${i}@example.test`)).status(),
    ).toBe(201);
  const denied = await http.post("/api/bookings", {
    headers: { ...origin, cookie, "Idempotency-Key": randomUUID() },
    data: {
      ...payload(12, `${synthetic.marker}-sixth@example.test`),
      actor: { kind: "admin", id: synthetic.admin.id },
    },
  });
  expect(denied.status()).toBe(429); // A cookie/payload never promotes the public route.
  const accepted = await adminPost(12);
  expect(accepted.result.status()).toBe(201);
  const original = await accepted.result.json();
  const retries = await Promise.all(
    Array.from({ length: 20 }, () =>
      http.post("/api/admin/bookings", {
        headers: accepted.headers,
        data: accepted.data,
      }),
    ),
  );
  for (const retry of retries) {
    expect(retry.status()).toBe(201);
    expect((await retry.json()).id).toBe(original.id);
  }
});

test("HTTP och lokal MCP delar flytt/avbokning vid blandad samtidig trafik", async ({
  page,
  synthetic,
}) => {
  const client = new Client({
    name: "synthetic-workspace-http-race",
    version: "1",
  });
  const db = createDatabaseClient();
  const origin = { origin: "http://localhost:3000" };
  let day = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 7 })
    .startOf("day");
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const date = day.toISODate()!,
    time = (hour: number) => day.set({ hour }).toUTC().toISO()!;
  try {
    const login = await page.request.post("/api/admin/login", {
      headers: origin,
      data: {
        email: synthetic.admin.email,
        password: synthetic.admin.password,
      },
    });
    expect(login.status()).toBe(200);
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "--import",
          "tsx",
          "src/mcp/server.ts",
          "--admin",
          "--allow-workspace",
        ],
        env: mcpEnvironment({ workspace: true }),
      }),
    );
    const bookings: { id: string }[] = [];
    for (const staffId of ["staff-demo", "staff-erik"]) {
      const key = randomUUID();
      synthetic.trackWorkspaceRequest(key);
      const response = await page.request.post("/api/admin/bookings", {
        headers: { ...origin, "Idempotency-Key": key },
        data: {
          action: "create",
          serviceId: "massage",
          staffId,
          start: time(11),
          customerName: "Syntetisk kanalkund",
          customerEmail: `${synthetic.marker}-${staffId}@example.test`,
        },
      });
      expect(response.status()).toBe(201);
      bookings.push(await response.json());
    }
    const moved = await Promise.all(
      Array.from({ length: 20 }, async (_, index) => {
        const key = randomUUID(),
          viaMcp = index % 3 !== 0;
        synthetic.trackWorkspaceRequest(key, viaMcp ? "mcp" : "admin");
        const input = {
          id: bookings[index % 2].id,
          expectedVersion: 1,
          staffId: "staff-demo",
          start: time(13),
        };
        if (viaMcp) {
          const response = await client.callTool({
            name: "move_booking",
            arguments: { ...input, clientRequestId: key, confirmed: true },
          });
          if (response.isError)
            expect(response.content).toEqual([
              {
                type: "text",
                text: expect.stringMatching(
                  /^(Uppgifterna har ändrats\. Läs in på nytt\.|Tiden är inte tillgänglig)$/,
                ),
              },
            ]);
          return !response.isError;
        }
        const response = await page.request.post("/api/admin/bookings", {
          headers: { ...origin, "Idempotency-Key": key },
          data: { action: "move", ...input },
        });
        expect([200, 400, 409]).toContain(response.status());
        return response.status() === 200;
      }),
    );
    expect(moved.filter(Boolean)).toHaveLength(1);
    const winner = await db.booking.findFirstOrThrow({
      where: { id: { in: bookings.map((b) => b.id) }, version: 2 },
    });
    const cancellation = { id: winner.id, expectedVersion: 2 },
      httpKey = randomUUID(),
      mcpKey = randomUUID();
    synthetic.trackWorkspaceRequest(httpKey);
    synthetic.trackWorkspaceRequest(mcpKey, "mcp");
    const [httpCancel, mcpCancel] = await Promise.all([
      page.request.post("/api/admin/bookings", {
        headers: { ...origin, "Idempotency-Key": httpKey },
        data: { action: "cancel", ...cancellation },
      }),
      client.callTool({
        name: "cancel_booking",
        arguments: {
          ...cancellation,
          clientRequestId: mcpKey,
          confirmed: true,
        },
      }),
    ]);
    expect([200, 409]).toContain(httpCancel.status());
    if (httpCancel.status() === 409)
      expect(await httpCancel.json()).toEqual({
        error: "Uppgifterna har ändrats. Läs in på nytt.",
      });
    if (mcpCancel.isError)
      expect(mcpCancel.content).toEqual([
        { type: "text", text: "Uppgifterna har ändrats. Läs in på nytt." },
      ]);
    expect(
      Number(httpCancel.status() === 200) + Number(!mcpCancel.isError),
    ).toBe(1);
    const details = await client.callTool({
      name: "get_booking",
      arguments: { id: winner.id },
    });
    expect(details.isError).not.toBeTruthy();
    expect(JSON.stringify(details)).not.toMatch(
      /Syntetisk kanalkund|customerName|customerEmail|@example.test/,
    );
    const current = await db.booking.findUniqueOrThrow({
      where: { id: winner.id },
      include: { events: true },
    });
    expect(current).toMatchObject({ status: "cancelled", version: 3 });
    expect(current.events.map((event) => event.action).sort()).toEqual([
      "cancel",
      "create",
      "move",
    ]);
    const overlap = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM "Booking" a JOIN "Booking" b ON a.id < b.id AND a."businessId"=b."businessId" AND a."staffId"=b."staffId" AND a.status='confirmed' AND b.status='confirmed' AND tstzrange(a."startsAt",a."endsAt",'[)') && tstzrange(b."startsAt",b."endsAt",'[)')`;
    expect(Number(overlap[0].count)).toBe(0);
    await page.goto(`/admin/bookings/${winner.id}`);
    await expect(page.locator(".booking-summary")).toContainText("Avbokad");
    await expect(page.locator(".booking-summary")).toContainText(
      `${DateTime.fromISO(date, { zone: "Europe/Stockholm" }).setLocale("sv").toFormat("cccc d MMMM yyyy")} kl. 13:00`,
    );
  } finally {
    await client.close();
    await db.$disconnect();
  }
});

test("manuell bokning bevarar utkast och request-id vid nätverksfel", async ({
  page,
  synthetic,
}) => {
  let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 25 });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const login = await page.request.post("/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(login.status()).toBe(200);
  await page.goto(`/admin/bookings/new?date=${day.toISODate()}`);
  await page.locator("#booking-service").selectOption("massage");
  await page.locator("#booking-staff").selectOption("staff-demo");
  await expect(page.locator("#booking-slot")).toBeAttached();
  await page.route("**/api/availability?*", (route) => route.abort("failed"), {
    times: 1,
  });
  await page.getByRole("button", { name: "Uppdatera lediga tider" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Tiderna kunde inte hämtas",
  );
  await page.getByRole("button", { name: "Uppdatera lediga tider" }).click();
  await chooseSlot(page, "booking-slot");
  await page.locator("#booking-name").fill("Syntetisk manuell kund");
  await page.locator("#booking-email").fill(`${synthetic.marker}@example.test`);
  let warned = false;
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Lämna sidan utan att spara ändringarna?");
    warned = true;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Till kalendern" }).first().click();
  expect(warned).toBe(true);
  await expect(page.locator("#booking-name")).toHaveValue(
    "Syntetisk manuell kund",
  );
  const keys: string[] = [],
    ids: string[] = [];
  await page.route("**/api/admin/bookings", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    synthetic.trackWorkspaceRequest(keys.at(-1)!);
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    ids.push((await response.json()).id);
    if (ids.length === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Skapa bokning", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Svaret kunde inte hämtas",
  );
  await expect(page.locator("#booking-name")).toHaveValue(
    "Syntetisk manuell kund",
  );
  await page
    .getByRole("button", { name: "Skapa bokning", exact: true })
    .click();
  await expect(page.locator(".booking-summary")).toContainText(
    "Syntetisk manuell kund",
  );
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(1);
  expect(new Set(ids).size).toBe(1);
  const db = createDatabaseClient();
  try {
    expect(
      await db.booking.count({
        where: { customerEmail: `${synthetic.marker}@example.test` },
      }),
    ).toBe(1);
  } finally {
    await db.$disconnect();
  }
});

test("arbetsytans API nekar obehörig åtkomst, främmande origin och för bred läsning", async ({
  request,
  synthetic,
}) => {
  const origin = { origin: "http://localhost:3000" };
  for (const path of [
    "/api/admin/bookings",
    "/api/admin/services",
    "/api/admin/staff",
    "/api/admin/bookings/unknown",
    "/api/admin/bookings/unknown/availability?date=2026-11-16&staffId=staff-demo",
  ])
    expect((await request.get(path)).status()).toBe(403);
  for (const path of [
    "/api/admin/bookings",
    "/api/admin/services",
    "/api/admin/staff",
  ])
    expect(
      (await request.post(path, { headers: origin, data: {} })).status(),
    ).toBe(403);
  const logged = await request.post("/api/admin/login", {
    headers: origin,
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(logged.status()).toBe(200);
  synthetic.trackSession(logged.headers()["set-cookie"] ?? "");
  for (const path of [
    "/api/admin/bookings",
    "/api/admin/services",
    "/api/admin/staff",
  ])
    expect(
      (
        await request.post(path, {
          headers: {
            origin: "http://foreign.test",
            "Idempotency-Key": randomUUID(),
          },
          data: {},
        })
      ).status(),
    ).toBe(403);
  for (const query of [
    "from=2026-11-16&to=2026-11-15",
    "from=2026-11-16&to=2027-02-16",
    "from=2026-11-16&to=2026-11-16&limit=101",
    "from=invalid&to=2026-11-16",
  ])
    expect((await request.get(`/api/admin/bookings?${query}`)).status()).toBe(
      400,
    );
  expect((await request.get("/api/admin/bookings/unknown")).status()).toBe(400);
  const denied = await request.post("/api/admin/bookings", {
    headers: { ...origin, "Idempotency-Key": randomUUID() },
    data: {
      action: "cancel",
      id: "unknown",
      expectedVersion: 1,
      businessId: "other",
      actor: "admin",
    },
  });
  expect(denied.status()).toBe(400);
  expect(await denied.text()).not.toMatch(
    /stack|Prisma|customerEmail|password/,
  );
});

test("Epic05 salongsarbetsyta: boka, ändra tjänst/schema, flytta och avboka", async ({
  page,
  synthetic,
}, testInfo) => {
  const db = createDatabaseClient();
  const day = DateTime.now()
    .setZone("Europe/Stockholm")
    .startOf("day")
    .plus({ days: 4 });
  const date = day.toISODate()!,
    nextDay = day.plus({ days: 1 }).toISODate()!,
    moveDay = day.plus({ days: 2 }).toISODate()!;
  const title = process.env.BOOKING_DEMO
      ? "Fotvård Demo"
      : `Fotvård ${synthetic.marker.slice(-8)}`,
    newTitle = process.env.BOOKING_DEMO
      ? "Fotvård Plus Demo"
      : `Fotvård Plus ${synthetic.marker.slice(-8)}`;
  async function capture(name: string) {
    if (!process.env.BOOKING_DEMO) return;
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
      caret: "initial",
    });
    await page.waitForTimeout(1000); // Recording only; never used to synchronise assertions.
  }
  async function post(url: string, data: unknown) {
    const key = randomUUID();
    synthetic.trackWorkspaceRequest(key);
    return page.request.post(url, {
      headers: { origin: "http://localhost:3000", "Idempotency-Key": key },
      data,
    });
  }
  try {
    const logged = await page.request.post("/api/admin/login", {
      headers: { origin: "http://localhost:3000" },
      data: {
        email: synthetic.admin.email,
        password: synthetic.admin.password,
      },
    });
    expect(logged.status()).toBe(200);
    const serviceResponse = await post("/api/admin/services", {
      name: title,
      priceOre: 50000,
      duration: 30,
      buffer: 0,
      active: true,
    });
    expect(serviceResponse.status()).toBe(200);
    const service = await serviceResponse.json();
    synthetic.trackResource("service", service.id);
    const people = [];
    for (const [name, start, end] of [
      ["Demo Anna", "09:00", "17:00"],
      ["Demo Erik", "10:00", "16:00"],
    ]) {
      const created = await post("/api/admin/staff", {
        name,
        active: true,
        serviceIds: [service.id],
        weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          periods: [{ start, end }],
          breaks: [],
        })),
        exceptions: [],
      });
      expect(created.status()).toBe(200);
      const person = await created.json();
      synthetic.trackResource("staff", person.id);
      people.push(person);
    }
    await page.goto("/");
    await chooseDemoSalon(page);
    await expect(page.getByTestId("track-customer").getByLabel("Behandling", { exact: true })).toBeEnabled();
    await page.getByTestId("track-customer").getByLabel("Behandling", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("track-customer").getByLabel("Medarbetare", { exact: true })).toBeFocused();
    expect(
      await page.getByTestId("track-customer").getByLabel("Medarbetare", { exact: true }).evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0
        );
      }),
    ).toBe(true);
    await page.getByTestId("track-customer").getByLabel("Behandling", { exact: true }).selectOption(service.id);
    await page.getByTestId("track-customer").getByLabel("Medarbetare", { exact: true }).selectOption(people[0].id);
    await chooseDay(page, "date", date);
    await chooseSlot(page, "slot");
    await page.getByTestId("track-customer").getByLabel("Namn (påhittat)", { exact: true }).fill("Syntetisk kalenderkund");
    await page.getByTestId("track-customer").getByLabel("E-post (påhittad)", { exact: true }).fill(`${synthetic.marker}@example.test`);
    await page
      .getByRole("button", { name: "Bekräfta testbokning" })
      .press("Enter");
    await expect(
      page.getByText("Din testbokning är registrerad.", { exact: false }),
    ).toBeVisible();
    const booking = await db.booking.findFirstOrThrow({
      where: { customerEmail: `${synthetic.marker}@example.test` },
    });
    await page.goto(`/admin?date=${date}&view=week&staffId=${people[0].id}`);
    const visibleBooking = page
      .locator(".calendar-booking:visible,.mobile-booking:visible")
      .filter({ hasText: "Syntetisk kalenderkund" });
    await expect(visibleBooking).toBeVisible();
    if (testInfo.project.name === "desktop")
      await expect(
        page.getByRole("region", { name: "Veckokalender" }),
      ).toBeVisible();
    else
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("epic05-calendar.png"),
      fullPage: true,
      caret: "initial",
    });
    await visibleBooking.click();
    await expect(page.locator(".booking-summary")).toContainText(title);
    await expect(page.locator(".booking-summary")).toContainText("500,00");
    await capture("09-bokningsdetalj");

    await page.goto(`/admin/services?id=${service.id}`);
    await page.locator("#service-name").fill(newTitle);
    await page.locator("#service-price").fill("725,50");
    await page.locator("#service-duration").fill("45");
    await page.locator("#service-buffer").fill("15");
    await page.getByRole("button", { name: "Spara behandling" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Behandlingen är sparad",
    );
    await expect(page.locator("#service-duration")).toHaveValue("45");
    await capture("10-tjanst-andrad");
    await page.goto(`/admin/bookings/${booking.id}`);
    await expect(page.locator(".booking-summary")).toContainText(title);
    await expect(page.locator(".booking-summary")).toContainText("30 min");
    await expect(page.locator(".booking-summary")).toContainText("500,00");

    await page.goto(`/admin/staff?id=${people[0].id}`);
    const weekName = day.setLocale("sv").toFormat("cccc");
    const weekday = page.locator("details.schedule-day").filter({
      has: page
        .locator("summary")
        .filter({ hasText: new RegExp(weekName, "i") }),
    });
    await weekday.locator("summary").click();
    await weekday
      .getByRole("button", { name: "Lägg till paus", exact: true })
      .click();
    await page.getByRole("button", { name: "Spara medarbetare" }).click();
    await expect(page.getByRole("status")).toContainText("tiderna är sparade");
    if (process.env.BOOKING_DEMO) {
      if (
        !(await weekday.evaluate(
          (element) => (element as HTMLDetailsElement).open,
        ))
      )
        await weekday.locator("summary").click();
      await capture("11-veckoschema-med-paus");
    }
    const afterPause = await page.request.get(
      `/api/availability?serviceId=${service.id}&staffId=${people[0].id}&date=${date}`,
    );
    const slots = await afterPause.json();
    expect(
      slots.map((s: string) =>
        DateTime.fromISO(s).setZone("Europe/Stockholm").toFormat("HH:mm"),
      ),
    ).not.toContain("12:00");
    await page.goto(`/admin/staff?id=${people[1].id}`);
    await chooseDay(page, "new-exception-date", nextDay);
    await page
      .getByRole("button", { name: "Lägg till datum", exact: true })
      .click();
    await page.getByRole("button", { name: "Spara medarbetare" }).click();
    await expect(page.getByRole("status")).toContainText("tiderna är sparade");
    const holiday = await page.request.get(
      `/api/availability?serviceId=${service.id}&staffId=${people[1].id}&date=${nextDay}`,
    );
    expect(await holiday.json()).toEqual([]);
    await capture("12-ledigt-datum");

    const occupiedStart = day
      .plus({ days: 2 })
      .set({ hour: 11 })
      .toUTC()
      .toISO()!;
    const blocker = await post("/api/admin/bookings", {
      action: "create",
      serviceId: service.id,
      serviceVersion: 2,
      staffId: people[1].id,
      start: occupiedStart,
      customerName: "Syntetisk upptagen tid",
      customerEmail: `${synthetic.marker}-blocker@example.test`,
    });
    expect(blocker.status()).toBe(201);
    const denied = await post("/api/admin/bookings", {
      action: "move",
      id: booking.id,
      expectedVersion: 1,
      staffId: people[1].id,
      start: occupiedStart,
    });
    expect(denied.status()).toBe(400);
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .startsAt,
    ).toEqual(booking.startsAt);
    await page.goto(`/admin/bookings/${booking.id}`);
    await page.getByRole("button", { name: "Flytta", exact: true }).click();
    await page.locator("#booking-staff").selectOption(people[1].id);
    await chooseDay(page, "booking-date", moveDay);
    await page.getByRole("button", { name: "Uppdatera lediga tider" }).click();
    const moveSlot = day.plus({ days: 2 }).set({ hour: 10 }).toUTC().toISO()!;
    await chooseSlot(page, "booking-slot", moveSlot);
    await page
      .getByRole("button", { name: "Spara flytt", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("har flyttats");
    await expect(page.locator(".booking-summary")).toContainText("Demo Erik");
    await expect(page.locator(".booking-summary")).toContainText("10:00");
    await capture("13-flyttad-bokning");
    const moved = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(moved.version).toBe(2);
    expect(moved.endsAt.getTime() - moved.startsAt.getTime()).toBe(30 * 60000);
    await page.getByRole("button", { name: "Avboka", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Avboka bokningen?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Behåll bokningen" }).click();
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .status,
    ).toBe("confirmed");
    await page.getByRole("button", { name: "Avboka", exact: true }).click();
    await page.getByRole("button", { name: "Ja, avboka", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("är avbokad");
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .status,
    ).toBe("cancelled");
    const freed = await page.request.get(
      `/api/availability?serviceId=${service.id}&staffId=${people[1].id}&date=${moveDay}`,
    );
    expect(await freed.json()).toContain(moveSlot);
    await page.locator("summary").filter({ hasText: "Historik" }).click();
    await expect(page.locator(".event-list")).toContainText("Flyttad");
    await expect(page.locator(".event-list")).toContainText("Avbokad");
    await page.screenshot({
      path: testInfo.outputPath("epic05-cancelled-booking.png"),
      fullPage: true,
      caret: "initial",
    });
  } finally {
    await db.$disconnect();
  }
});
