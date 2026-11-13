import { test, expect } from "@playwright/test";
import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { db } from "../../src/lib/db";

const monday = DateTime.now()
  .setZone("Europe/Stockholm")
  .startOf("week")
  .plus({ weeks: 1 })
  .toISODate()!;
const marker = randomUUID();
let client: Client;
let html: string;
test.beforeAll(async () => {
  client = new Client({ name: "time-card-ui-test", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/mcp/time-card/server.ts"],
      env: { ...mcpEnvironment(), BOOKING_TIME_CARD_DEMO: "1" },
    }),
  );
  const resource = await client.readResource({
    uri: "ui://booking-lab/time-card-v1.html",
  });
  const content = resource.contents[0];
  if (!("text" in content)) throw new Error("Expected HTML resource");
  html = content.text;
});
test.afterEach(async () => {
  await db.booking.deleteMany({ where: { id: marker } });
});
test.afterAll(async () => {
  await client?.close();
  await db.$disconnect();
});

for (const width of [320, 390, 1024]) {
  test(`verklig MCP-resurs: tryckbara val och stale vid ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const contexts: unknown[] = [];
    let fail = false;
    await page.exposeFunction(
      "mcp",
      async (message: { method: string; params: Record<string, unknown> }) => {
        if (message.method === "ui/initialize")
          return {
            protocolVersion: "2026-01-26",
            hostCapabilities: { updateModelContext: { text: true } },
            hostInfo: { name: "test-harness-not-chatgpt", version: "1" },
          };
        if (message.method === "ui/update-model-context") {
          contexts.push(message.params);
          return {};
        }
        if (message.method === "tools/call") {
          if (fail) throw new Error("SYNTHETIC_TRANSPORT_FAILURE");
          return client.callTool(
            message.params as {
              name: string;
              arguments: Record<string, unknown>;
            },
          );
        }
        return {};
      },
    );
    await page.setContent(
      '<iframe title="MCP Apps testvärd" style="width:100%;height:1600px;border:0" sandbox="allow-scripts allow-same-origin"></iframe>',
    );
    await page.evaluate((html) => {
      const frame = document.querySelector("iframe")!;
      window.addEventListener("message", async (event) => {
        if (event.source !== frame.contentWindow) return;
        if (event.data?.method === "ui/notifications/size-changed") {
          frame.style.height = `${event.data.params.height}px`;
          return;
        }
        if (!event.data?.id) return;
        try {
          const result = await (
            window as unknown as { mcp: (message: unknown) => Promise<unknown> }
          ).mcp(event.data);
          frame.contentWindow!.postMessage(
            { jsonrpc: "2.0", id: event.data.id, result },
            "*",
          );
        } catch {
          frame.contentWindow!.postMessage(
            {
              jsonrpc: "2.0",
              id: event.data.id,
              error: { code: -32000, message: "Transport failure" },
            },
            "*",
          );
        }
      });
      frame.srcdoc = html;
    }, html);
    const initial = await client.callTool({
      name: "show_time_picker",
      arguments: { date: monday, serviceId: "massage", staffId: "staff-demo" },
    });
    await expect(page.frameLocator("iframe").getByRole("status")).toContainText(
      "Hämtar lediga demotider",
    );
    await page.evaluate(
      (result) =>
        document.querySelector("iframe")!.contentWindow!.postMessage(
          {
            jsonrpc: "2.0",
            method: "ui/notifications/tool-result",
            params: result,
          },
          "*",
        ),
      initial,
    );
    const frame = page.frameLocator("iframe");
    await expect(
      frame.getByRole("heading", { name: "En stund för dig." }),
    ).toBeVisible();
    await expect(
      frame.getByText("30 minuter · Ordinarie pris", { exact: false }),
    ).toBeVisible();
    const slots = frame
      .getByRole("group", { name: "Lediga tider" })
      .getByRole("button");
    await expect(slots.first()).toBeVisible();
    await slots.first().click();
    await frame
      .getByRole("button", { name: "Kontrollera mitt tidsval" })
      .click();
    await expect(frame.getByRole("status")).toHaveText(
      "Tiden är fortfarande ledig. Ingen bokning har skapats.",
    );
    const chosen = (
      initial.structuredContent as { slots: { start: string; end: string }[] }
    ).slots[0];
    await expect
      .poll(() => contexts.at(-1))
      .toMatchObject({ structuredContent: { start: chosen.start } });
    await db.booking.create({
      data: {
        id: marker,
        businessId: "demo",
        serviceId: "massage",
        staffId: "staff-demo",
        startsAt: new Date(chosen.start),
        endsAt: new Date(chosen.end),
        customerName: "Syntetisk korttest",
        customerEmail: "time-card-ui@example.test",
      },
    });
    await frame
      .getByRole("button", { name: "Kontrollera mitt tidsval" })
      .click();
    await expect(frame.getByRole("status")).toHaveText(
      "Tiden är inte längre ledig. Välj en annan tid här ovanför.",
    );
    await expect(frame.locator("#selection")).toBeHidden();
    await expect
      .poll(() => contexts.at(-1))
      .toMatchObject({ structuredContent: { start: null } });
    const sunday = DateTime.fromISO(monday).plus({ days: 6 }).toISODate()!;
    const day = new Intl.DateTimeFormat("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "Europe/Stockholm",
    }).format(new Date(sunday + "T12:00Z"));
    await frame.getByRole("button", { name: day, exact: true }).click();
    await expect(
      frame.getByText("Inga lediga tider den här dagen."),
    ).toBeVisible();
    await frame.getByRole("button", { name: "Prova nästa dag" }).click();
    await expect(slots.first()).toBeVisible();
    await slots.first().click();
    await frame
      .getByLabel("Behandling", { exact: true })
      .selectOption("fotvard");
    await expect(frame.locator("#selection")).toBeHidden();
    await expect(frame.locator("#details")).toContainText("60 minuter");
    fail = true;
    await frame.getByRole("button", { name: "Nästa sju dagar" }).click();
    await expect(frame.getByRole("alert")).toContainText(
      "Tiderna kunde inte hämtas",
    );
    fail = false;
    await frame.getByRole("button", { name: "Försök igen" }).click();
    await expect(frame.getByRole("alert")).toBeEmpty();
    const overflow = await frame
      .locator("body")
      .evaluate((el) => el.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({
      path: `demo-artifacts/time-card/harness-${width}.png`,
      fullPage: true,
    });
  });
}
