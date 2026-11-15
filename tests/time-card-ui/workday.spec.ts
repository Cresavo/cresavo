import { test, expect } from "../e2e/fixtures";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { db } from "../../src/lib/db";
import { mountTimeCard } from "./host";
import { cardBookingSchema } from "../../src/mcp/time-card/booking";
const date = DateTime.now()
  .setZone("Europe/Stockholm")
  .startOf("week")
  .plus({ weeks: 1 })
  .toISODate()!;
test.afterAll(async () => {
  await db.$disconnect();
});
for (const scenario of [
  "reopen-390",
  "lost-before",
  "lost-after",
  "owner-320",
  "owner-390",
  "owner-1024",
]) {
  test(`Beständigt agentflöde: ${scenario}`, async ({ page, synthetic }) => {
    const serviceId = `workday-${synthetic.marker}`,
      staffId = `workday-staff-${synthetic.marker}`;
    await db.service.create({
      data: {
        id: serviceId,
        businessId: "demo",
        name: "Demo lugn massage",
        duration: 30,
        buffer: 15,
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
        name: "Demo Anna",
        serviceIds: [serviceId],
        weekly: base.weekly!,
      },
    });
    synthetic.trackResource("staff", staffId);
    const owner = scenario.startsWith("owner"),
      width = Number(scenario.split("-").at(-1)) || 390;
    const client = new Client({ name: "workday-ui-test-host", version: "1" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "--import",
          "tsx",
          owner ? "src/mcp/server.ts" : "src/mcp/time-card/server.ts",
          "--admin",
          owner ? "--workday-card" : "--allow-bookings",
        ],
        env: {
          ...mcpEnvironment({ booking: true }),
          BOOKING_OWNER_WEB_ORIGIN: "http://localhost:3197",
          ...(owner
            ? { BOOKING_OWNER_CARD_DEMO: "1" }
            : { BOOKING_TIME_CARD_DEMO: "1", BOOKING_TIME_CARD_BOOKINGS: "1" }),
        },
      }),
    );
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const resource = (
        await client.readResource({
          uri: owner
            ? "ui://booking-lab/workday-v1.html"
            : "ui://booking-lab/time-card-v3.html",
        })
      ).contents[0];
      if (!("text" in resource)) throw Error();
      const initial = await client.callTool({
        name: owner ? "show_workday" : "show_time_picker",
        arguments: { date, staffId, serviceId },
      });
      if (owner) {
        let failRead = true;
        const { frame, calls } = await mountTimeCard(
          page,
          client,
          resource.text,
          initial,
          {
            kind: "workday",
            call: async (_args, next) => {
              if (failRead) {
                failRead = false;
                throw Error("SYNTHETIC_OWNER_READ_FAILURE");
              }
              return next();
            },
          },
        );
        await expect(
          frame.getByText("Inga bokningar på den här sidan."),
        ).toBeVisible();
        await expect(
          frame.getByRole("link", { name: "Öppna kalendern" }),
        ).toHaveAttribute("href", new RegExp(`/admin\\?date=${date}&staffId=`));
        const starts = (initial.structuredContent as { slots: string[] }).slots;
        await db.booking.createMany({
          data: [starts[0], starts[2]].map((start) => ({
            businessId: "demo",
            serviceId,
            staffId,
            serviceName: "Demo lugn massage",
            startsAt: new Date(start),
            endsAt: new Date(Date.parse(start) + 45 * 60000),
            duration: 30,
            buffer: 15,
            priceOre: 45050,
            customerName: "Syntetisk kund",
            customerEmail: `${synthetic.marker}@example.test`,
          })),
        });
        await frame
          .getByRole("button", { name: "Uppdatera", exact: true })
          .click();
        await expect(frame.getByRole("alert")).toContainText(
          "Arbetsdagen kunde inte hämtas",
        );
        await frame
          .getByRole("button", { name: "Försök igen", exact: true })
          .click();
        await expect(frame.locator("#bookings li")).toHaveCount(2);
        await expect(frame.locator("#next-visit")).toContainText(
          "Demo lugn massage",
        );
        await frame
          .getByRole("button", { name: "Nästa dag", exact: true })
          .click();
        await expect(
          frame.getByText("Inga bokningar på den här sidan."),
        ).toBeVisible();
        await expect(frame.getByRole("status")).toContainText("Stockholmstid");
        await frame
          .getByRole("button", { name: "Uppdatera", exact: true })
          .click();
        await frame
          .getByRole("button", { name: "Föregående dag", exact: true })
          .click();
        await expect(frame.locator("#bookings li")).toHaveCount(2);
        await expect(frame.locator("#day")).toBeFocused();
        expect(calls.every((c) => c.name === "show_workday")).toBe(true);
        await expect(
          frame.getByRole("button", { name: "Bekräfta testbokning" }),
        ).toHaveCount(0);
        expect(
          await frame
            .locator("body")
            .evaluate(
              (el) => el.scrollWidth > document.documentElement.clientWidth,
            ),
        ).toBe(false);
        await page.screenshot({
          path: `demo-artifacts/agent-workday/${scenario}.png`,
          fullPage: true,
        });
      } else {
        let inject = scenario !== "reopen-390";
        let mounted = await mountTimeCard(
          page,
          client,
          resource.text,
          initial,
          {
            call: async (args, next) => {
              if (args.name === "book_demo_time" && inject) {
                inject = false;
                if (scenario === "lost-before") {
                  const payload = args.arguments!;
                  const scope = createHmac(
                    "sha256",
                    process.env.SESSION_SECRET!,
                  )
                    .update("demo:time-card-recovery:v1")
                    .digest("hex");
                  await db.cardBookingAttempt.create({
                    data: {
                      businessId: "demo",
                      scope,
                      requestId: payload.clientRequestId as string,
                      payload: cardBookingSchema.parse(payload),
                    },
                  });
                } else await next();
                throw Error("SYNTHETIC_INTERRUPTION");
              }
              return next();
            },
          },
        );
        await mounted.frame
          .getByRole("group", { name: "Lediga tider" })
          .getByRole("button")
          .first()
          .click();
        await mounted.frame
          .getByLabel("Jag vill skapa den här testbokningen")
          .check();
        await mounted.frame
          .getByRole("button", { name: "Bekräfta testbokning", exact: true })
          .click();
        if (scenario !== "reopen-390")
          await expect(mounted.frame.getByRole("status")).toContainText(
            "Bokningen kan ha skapats",
          );
        else await expect(mounted.frame.locator("#receipt")).toBeVisible();
        await page.goto("/");
        mounted = await mountTimeCard(page, client, resource.text, initial);
        if (scenario === "lost-before") {
          await expect(mounted.frame.getByRole("status")).toContainText(
            "Tidigare försök",
          );
          await expect(
            mounted.frame.getByLabel("Behandling", { exact: true }),
          ).toBeDisabled();
          await mounted.frame
            .getByRole("button", { name: "Kontrollera samma bokningsförsök" })
            .click();
        }
        await expect(mounted.frame.locator("#receipt")).toBeVisible();
        expect(await db.booking.count({ where: { serviceId } })).toBe(1);
        await mounted.frame
          .getByRole("button", { name: "Lägg i min kalender" })
          .click();
        const downloadPromise = page.waitForEvent("download");
        await mounted.frame
          .getByRole("link", { name: "Hämta kalenderfil" })
          .click();
        const download = await downloadPromise;
        const content = await readFile((await download.path())!, "utf8");
        expect(download.suggestedFilename()).toBe("booking-lab-demo.ics");
        expect(content).toContain("BEGIN:VCALENDAR");
        expect(content).not.toContain("tidkort@example.test");
        await expect(mounted.frame.locator("#calendar-notice")).toContainText(
          "Ingen insättning",
        );
        const booking = await db.booking.findFirstOrThrow({
          where: { serviceId },
        });
        await db.booking.update({
          where: { id: booking.id },
          data: { status: "cancelled", version: { increment: 1 } },
        });
        await mounted.frame
          .getByRole("button", { name: "Uppdatera bokningsstatus" })
          .click();
        await expect(mounted.frame.locator("#receipt-title")).toHaveText(
          "Din testbokning är avbokad",
        );
        await expect(
          mounted.frame.getByRole("button", { name: "Lägg i min kalender" }),
        ).toBeDisabled();
        await page.screenshot({
          path: `demo-artifacts/agent-workday/${scenario}.png`,
          fullPage: true,
        });
      }
    } finally {
      await client.close();
    }
  });
}
