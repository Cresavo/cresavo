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
import { cardHistorySchema, readCardBookings } from "./recovery";
import { calendarFileSchema, getCardCalendarFile } from "./calendar-file";

try {
  assertTimeCardDemo();
} catch {
  console.error("TIME_CARD_DEMO_REFUSED");
  process.exit(1);
}
const allowBookings = timeCardBookingsEnabled();
const uri = "ui://booking-lab/time-card-v3.html";
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
    version: "0.3.0",
  });
  for (const resourceUri of [
    uri,
    "ui://booking-lab/time-card-v2.html",
    "ui://booking-lab/time-card-v1.html",
  ])
    server.registerResource(
      resourceUri === uri ? "time-card" : resourceUri,
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
  if (allowBookings) {
    const appOnly = {
      ui: { visibility: ["app"] },
      "openai/widgetAccessible": true,
    };
    server.registerTool(
      "read_demo_bookings",
      {
        title: "My local demo bookings",
        description:
          "Retrieve up to 20 attempts and any in-progress attempt from the trusted local demo channel. No customer sign-in or contact information.",
        inputSchema: safeToolSchema(cardHistorySchema),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: appOnly,
      },
      async (input) => {
        try {
          const result = await readCardBookings(input);
          return {
            structuredContent: result,
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
          };
        } catch (e) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: safeFailure(e).message }],
          };
        }
      },
    );
    server.registerTool(
      "get_demo_calendar_file",
      {
        title: "Download calendar file",
        description:
          "Download a calendar file for your active fictional booking. Import it manually. Changes do not sync.",
        inputSchema: safeToolSchema(calendarFileSchema),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: appOnly,
      },
      async (input) => {
        try {
          const result = await getCardCalendarFile(input);
          return {
            structuredContent: result,
            content: [{ type: "text" as const, text: result.notice }],
          };
        } catch (e) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: safeFailure(e).message }],
          };
        }
      },
    );
  }
  server.registerTool(
    "show_time_picker",
    {
      title: "Choose a demo time",
      description:
        "Show an interactive demo time picker for fictional treatments. Selecting a time does not create a booking. Search up to 28 days from today. Omit staffId when changing serviceId.",
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
              text: `${result.service.name}, ${result.service.duration} minutes, ${result.service.priceOre / 100} SEK with ${result.selectedStaff.name}. ${result.date}: ${result.slots.map(({ start }) => start).join(", ") || "No available times on this date. Try the next day."} ${result.notice}`,
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
        title: "Confirm a test booking",
        description:
          "Create an explicitly confirmed local test booking for a fixed fictional customer. Retry with the same clientRequestId and payload. No payments or messages.",
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
                text: `Test booking created: ${result.serviceName}, ${result.startsAt}. Booking ID ${result.id}.`,
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
                  failure.message === "That time is no longer available. Choose another time."
                    ? "slot_unavailable"
                    : failure.message ===
                        "Check the previous booking attempt first."
                      ? "previous_attempt_pending"
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
      description: "List demo treatments without customer data",
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
