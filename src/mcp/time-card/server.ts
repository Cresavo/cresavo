import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { assertTimeCardDemo, timeCardBookingsEnabled } from "./guard";
import { bookDemoTime, cardBookingSchema } from "./booking";
import { timeCardData, timeCardSchema, timeCardServices } from "./data";
import { db } from "../../lib/db";
import { safeToolSchema } from "../reply";
import { safeFailure } from "../../lib/errors";

try {
  assertTimeCardDemo();
} catch {
  console.error("TIME_CARD_DEMO_REFUSED");
  process.exit(1);
}
const allowBookings = timeCardBookingsEnabled();
const uri = "ui://booking-lab/time-card-v2.html";
const ui = {
  prefersBorder: false,
  csp: {
    connectDomains: [],
    resourceDomains: [],
    frameDomains: [],
    baseUriDomains: [],
  },
};

serveStdio(() => {
  const server = new McpServer({
    name: "booking-lab-time-card-demo",
    version: "0.2.0",
  });
  for (const resourceUri of [uri, "ui://booking-lab/time-card-v1.html"])
    server.registerResource(
      resourceUri === uri ? "time-card" : "time-card-v1",
      resourceUri,
      { mimeType: "text/html;profile=mcp-app", _meta: { ui } },
      async () => ({
        contents: [
          {
            uri: resourceUri,
            mimeType: "text/html;profile=mcp-app",
            text: readFileSync(new URL("./ui.html", import.meta.url), "utf8"),
            _meta: { ui },
          },
        ],
      }),
    );
  server.registerTool(
    "show_time_picker",
    {
      title: "Välj en demotid",
      description:
        "Visa ett interaktivt svenskt tidvalskort för syntetiska behandlingar. Endast läsning: ett tidsval är aldrig en bokning. Sök högst 28 dagar från idag. Omittera staffId vid byte av serviceId.",
      inputSchema: safeToolSchema(timeCardSchema),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: uri },
        "openai/outputTemplate": uri,
        "openai/widgetAccessible": true,
      },
    },
    async (input) => {
      try {
        const result = await timeCardData(input, allowBookings);
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `${result.service.name}, ${result.service.duration} minuter, ${result.service.priceOre / 100} SEK hos ${result.selectedStaff.name}. ${result.date}: ${result.slots.map(({ start }) => start).join(", ") || "Inga lediga tider denna dag; välj nästa dag."} ${result.notice}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: safeFailure(error).message },
          ],
        };
      }
    },
  );
  if (allowBookings)
    server.registerTool(
      "book_demo_time",
      {
        title: "Bekräfta en testbokning",
        description:
          "Skapa uttryckligen bekräftad lokal testbokning för en fast påhittad kund. Samma clientRequestId och payload vid retry. Ingen betalning eller utskick.",
        inputSchema: safeToolSchema(cardBookingSchema),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        _meta: { ui: { visibility: ["app"] }, "openai/widgetAccessible": true },
      },
      async (input) => {
        try {
          const result = await bookDemoTime(input);
          return {
            structuredContent: result,
            content: [
              {
                type: "text" as const,
                text: `Testbokning skapad: ${result.serviceName}, ${result.startsAt}. Boknings-id ${result.id}.`,
              },
            ],
          };
        } catch (error) {
          const failure = safeFailure(error);
          return {
            isError: true,
            structuredContent: {
              demo: true,
              bookingCreated: failure.status >= 500 ? "unknown" : false,
              error: {
                code:
                  failure.message === "Tiden är inte tillgänglig"
                    ? "slot_unavailable"
                    : "booking_failed",
                status: failure.status,
                message: failure.message,
              },
            },
            content: [{ type: "text" as const, text: failure.message }],
          };
        }
      },
    );
  server.registerTool(
    "list_services",
    {
      description: "Lista demobehandlingar utan kunddata",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const services = await timeCardServices();
        return {
          structuredContent: { services },
          content: [{ type: "text" as const, text: JSON.stringify(services) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: safeFailure(error).message },
          ],
        };
      }
    },
  );
  server.server.onclose = () => {
    void db
      .$disconnect()
      .catch(() => console.error("TIME_CARD_DISCONNECT_FAILED"));
  };
  return server;
});
