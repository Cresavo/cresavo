import { chooseDemoSalon } from "./booking-entry";
import { chooseDay, chooseSlot } from "./date-controls";
import { mcpEnvironment } from "../../src/mcp/environment";
import { test, expect } from "./fixtures";
import { socketClient } from "./http-client";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { LOGIN_FAILURE_DELAY_MS } from "../../src/lib/rate-limit";
import {
  createAdminUser,
  disableAdminUser,
  resetAdminPassword,
} from "../../src/lib/admin-accounts";
const db = createDatabaseClient();

test("separata administratörer, återkallelse och ingen delad lösenordsfallback", async ({
  request,
  synthetic,
}, testInfo) => {
  const otherEmail = `${synthetic.marker}-second@example.test`;
  const password = "synthetic-second-admin-password-2026";
  const nextPassword = "synthetic-reset-admin-password-2026";
  const other = await createAdminUser(otherEmail, password);
  const origin = { origin: "http://localhost:3000" };
  try {
    const a = await request.post("/api/admin/login", {
      headers: origin,
      data: {
        email: synthetic.admin.email,
        password: synthetic.admin.password,
      },
    });
    expect(a.status()).toBe(200);
    const cookieA = a.headers()["set-cookie"].split(";")[0];
    const b = await request.post("/api/admin/login", {
      headers: origin,
      data: { email: otherEmail, password },
    });
    expect(b.status()).toBe(200);
    const cookieB = b.headers()["set-cookie"].split(";")[0];
    const ownPage = await request.get("/admin", {
      headers: { cookie: cookieA, "accept-language": "sv-SE" },
    });
    expect(await ownPage.text()).toContain(`Inloggad som`);
    expect(await ownPage.text()).toContain(synthetic.admin.email);
    await disableAdminUser(synthetic.admin.email);
    expect(
      (
        await request.post("/api/admin/publish", {
          headers: { ...origin, cookie: cookieA },
          data: { id: "not-existing" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.post("/api/admin/publish", {
          headers: { ...origin, cookie: cookieB },
          data: { id: "not-existing" },
        })
      ).status(),
    ).toBe(400);
    await resetAdminPassword(otherEmail, nextPassword);
    expect(
      (
        await request.post("/api/admin/publish", {
          headers: { ...origin, cookie: cookieB },
          data: { id: "not-existing" },
        })
      ).status(),
    ).toBe(403);
    const negatives = socketClient(
      testInfo.project.name === "desktop" ? "127.0.0.43" : "127.0.0.44",
    );
    for (const data of [
      { email: otherEmail, password },
      { password: "synthetic-legacy-password-not-used" },
    ]) {
      const denied = await negatives.post("/api/admin/login", {
        headers: origin,
        data,
      });
      expect(denied.status()).toBe(401);
      expect(await denied.json()).toEqual({
        error: "Fel inloggningsuppgifter",
      });
    }
    const refreshed = await request.post("/api/admin/login", {
      headers: origin,
      data: { email: otherEmail, password: nextPassword },
    });
    expect(refreshed.status()).toBe(200);
  } finally {
    await db.adminSession.deleteMany({ where: { userId: other.id } });
    await db.adminUser.delete({ where: { id: other.id } });
    await db.$disconnect();
  }
});

function bookingTransport() {
  return new StdioClientTransport({
    command: process.execPath,
    env: mcpEnvironment({ booking: true }),
    args: [
      "--env-file-if-exists=.env",
      "--import",
      "tsx",
      "src/mcp/server.ts",
      "--admin",
      "--allow-bookings",
    ],
  });
}
test("lokal MCP-bokning visas i skyddad admin med Stockholmstid", async ({
  page,
  synthetic,
}, testInfo) => {
  const client = new Client({ name: "synthetic-mcp-admin-flow", version: "1" });
  try {
    await client.connect(bookingTransport());
    let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 2 });
    while (day.weekday > 5) day = day.plus({ days: 1 });
    const available = await client.callTool({
      name: "get_availability",
      arguments: { serviceId: "fotvard", date: day.toISODate() },
    });
    expect(available.isError).not.toBeTruthy();
    const block = available.content[0];
    if (block.type !== "text") throw new Error("Expected text");
    const start = (JSON.parse(block.text) as string[])[0];
    const email = `${synthetic.marker}-mcp@example.test`;
    const name = process.env.BOOKING_DEMO
      ? `Syntetisk agentkund ${testInfo.project.name === "desktop" ? "Anna" : "Erik"}`
      : `Syntetisk MCP ${synthetic.marker}`;
    const created = await client.callTool({
      name: "create_booking",
      arguments: {
        serviceId: "fotvard",
        start,
        customerName: name,
        customerEmail: email,
        clientRequestId: synthetic.marker,
        confirmed: true,
      },
    });
    expect(created.isError).not.toBeTruthy();
    expect(JSON.stringify(created)).not.toContain(email);
    expect(JSON.stringify(created)).not.toContain(name);
    await page.goto("/admin");
    await expect(page.locator("#password")).toBeVisible();
    // UI login is covered by the existing full flow; this test focuses on MCP → admin.
    const login = await page.request.post("/api/admin/login", {
      headers: { origin: "http://localhost:3000" },
      data: {
        email: synthetic.admin.email,
        password: synthetic.admin.password,
      },
    });
    expect(login.status()).toBe(200);
    synthetic.trackSession(login.headers()["set-cookie"] ?? "");
    await page.goto(`/admin?date=${day.toISODate()}`);
    const visibleBooking = page
      .locator(".calendar-booking:visible,.mobile-booking:visible")
      .filter({ hasText: name });
    await expect(visibleBooking).toBeVisible();
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
    await expect(visibleBooking).toContainText(
      DateTime.fromISO(start).setZone("Europe/Stockholm").toFormat("HH:mm"),
    );
    await visibleBooking.click();
    await expect(
      page.getByText(
        DateTime.fromISO(start)
          .setZone("Europe/Stockholm")
          .setLocale("sv")
          .toFormat("cccc d MMMM yyyy 'kl.' HH:mm"),
        { exact: false },
      ),
    ).toBeVisible();
    if (process.env.BOOKING_DEMO) {
      await page.screenshot({
        path: testInfo.outputPath("07-agentbokning-i-admin.png"),
        fullPage: true,
        caret: "initial",
      });
      await page.waitForTimeout(1200);
    }
  } finally {
    await client.close();
    await db.$disconnect();
  }
});
test("HTTP och MCP delar idempotens och stoppar 20 blandade överlapp", async ({
  request,
  synthetic,
}) => {
  const client = new Client({ name: "synthetic-cross-channel", version: "1" });
  try {
    await client.connect(bookingTransport());
    let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 12 });
    while (day.weekday > 5) day = day.plus({ days: 1 });
    async function slots() {
      const result = await client.callTool({
        name: "get_availability",
        arguments: { serviceId: "massage", date: day.toISODate() },
      });
      expect(result.isError).not.toBeTruthy();
      const block = result.content[0];
      if (block.type !== "text") throw new Error("Expected text");
      return JSON.parse(block.text) as string[];
    }
    const payload = {
      serviceId: "massage",
      start: (await slots())[0],
      customerName: "Syntetisk kanaltest",
      customerEmail: `${synthetic.marker}-shared@example.test`,
    };
    const created = await client.callTool({
      name: "create_booking",
      arguments: {
        ...payload,
        clientRequestId: synthetic.marker,
        confirmed: true,
      },
    });
    expect(created.isError).not.toBeTruthy();
    const block = created.content[0];
    if (block.type !== "text") throw new Error("Expected text");
    const id = (JSON.parse(block.text) as { id: string }).id;
    const headers = {
      origin: "http://localhost:3000",
      "Idempotency-Key": synthetic.marker,
    };
    const replay = await request.post("/api/bookings", {
      headers,
      data: payload,
    });
    expect(replay.status()).toBe(201);
    expect(await replay.json()).toEqual({ id });
    const mismatch = await request.post("/api/bookings", {
      headers,
      data: { ...payload, customerName: "Annan syntetisk kund" },
    });
    expect(mismatch.status()).toBe(409);
    const available = await slots();
    expect(available.length).toBeGreaterThan(1);
    const results = await Promise.all(
      Array.from({ length: 20 }, async (_, index) => {
        const input = {
          serviceId: index % 2 ? "fotvard" : "massage",
          start: index % 2 ? available[0] : available[1],
          customerName: "Syntetisk samtidighetskund",
          customerEmail: `${synthetic.marker}-mixed-${index}@example.test`,
        };
        const key = `${synthetic.marker}-${index}`;
        if (index % 3) {
          const result = await client.callTool({
            name: "create_booking",
            arguments: { ...input, clientRequestId: key, confirmed: true },
          });
          if (result.isError)
            expect(result.content).toEqual([
              { type: "text", text: "That time is no longer available. Choose another time." },
            ]);
          return !result.isError;
        }
        const result = await request.post("/api/bookings", {
          headers: { ...headers, "Idempotency-Key": key },
          data: input,
        });
        expect([201, 400]).toContain(result.status());
        if (result.status() === 400)
          expect(await result.json()).toEqual({
            error: "That time is no longer available. Choose another time.",
          });
        return result.status() === 201;
      }),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(
      await db.booking.count({
        where: { customerEmail: { startsWith: synthetic.marker } },
      }),
    ).toBe(2);
    const overlaps = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM "Booking" a JOIN "Booking" b ON a.id < b.id AND a."businessId"=b."businessId" AND a."staffId"=b."staffId" AND tstzrange(a."startsAt",a."endsAt",'[)') && tstzrange(b."startsAt",b."endsAt",'[)')`;
    expect(Number(overlaps[0].count)).toBe(0);
  } finally {
    await client.close();
    await db.$disconnect();
  }
});

test("HTTP avvisar obehöriga anrop och ogiltig JSON utan feldetaljer", async ({
  synthetic,
}, testInfo) => {
  const request = socketClient(
    testInfo.project.name === "desktop" ? "127.0.0.21" : "127.0.0.22",
  );
  const origin = { origin: "http://localhost:3000" };
  for (const data of [
    null,
    {},
    { email: synthetic.admin.email, password: "wrong" },
    { password: "x".repeat(1025) },
  ]) {
    const response = await request.post("/api/admin/login", {
      data,
      headers: origin,
    });
    // A null Playwright body may be sent as empty JSON; both are rejected safely.
    expect([400, 401]).toContain(response.status());
    expect(await response.text()).not.toMatch(
      /TypeError|SyntaxError|stack|password/,
    );
  }
  const malformed = await request.post("/api/admin/login", {
    data: Buffer.from("{CANARY"),
    headers: { ...origin, "content-type": "application/json" },
  });
  expect(malformed.status()).toBe(400);
  expect(await malformed.json()).toEqual({ error: "Check the details and try again." });
  const denied = await request.post("/api/admin/login", {
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
    headers: { origin: "http://foreign.test" },
  });
  expect(denied.status()).toBe(403);
  const publish = await request.post("/api/admin/publish", {
    data: { id: "synthetic" },
    headers: origin,
  });
  expect(publish.status()).toBe(403);
});
test("bokning, skyddad administration och MCP-utkast som publiceras", async ({
  page,
  request,
  synthetic,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|Refused to/.test(message.text())
    )
      browserErrors.push(message.text());
  });
  for (const path of ["/", "/admin", "/api/services"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    if (path === "/admin")
      expect(headers["cache-control"]).toContain("no-store");
    if (process.env.BOOKING_DEMO)
      expect(headers["strict-transport-security"]).toBe("max-age=31536000");
  }
  const marker = synthetic.marker,
    email = `${marker}@example.test`;
  const customerName = process.env.BOOKING_DEMO
    ? `Testkund ${testInfo.project.name === "desktop" ? "Anna" : "Erik"}`
    : `Testkund ${marker}`;
  const title = synthetic.title;
  async function capture(name: string) {
    if (!process.env.BOOKING_DEMO) return;
    // Avoid Playwright's temporary caret style changing DOM before hydration.
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
      caret: "initial",
    });
    // Only the recording pauses, to make each verified state readable on video.
    await page.waitForTimeout(1200);
  }
  const client = new Client({ name: "e2e", version: "1.0.0" });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        env: mcpEnvironment(),
        args: [
          "--env-file-if-exists=.env",
          "--import",
          "tsx",
          "src/mcp/server.ts",
          "--admin",
        ],
      }),
    );
    const today = DateTime.now().setZone("Europe/Stockholm").toISODate()!;
    const draft = await client.callTool({
      name: "create_campaign_draft",
      arguments: {
        serviceId: "fotvard",
        title,
        discountPercent: 20,
        validFrom: today,
        validUntil: today,
      },
    });
    expect(draft.isError).not.toBeTruthy();
    let day = DateTime.now()
      .setZone("Europe/Stockholm")
      .plus({ days: 5 })
      .startOf("day");
    while (day.weekday > 5) day = day.plus({ days: 1 });
    const availability = await client.callTool({
      name: "get_availability",
      arguments: { serviceId: "fotvard", date: day.toISODate() },
    });
    expect(availability.isError).not.toBeTruthy();
    const forbidden = await request.post("/api/admin/publish", {
      data: { id: "fake" },
      headers: { origin: "http://localhost:3000" },
    });
    expect(forbidden.status()).toBe(403);
    await page.goto("/");
    await chooseDemoSalon(page);
    await expect(page.getByText(title)).toHaveCount(0);
    await capture("01-bokningssida");
    await page.getByTestId("track-customer").getByLabel("Behandling", { exact: true }).selectOption("fotvard");
    await chooseDay(page, "date", day.toISODate()!);
    const slot = await chooseSlot(page, "slot");
    await page.getByTestId("track-customer").getByLabel("Namn (påhittat)", { exact: true }).fill(customerName);
    await page.getByTestId("track-customer").getByLabel("E-post (påhittad)", { exact: true }).fill(email);
    await capture("02-vald-tid");
    await page.getByRole("button", { name: "Bekräfta testbokning" }).click();
    await expect(
      page.getByText(/^Din testbokning är registrerad\./),
    ).toBeVisible();
    await expect(page.locator(".booking-success")).toContainText(
      `Fotvård · 60 min · 650,00\u00a0kr · Anna · ${DateTime.fromISO(slot!).setZone("Europe/Stockholm").setLocale("sv").toFormat("cccc d MMMM yyyy")} kl. ${DateTime.fromISO(slot!).setZone("Europe/Stockholm").toFormat("HH:mm")}`,
    );
    await capture("03-bekraftelse");
    await page.goto("/admin");
    await page.locator("#email").fill(synthetic.admin.email);
    await page.locator("#password").fill(synthetic.admin.password);
    await page.getByRole("button", { name: "Logga in" }).click();
    await expect(
      page.getByRole("heading", { name: "Kalender", exact: true }),
    ).toBeVisible();
    await page.goto(`/admin?date=${day.toISODate()}`);
    await expect(
      page
        .locator(".calendar-booking:visible,.mobile-booking:visible")
        .filter({ hasText: customerName }),
    ).toBeVisible();
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
    const copiedCookie = (await page.context().cookies()).find(
      (c) => c.name === "booking_admin",
    )!;
    for (const query of [
      "from=garbage",
      "from=2026-11-12&to=2027-02-01",
      "from=2026-11-15&to=2026-11-12",
    ]) {
      const response = await page.goto(`/admin?${query}`);
      expect(response!.status()).toBe(200);
      await expect(page.locator("p[role=alert]")).toContainText(
        "Ogiltigt datumfilter",
      );
    }
    await page.goto("/admin/campaigns");
    await capture("04-admin-och-utkast");
    const campaign = page
      .locator("div", { has: page.getByText(title, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Publicera" }) })
      .last();
    await campaign.getByRole("button", { name: "Publicera" }).click();
    await expect(page.getByText("Publicerad", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "Publicerad på bokningssidan under giltighetsperioden",
    );
    await capture("05-publicerad-i-admin");
    await page.goto("/");
    await chooseDemoSalon(page);
    await expect(page.getByText(title)).toBeVisible();
    await capture("06-publikt-erbjudande");
    await page.goto("/admin");
    await page.locator("summary").filter({ hasText: "Konto" }).click();
    await page.getByRole("button", { name: "Logga ut" }).click();
    await expect(page.locator("#password")).toBeVisible();
    const loggedOut = await page.request.post("/api/admin/publish", {
      data: { id: "fake" },
      headers: { origin: "http://localhost:3000" },
    });
    expect(loggedOut.status()).toBe(403);
    const replayHeaders = {
      origin: "http://localhost:3000",
      cookie: `booking_admin=${copiedCookie.value}`,
    };
    expect(
      (
        await request.post("/api/admin/publish", {
          headers: replayHeaders,
          data: { id: "fake" },
        })
      ).status(),
    ).toBe(403);
    const replayPage = await request.get("/admin", { headers: replayHeaders });
    expect(replayPage.status()).toBe(200);
    expect(await replayPage.text()).toContain('id="password"');
    expect(browserErrors).toEqual([]);
  } finally {
    await client.close();
    await db.$disconnect();
  }
});

test("QA HTTP: limiter, idempotens och daglig gräns", async ({
  synthetic,
}, testInfo) => {
  const address =
    testInfo.project.name === "desktop" ? "127.0.0.31" : "127.0.0.32";
  const request = socketClient(address);
  const marker = synthetic.marker;
  const headers = {
    origin: "http://localhost:3000",
    "x-real-ip":
      testInfo.project.name === "desktop" ? "192.0.2.31" : "192.0.2.32",
  };
  for (let i = 0; i < 5; i++) {
    const result = await request.post("/api/admin/login", {
      headers,
      data: { email: synthetic.admin.email, password: "wrong" },
    });
    expect(result.status()).toBe(401);
  }
  for (let i = 0; i < 2; i++) {
    const result = await request.post("/api/admin/login", {
      headers,
      data: { email: synthetic.admin.email, password: "wrong" },
    });
    expect(result.status()).toBe(429);
    expect(Number(result.headers()["retry-after"])).toBeGreaterThan(0);
    expect(await result.json()).toEqual({
      error: "Too many attempts. Please try again later.",
    });
  }
  const lockedLogin = await request.post("/api/admin/login", {
    headers,
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  expect(lockedLogin.status()).toBe(429);
  expect(lockedLogin.headers()["set-cookie"]).toBeUndefined();
  // Concurrent probes keep this test short; every blocked response must be delayed.
  await Promise.all(
    Array.from({ length: 50 }, async (_, i) => {
      const started = performance.now();
      const response = await request.post("/api/admin/login", {
        headers,
        data: {
          email: synthetic.admin.email,
          password: i % 2 ? "wrong" : synthetic.admin.password,
        },
      });
      expect(performance.now() - started).toBeGreaterThanOrEqual(
        LOGIN_FAILURE_DELAY_MS,
      );
      expect(response.status()).toBe(429);
      expect(response.headers()["set-cookie"]).toBeUndefined();
    }),
  );
  const otherClient = socketClient(
    testInfo.project.name === "desktop" ? "127.0.0.71" : "127.0.0.72",
  );
  const validLogin = await otherClient.post("/api/admin/login", {
    headers,
    data: { email: synthetic.admin.email, password: synthetic.admin.password },
  });
  synthetic.trackSession(validLogin.headers()["set-cookie"]);
  expect(validLogin.status()).toBe(200);
  let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 28 });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const slotsResponse = await request.get(
    `/api/availability?serviceId=massage&date=${day.toISODate()}`,
  );
  const slots = (await slotsResponse.json()) as string[];
  const payload = {
    serviceId: "massage",
    start: slots[0],
    customerName: "Syntetisk HTTP",
    customerEmail: `${marker}@example.test`,
  };
  try {
    const keyed = { ...headers, "Idempotency-Key": marker };
    const parallel = await Promise.all(
      Array.from({ length: 20 }, () =>
        request.post("/api/bookings", { headers: keyed, data: payload }),
      ),
    );
    for (const r of parallel) expect(r.status()).toBe(201);
    const ids = await Promise.all(parallel.map((r) => r.json()));
    expect(new Set(ids.map((b) => b.id)).size).toBe(1);
    const retry = await request.post("/api/bookings", {
      headers: keyed,
      data: payload,
    });
    expect(retry.status()).toBe(201);
    expect(await retry.json()).toEqual(ids[0]);
    for (let i = 0; i < 35; i++)
      expect(
        (
          await request.post("/api/bookings", { headers: keyed, data: payload })
        ).status(),
      ).toBe(201);
    const conflict = await request.post("/api/bookings", {
      headers: keyed,
      data: { ...payload, customerName: "Different" },
    });
    expect(conflict.status()).toBe(409);
    for (const slot of slots.slice(1, 3))
      expect(
        (
          await request.post("/api/bookings", {
            headers,
            data: { ...payload, start: slot },
          })
        ).status(),
      ).toBe(201);
    const capped = await request.post("/api/bookings", {
      headers,
      data: { ...payload, start: slots[3] },
    });
    expect(capped.status()).toBe(429);
    expect(Number(capped.headers()["retry-after"])).toBeGreaterThan(0);
    expect(
      await db.booking.count({
        where: { customerEmail: payload.customerEmail },
      }),
    ).toBe(3);
  } finally {
    await db.booking.deleteMany({
      where: { customerEmail: payload.customerEmail },
    });
  }
  const throttleRequest = socketClient(
    testInfo.project.name === "desktop" ? "127.0.0.41" : "127.0.0.42",
  );
  const throttleHeaders = {
    ...headers,
    "x-real-ip":
      testInfo.project.name === "desktop" ? "192.0.2.41" : "192.0.2.42",
  };
  for (let i = 0; i < 30; i++)
    expect(
      (
        await throttleRequest.post("/api/bookings", {
          headers: throttleHeaders,
          data: {},
        })
      ).status(),
    ).toBe(400);
  const limited = await throttleRequest.post("/api/bookings", {
    headers: throttleHeaders,
    data: {},
  });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  const other = socketClient(
    testInfo.project.name === "desktop" ? "127.0.0.51" : "127.0.0.52",
  );
  expect(
    (await other.post("/api/bookings", { headers, data: {} })).status(),
  ).toBe(400);
  const direct = socketClient(
    testInfo.project.name === "desktop" ? "127.0.0.61" : "127.0.0.62",
    false,
  );
  for (let i = 0; i < 6; i++)
    expect(
      (
        await direct.post("/api/admin/login", {
          headers: {
            ...headers,
            "x-real-ip": `192.0.2.${i + 1}`,
            "x-booking-client-ip": `192.0.2.${i + 1}`,
            "x-booking-client-proof": "0".repeat(64),
          },
          data: { email: synthetic.admin.email, password: "wrong" },
        })
      ).status(),
    ).toBe(i < 5 ? 401 : 429);
});

test("UI återanvänder bokningsnyckeln vid dubbelsubmit och tappat svar", async ({
  page,
  synthetic,
}) => {
  let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 45 });
  while (day.weekday > 5) day = day.plus({ days: 1 });
  const keys: string[] = [],
    ids: string[] = [],
    statuses: number[] = [];
  let attempts = 0;
  await page.route("**/api/bookings", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    const response = await route.fetch();
    statuses.push(response.status());
    ids.push((await response.json()).id);
    if (++attempts === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  await page.goto("/");
  await chooseDemoSalon(page);
  await page.getByTestId("track-customer").getByLabel("Behandling", { exact: true }).selectOption("massage");
  await chooseDay(page, "date", day.toISODate()!);
  await chooseSlot(page, "slot");
  await page.getByTestId("track-customer").getByLabel("Namn (påhittat)", { exact: true }).fill("Syntetisk retrykund");
  await page.getByTestId("track-customer").getByLabel("E-post (påhittad)", { exact: true }).fill(`${synthetic.marker}@example.test`);
  await page.getByRole("button", { name: "Bekräfta testbokning" }).click();
  await expect(
    page.getByText(
      "Svaret kunde inte hämtas. Försök igen med samma uppgifter.",
    ),
  ).toBeVisible();
  // Dispatch two real submit events before React replaces the successful form.
  await page.getByTestId("track-customer").getByLabel("Namn (påhittat)", { exact: true }).evaluate((input) => {
    const form = (input as HTMLInputElement).form!;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByText(/^Din testbokning är registrerad/)).toBeVisible();
  await expect.poll(() => statuses.length).toBe(3);
  expect(statuses).toEqual([201, 201, 201]);
  expect(new Set(keys).size).toBe(1);
  expect(keys[0]).toMatch(/^[a-f0-9-]{36}$/);
  expect(new Set(ids).size).toBe(1);
  expect(
    await db.booking.count({
      where: { customerEmail: `${synthetic.marker}@example.test` },
    }),
  ).toBe(1);
});
