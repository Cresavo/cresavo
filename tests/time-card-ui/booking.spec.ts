import { test, expect } from "../e2e/fixtures";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { mcpEnvironment } from "../../src/mcp/environment";
import { mountTimeCard } from "./host";

const date = DateTime.now()
  .setZone("Europe/Stockholm")
  .startOf("week")
  .plus({ weeks: 1 })
  .toISODate()!;

test.afterAll(async () => {
  await db.$disconnect();
});

for (const scenario of ["double-390", "double-1024", "taken", "lost-reply"]) {
  test(`MCP-kort till vanlig admin: ${scenario}`, async ({
    page,
    synthetic,
  }) => {
    const serviceId = `card-${synthetic.marker}`,
      staffId = `card-staff-${synthetic.marker}`;
    await db.service.create({
      data: {
        id: serviceId,
        businessId: "demo",
        name: "Demo kortmassage",
        duration: 30,
        priceOre: 45050,
      },
    });
    synthetic.trackResource("service", serviceId);
    const base = await db.staff.findUniqueOrThrow({
      where: { id: "staff-demo" },
    });
    await db.staff.create({
      data: {
        id: staffId,
        businessId: "demo",
        name: "Demo Kortpersonal",
        serviceIds: [serviceId],
        weekly: base.weekly!,
      },
    });
    synthetic.trackResource("staff", staffId);
    const client = new Client({ name: "card-booking-ui-test", version: "1" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "--import",
          "tsx",
          "src/mcp/time-card/server.ts",
          "--admin",
          "--allow-bookings",
        ],
        env: {
          ...mcpEnvironment({ booking: true }),
          BOOKING_TIME_CARD_DEMO: "1",
          BOOKING_TIME_CARD_BOOKINGS: "1",
        },
      }),
    );
    try {
      const resource = await client.readResource({
        uri: "ui://booking-lab/time-card-v2.html",
      });
      const html = resource.contents[0];
      if (!("text" in html)) throw new Error("Expected HTML");
      const initial = await client.callTool({
        name: "show_time_picker",
        arguments: { serviceId, staffId, date },
      });
      const slots = (
        initial.structuredContent as { slots: { start: string; end: string }[] }
      ).slots;
      await page.setViewportSize({
        width: scenario.endsWith("1024") ? 1024 : 390,
        height: 900,
      });
      await page.goto("/"); // Real loopback origin for crypto.randomUUID; this is still our test host.
      let loseReply = scenario === "lost-reply";
      const { frame, calls, contexts } = await mountTimeCard(
        page,
        client,
        html.text,
        initial,
        {
          call: async (args, next) => {
            const result = await next();
            if (args.name === "book_demo_time" && loseReply) {
              loseReply = false;
              throw new Error("SYNTHETIC_REPLY_LOST_AFTER_COMMIT");
            }
            return result;
          },
        },
      );
      const times = frame
        .getByRole("group", { name: "Available times" })
        .getByRole("button");
      await times.first().click();
      await expect(
        frame.getByRole("button", {
          name: "Confirm test booking",
          exact: true,
        }),
      ).toBeDisabled();
      await expect(frame.locator("#summary")).toContainText("450,50");
      await expect(frame.locator("#window")).toContainText("The demo shows");
      if (scenario === "taken") {
        await db.booking.create({
          data: {
            businessId: "demo",
            serviceId,
            staffId,
            startsAt: new Date(slots[0].start),
            endsAt: new Date(slots[0].end),
            customerName: "Syntetisk konkurrent",
            customerEmail: `${synthetic.marker}@example.test`,
          },
        });
      }
      await frame.getByLabel("I want to create this test booking").check();
      if (scenario.startsWith("double")) {
        await frame
          .getByRole("button", { name: "Confirm test booking", exact: true })
          .evaluate((el) => {
            (el as HTMLButtonElement).click();
            (el as HTMLButtonElement).click();
          });
      } else {
        await frame
          .getByRole("button", { name: "Confirm test booking", exact: true })
          .click();
      }
      if (scenario === "taken") {
        await expect(frame.getByRole("alert")).toContainText(
          "That time was booked",
        );
        await expect(frame.locator("#receipt")).toBeHidden();
        await times.first().click();
        await expect(
          frame.getByLabel("I want to create this test booking"),
        ).not.toBeChecked();
        await frame.getByLabel("I want to create this test booking").check();
        await frame
          .getByRole("button", { name: "Confirm test booking", exact: true })
          .click();
      }
      if (scenario === "lost-reply") {
        await expect(frame.getByRole("status")).toContainText(
          "The booking may exist",
        );
        await expect(
          frame.getByLabel("Treatment", { exact: true }),
        ).toBeDisabled();
        expect(await db.booking.count({ where: { serviceId } })).toBe(1);
        await frame
          .getByRole("button", { name: "Check the same booking attempt" })
          .click();
      }
      await expect(
        frame.getByRole("region", { name: "Booking confirmation" }),
      ).toBeVisible();
      await expect(frame.locator("#receipt-title")).toHaveText("Your test booking is confirmed");
      await expect(frame.getByRole("status")).toContainText("Your test booking is saved");
      await expect(frame.locator("#receipt-summary")).toContainText(
        "Demo kortmassage with Demo Kortpersonal",
      );
      await expect(frame.locator("#receipt-summary")).toContainText("450,50");
      await expect(frame.locator("#receipt-time")).toContainText(
        "Stockholm time",
      );
      const writes = calls.filter((c) => c.name === "book_demo_time");
      expect(writes).toHaveLength(
        scenario === "lost-reply" || scenario === "taken" ? 2 : 1,
      );
      if (scenario === "lost-reply") expect(writes[1]).toEqual(writes[0]);
      if (scenario === "taken")
        expect(writes[1].arguments?.clientRequestId).not.toEqual(
          writes[0].arguments?.clientRequestId,
        );
      const saved = await db.booking.findMany({
        where: { serviceId, customerEmail: "tidkort@example.test" },
      });
      expect(saved).toHaveLength(1);
      await expect
        .poll(() => contexts.at(-1))
        .toMatchObject({
          structuredContent: { bookingCreated: true, id: saved[0].id },
        });
      expect(
        await frame
          .locator("body")
          .evaluate(
            (el) => el.scrollWidth > document.documentElement.clientWidth,
          ),
      ).toBe(false);
      await page.screenshot({
        path: `demo-artifacts/card-booking/${scenario}-receipt.png`,
        fullPage: true,
      });
      await page.goto(
        `/admin?date=${date}&staffId=${encodeURIComponent(staffId)}`,
      );
      await page
        .getByLabel("E-post för administratör")
        .fill(synthetic.admin.email);
      await page
        .getByLabel("Lösenord", { exact: true })
        .fill(synthetic.admin.password);
      await page.getByRole("button", { name: "Logga in", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Kalender", exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(`a[href="/admin/bookings/${saved[0].id}"]:visible`),
      ).toBeVisible();
      await page.screenshot({
        path: `demo-artifacts/card-booking/${scenario}-admin.png`,
        fullPage: true,
      });
    } finally {
      await client.close();
    }
  });
}
