import { test, expect } from "./fixtures";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DateTime } from "luxon";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { emailCapKey, hashedEmailCapKey } from "../../src/lib/domain";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";

test("kundexport laddas ner och bekräftad kontaktborttagning bevarar teknisk historik", async ({
  page,
  request,
  synthetic,
}, testInfo) => {
  const db = createDatabaseClient(),
    serviceId = synthetic.marker + "-service",
    staffId = synthetic.marker + "-staff";
  synthetic.trackResource("service", serviceId);
  synthetic.trackResource("staff", staffId);
  const email = synthetic.marker + "@example.test",
    name = "Livscykel Demo";
  try {
    const login = await page.request.post("/api/admin/login", {
      headers: { origin: "http://localhost:3000" },
      data: {
        email: synthetic.admin.email,
        password: synthetic.admin.password,
      },
    });
    expect(login.status()).toBe(200);
    synthetic.trackSession(login.headers()["set-cookie"] ?? "");
    await page.goto("/admin/customers/new");
    await page.getByLabel("Namn (påhittat)", { exact: true }).fill(name);
    await page.getByLabel("E-post (testadress)", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Skapa kund", exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/customers\/[^/?]+(?:\?[^#]*)?$/);
    const customerId = new URL(page.url()).pathname.split("/").at(-1)!;
    synthetic.trackResource("customer", customerId);
    await page.goto(page.url() + "?saved=1");
    await db.service.create({
      data: {
        id: serviceId,
        businessId: "demo",
        name: "Historisk demobehandling",
        duration: 30,
        priceOre: 45000,
      },
    });
    await db.staff.create({
      data: {
        id: staffId,
        businessId: "demo",
        name: "Syntetisk personal",
        serviceIds: [serviceId],
        weekly: [],
        exceptions: [],
      },
    });
    const start = DateTime.now()
      .minus({ days: 2 })
      .startOf("day")
      .set({ hour: 9 })
      .toJSDate();
    const booking = await db.booking.create({
      data: {
        businessId: "demo",
        customerId,
        serviceId,
        staffId,
        startsAt: start,
        endsAt: new Date(+start + 1800000),
        customerName: "Tidigare påhittat namn",
        customerEmail: email,
        emailCapKey: emailCapKey(email),
        serviceName: "Historisk demobehandling",
        duration: 30,
        priceOre: 45000,
        status: "cancelled",
      },
    });
    const path = `/api/admin/customers/${customerId}/data`;
    expect(
      (
        await request.post(path, {
          data: { action: "export", expectedVersion: 1 },
          headers: { origin: "http://localhost:3000" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(path, {
          data: { action: "export", expectedVersion: 1 },
          headers: { origin: "https://other.example.test" },
        })
      ).status(),
    ).toBe(403);
    const invalid = await page.request.post(path, {
      data: { action: "export", expectedVersion: 1, unknown: email },
      headers: { origin: "http://localhost:3000" },
    });
    expect(invalid.status()).toBe(400);
    expect(await invalid.text()).not.toContain(email);
    await page
      .getByText("Exportera kundkort och kopplade bokningar", { exact: true })
      .click();
    await page
      .getByRole("button", { name: "Förbered export", exact: true })
      .click();
    const downloadLink = page.getByRole("link", {
      name: "Ladda ner kunddata, del 1",
      exact: true,
    });
    await expect(downloadLink).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await downloadLink.click();
    const file = await downloaded,
      output = testInfo.outputPath("synthetic-customer-export.json");
    await file.saveAs(output);
    const data = JSON.parse(await readFile(output, "utf8"));
    expect(data.customer).toMatchObject({ id: customerId, name, email });
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0]).toMatchObject({
      id: booking.id,
      customerName: "Tidigare påhittat namn",
      customerEmail: email,
      priceOre: 45000,
    });
    expect(data.nextCursor).toBeNull();
    for (const field of [
      "passwordHash",
      "clientKey",
      "emailCapKey",
      "requestHash",
    ])
      expect(JSON.stringify(data)).not.toContain(field);
    await page.getByText("Ta bort kontaktuppgifter", { exact: true }).click();
    await page
      .getByRole("button", {
        name: "Förhandsgranska kontaktborttagning",
        exact: true,
      })
      .click();
    const confirm = page.getByRole("button", {
      name: "Bekräfta kontaktborttagning",
      exact: true,
    });
    await expect(confirm).toBeDisabled();
    await expect(
      page.getByText(
        "Ett kundkort och 1 direktkopplade bokningar. Inga andra kunder ändras.",
        { exact: true },
      ),
    ).toBeVisible();
    const viewport = page.viewportSize();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    if (viewport) await page.setViewportSize(viewport);
    await page
      .getByRole("checkbox", {
        name: "Jag förstår omfattningen och vill ta bort kontaktuppgifterna.",
        exact: true,
      })
      .check();
    await confirm.click();
    await expect(
      page.getByRole("heading", {
        name: "Kontaktuppgifter borttagna",
        exact: true,
      }),
    ).toBeVisible();
    await expect(downloadLink).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(
      "Kundkortet är sparat. Äldre bokningar är oförändrade.",
    );
    await page.reload();
    await expect(
      page.getByText("Redigera kunduppgifter", { exact: true }),
    ).toHaveCount(0);
    const removed = await db.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(removed).toEqual({
      ...booking,
      customerName: "Kontaktuppgifter borttagna",
      customerEmail: "removed@example.test",
      emailCapKey: hashedEmailCapKey(emailCapKey(email)),
      contactRemovedAt: expect.any(Date),
    });
    expect(JSON.stringify(removed)).not.toContain(email);
    const actions = await db.customerDataAction.findMany({
      where: { customerId },
    });
    expect(actions.filter((a) => a.action === "remove_contact")).toHaveLength(
      1,
    );
    expect(actions.filter((a) => a.action === "export")).toHaveLength(1);
    expect(JSON.stringify(actions)).not.toContain(email);
    await page
      .getByRole("link", { name: "Tidigare och avbokade", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Historisk demobehandling",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      "Tidigare påhittat namn",
    );
    await expect(page.locator("main")).toContainText("450,00");
  } finally {
    await db.$disconnect();
  }
});

test("HTTP-admin och lokal MCP-kontakt minimeras först efter att kommande besök hanterats", async ({
  page,
  synthetic,
}) => {
  const db = createDatabaseClient(),
    serviceId = synthetic.marker + "-service",
    staffId = synthetic.marker + "-staff";
  synthetic.trackResource("service", serviceId);
  synthetic.trackResource("staff", staffId);
  const client = new Client({ name: "customer-privacy-proof", version: "1" });
  try {
    const login = await page.request.post("/api/admin/login", {
      headers: { origin: "http://localhost:3000" },
      data: {
        email: synthetic.admin.email,
        password: synthetic.admin.password,
      },
    });
    expect(login.status()).toBe(200);
    synthetic.trackSession(login.headers()["set-cookie"] ?? "");
    const customer = await db.customer.create({
      data: {
        businessId: "demo",
        name: "Aktiv Demo",
        email: synthetic.marker + "@example.test",
      },
    });
    synthetic.trackResource("customer", customer.id);
    await db.service.create({
      data: {
        id: serviceId,
        businessId: "demo",
        name: "Syntetisk behandling",
        duration: 30,
        priceOre: 45000,
      },
    });
    await db.staff.create({
      data: {
        id: staffId,
        businessId: "demo",
        name: "Syntetisk personal",
        serviceIds: [serviceId],
        weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          periods: [{ start: "09:00", end: "17:00" }],
          breaks: [],
        })),
        exceptions: [],
      },
    });
    const start = DateTime.now()
      .setZone("Europe/Stockholm")
      .plus({ days: 2 })
      .startOf("day")
      .set({ hour: 9 })
      .toUTC()
      .toISO()!;
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
    const mcp = await client.callTool({
      name: "create_booking",
      arguments: {
        customerId: customer.id,
        serviceId,
        staffId,
        start,
        clientRequestId: randomUUID(),
        confirmed: true,
      },
    });
    expect(mcp.isError).toBeFalsy();
    const block = mcp.content[0];
    if (block.type !== "text") throw Error("MCP_TEXT_EXPECTED");
    const booking = await db.booking.findUniqueOrThrow({
      where: { id: JSON.parse(block.text).id },
    });
    expect(booking.emailCapKey).toMatch(/^email-hmac-v1:[a-f0-9]{64}$/);
    const adminKey = randomUUID();
    synthetic.trackWorkspaceRequest(adminKey);
    const adminResponse = await page.request.post("/api/admin/bookings", {
      headers: { origin: "http://localhost:3000", "Idempotency-Key": adminKey },
      data: {
        action: "create",
        customerId: customer.id,
        serviceId,
        staffId,
        start: DateTime.fromISO(start).plus({ hours: 1 }).toISO(),
      },
    });
    expect(adminResponse.status()).toBe(201);
    const adminBooking = await db.booking.findUniqueOrThrow({
      where: { id: (await adminResponse.json()).id },
    });
    expect(adminBooking.emailCapKey).toBeNull();
    await page.goto(`/admin/customers/${customer.id}`);
    await page.getByText("Ta bort kontaktuppgifter", { exact: true }).click();
    await page
      .getByRole("button", {
        name: "Förhandsgranska kontaktborttagning",
        exact: true,
      })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Kunddata", exact: true })
        .getByRole("alert"),
    ).toContainText("Hantera 2 kommande eller pågående bokningar först.");
    await expect(
      page.getByRole("button", {
        name: "Bekräfta kontaktborttagning",
        exact: true,
      }),
    ).toHaveCount(0);
    const key = randomUUID();
    synthetic.trackWorkspaceRequest(key);
    const cancel = await page.request.post("/api/admin/bookings", {
      headers: { origin: "http://localhost:3000", "Idempotency-Key": key },
      data: {
        action: "cancel",
        id: booking.id,
        expectedVersion: booking.version,
      },
    });
    expect(cancel.status()).toBe(200);
    const adminCancelKey = randomUUID();
    synthetic.trackWorkspaceRequest(adminCancelKey);
    expect(
      (
        await page.request.post("/api/admin/bookings", {
          headers: {
            origin: "http://localhost:3000",
            "Idempotency-Key": adminCancelKey,
          },
          data: {
            action: "cancel",
            id: adminBooking.id,
            expectedVersion: adminBooking.version,
          },
        })
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", {
        name: "Förhandsgranska kontaktborttagning",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Bekräfta kontaktborttagning",
        exact: true,
      }),
    ).toBeDisabled();
    expect(
      (await db.customer.findUniqueOrThrow({ where: { id: customer.id } }))
        .contactRemovedAt,
    ).toBeNull();
    const before = await db.booking.findMany({
      where: { customerId: customer.id },
      orderBy: { id: "asc" },
    });
    const events = await db.bookingEvent.findMany({
      where: { bookingId: { in: before.map((b) => b.id) } },
      orderBy: { id: "asc" },
    });
    await page
      .getByRole("checkbox", {
        name: "Jag förstår omfattningen och vill ta bort kontaktuppgifterna.",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Bekräfta kontaktborttagning", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Kontaktuppgifter borttagna",
        exact: true,
      }),
    ).toBeVisible();
    const after = await db.booking.findMany({
      where: { customerId: customer.id },
      orderBy: { id: "asc" },
    });
    for (let i = 0; i < after.length; i++) {
      expect(after[i]).toEqual({
        ...before[i],
        customerName: "Kontaktuppgifter borttagna",
        customerEmail: "removed@example.test",
        contactRemovedAt: expect.any(Date),
      });
      expect(JSON.stringify(after[i])).not.toContain(customer.email);
      expect(JSON.stringify(after[i])).not.toContain(customer.name);
    }
    expect(
      await db.bookingEvent.findMany({
        where: { bookingId: { in: before.map((b) => b.id) } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(events);
  } finally {
    await client.close();
    await db.$disconnect();
  }
});
