import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  listServices,
  getAvailability,
  listBookingsForMcp,
  bookingListSchema,
  campaignSchema,
  createCampaign,
  createBooking,
} from "../lib/domain";
import {
  bookingModeAllowed,
  mcpBookingToolSchema,
  MCP_BOOKING_CLIENT,
} from "./booking";
import { safeFailure } from "../lib/errors";
import { db } from "../lib/db";
const admin = process.argv.includes("--admin");
let allowBookings = false;
try {
  allowBookings = bookingModeAllowed(process.argv, process.env.SESSION_SECRET);
} catch {
  console.error("MCP_BOOKING_CONFIG_INVALID");
  process.exit(1);
}
async function reply(operation: () => Promise<unknown>) {
  try {
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(await operation()) },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: safeFailure(error).message }],
    };
  }
}
serveStdio(() => {
  const server = new McpServer({ name: "booking-lab-se", version: "0.1.0" });
  server.registerTool(
    "list_services",
    {
      description: "Lista demosalongens behandlingar",
      inputSchema: z.object({}),
    },
    async () => reply(() => listServices()),
  );
  server.registerTool(
    "get_availability",
    {
      description:
        "Lediga tider för en behandling och ett lokalt datum YYYY-MM-DD",
      inputSchema: z.object({ serviceId: z.string(), date: z.string() }),
    },
    async (v) => reply(() => getAvailability(v.serviceId, v.date)),
  );
  if (admin) {
    if (allowBookings) {
      server.registerTool(
        "create_booking",
        {
          description:
            "Skapa en bekräftad syntetisk testbokning. Endast betrodd lokal operatör, example.test-kunder och stabil clientRequestId för retries. Gemensamt dagstak för den lokala MCP-kanalen.",
          inputSchema: mcpBookingToolSchema,
        },
        async (v) =>
          reply(async () => {
            const booking = await createBooking(
              v,
              v.clientRequestId,
              MCP_BOOKING_CLIENT,
            );
            return {
              id: booking.id,
              serviceId: booking.serviceId,
              startsAt: booking.startsAt,
              endsAt: booking.endsAt,
            };
          }),
      );
    }
    server.registerTool(
      "list_bookings",
      {
        description:
          "Lista minimerade bokningar i ett datumintervall; endast betrodd lokal administratör",
        inputSchema: bookingListSchema,
      },
      async (v) => reply(() => listBookingsForMcp(v)),
    );
    server.registerTool(
      "create_campaign_draft",
      {
        description:
          "Skapa opublicerat erbjudande. Datum anges YYYY-MM-DD; publicering sker manuellt i administrationen.",
        inputSchema: campaignSchema,
      },
      async (v) => reply(() => createCampaign(v)),
    );
  }
  server.server.onclose = () => {
    void db.$disconnect().catch(() => {
      console.error("MCP_DISCONNECT_FAILED");
    });
  };
  return server;
});
