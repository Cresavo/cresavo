import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
test("HTTP avvisar obehöriga anrop och ogiltig JSON utan feldetaljer", async ({
  request,
}) => {
  const origin = { origin: "http://localhost:3000" };
  for (const data of [
    null,
    {},
    { password: "wrong" },
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
  expect(await malformed.json()).toEqual({ error: "Kontrollera uppgifterna" });
  const denied = await request.post("/api/admin/login", {
    data: { password: process.env.ADMIN_PASSWORD },
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
  const marker = `e2e-${Date.now()}`,
    email = `${marker}@example.test`;
  const customerName = `Testkund ${marker}`;
  const title = process.env.BOOKING_DEMO
    ? "Demoerbjudande – 20 % på fotvård"
    : marker;
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
        args: [
          "--env-file=.env",
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
    await expect(page.getByText(title)).toHaveCount(0);
    await capture("01-bokningssida");
    await page.locator("#service").selectOption("fotvard");
    await page.locator("#date").fill(day.toISODate()!);
    await page.getByRole("button", { name: "Visa lediga tider" }).click();
    await expect(page.locator("#slot option").nth(1)).toBeAttached();
    const slot = await page
      .locator("#slot option")
      .nth(1)
      .getAttribute("value");
    await page.locator("#slot").selectOption(slot!);
    await page.locator("#name").fill(customerName);
    await page.locator("#email").fill(email);
    await capture("02-vald-tid");
    await page.getByRole("button", { name: "Bekräfta testbokning" }).click();
    await expect(
      page.getByText(/^Din testbokning är registrerad\./),
    ).toBeVisible();
    await expect(
      page.getByText(/^Din testbokning är registrerad\./),
    ).toContainText(
      `Fotvård · ${DateTime.fromISO(slot!).setZone("Europe/Stockholm").toFormat("yyyy-MM-dd HH:mm")} (Europe/Stockholm)`,
    );
    await capture("03-bekraftelse");
    await page.goto("/admin");
    await page.locator("#password").fill(process.env.ADMIN_PASSWORD!);
    await page.getByRole("button", { name: "Logga in" }).click();
    await expect(page.getByText(customerName, { exact: false })).toBeVisible();
    await expect(page.getByText(email, { exact: false })).toHaveCount(0);
    await capture("04-admin-och-utkast");
    const campaign = page
      .locator("div", { has: page.getByText(title, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Publicera" }) })
      .last();
    await campaign.getByRole("button", { name: "Publicera" }).click();
    await expect(page.getByText("Publicerad")).toBeVisible();
    await capture("05-publicerad-i-admin");
    await page.goto("/");
    await expect(page.getByText(title)).toBeVisible();
    await capture("06-publikt-erbjudande");
    await page.goto("/admin");
    await page.getByRole("button", { name: "Logga ut" }).click();
    await expect(page.locator("#password")).toBeVisible();
    const loggedOut = await page.request.post("/api/admin/publish", {
      data: { id: "fake" },
      headers: { origin: "http://localhost:3000" },
    });
    expect(loggedOut.status()).toBe(403);
    expect(browserErrors).toEqual([]);
  } finally {
    await client.close();
    await db.booking.deleteMany({ where: { customerEmail: email } });
    await db.campaign.deleteMany({ where: { title } });
    await db.$disconnect();
  }
});

test("QA HTTP: limiter, idempotens och daglig gräns", async ({
  request,
}, testInfo) => {
  const marker = `qa-http-${testInfo.project.name}-${Date.now()}`;
  const headers = {
    origin: "http://localhost:3000",
    "x-real-ip":
      testInfo.project.name === "desktop" ? "192.0.2.31" : "192.0.2.32",
  };
  for (let i = 0; i < 5; i++) {
    const result = await request.post("/api/admin/login", {
      headers,
      data: { password: "wrong" },
    });
    expect(result.status()).toBe(401);
  }
  for (let i = 0; i < 2; i++) {
    const result = await request.post("/api/admin/login", {
      headers,
      data: { password: "wrong" },
    });
    expect(result.status()).toBe(429);
    expect(Number(result.headers()["retry-after"])).toBeGreaterThan(0);
    expect(await result.json()).toEqual({
      error: "För många försök. Försök igen senare.",
    });
  }
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
  const throttleHeaders = {
    ...headers,
    "x-real-ip":
      testInfo.project.name === "desktop" ? "192.0.2.41" : "192.0.2.42",
  };
  for (let i = 0; i < 30; i++)
    expect(
      (
        await request.post("/api/bookings", {
          headers: throttleHeaders,
          data: {},
        })
      ).status(),
    ).toBe(400);
  const limited = await request.post("/api/bookings", {
    headers: throttleHeaders,
    data: {},
  });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
});
