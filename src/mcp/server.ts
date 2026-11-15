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
  mcpWorkspaceBookingSchema,
  MCP_BOOKING_CLIENT,
} from "./booking";
import { reply, safeToolSchema } from "./reply";
import {
  registerCapacityTools,
  registerWorkspaceTools,
  workspaceModeAllowed,
} from "./workspace";
import { db } from "../lib/db";
import { LOCAL_WORKSPACE_ACTOR } from "../lib/workspace-write";
import { assertOwnerCard } from "./owner-card/data";
import { registerOwnerCard } from "./owner-card/register";
import { assertCardReplayChannel } from "../lib/booking-channel";
const workdayCard = process.argv.includes("--workday-card");
if (workdayCard) {
  try {
    assertOwnerCard();
  } catch {
    console.error("OWNER_CARD_DEMO_REFUSED");
    process.exit(1);
  }
}
const admin = process.argv.includes("--admin");
const capacityOnly = process.argv.includes("--capacity-only");
if (capacityOnly && (!admin || process.argv.includes("--allow-bookings"))) {
  console.error("MCP_CAPACITY_CONFIG_INVALID");
  process.exit(1);
}
let allowBookings = false;
let allowWorkspace = false;
try {
  allowBookings = bookingModeAllowed(process.argv, process.env.SESSION_SECRET);
} catch {
  console.error("MCP_BOOKING_CONFIG_INVALID");
  process.exit(1);
}
try {
  allowWorkspace = workspaceModeAllowed(
    process.argv,
    process.env.SESSION_SECRET,
  );
} catch {
  console.error("MCP_WORKSPACE_CONFIG_INVALID");
  process.exit(1);
}
serveStdio(() => {
  const server = new McpServer({ name: "booking-lab-se", version: "0.1.0" });
  if (workdayCard) {
    registerOwnerCard(server);
    server.server.onclose = () => {
      void db.$disconnect().catch(() => console.error("MCP_DISCONNECT_FAILED"));
    };
    return server;
  }
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
      inputSchema: safeToolSchema(
        z
          .object({
            serviceId: z.string().min(1).max(128),
            date: z.string(),
            staffId: z.string().min(1).max(128).optional(),
          })
          .strict(),
      ),
    },
    async (v) =>
      reply(() => getAvailability(v.serviceId, v.date, db, v.staffId)),
  );
  if (admin) {
    if (capacityOnly) {
      registerCapacityTools(server, allowWorkspace);
    } else {
      registerWorkspaceTools(server, allowWorkspace);
      if (allowBookings || allowWorkspace) {
        server.registerTool(
          "create_booking",
          {
            description:
              "Skapa en bekräftad syntetisk testbokning. Endast betrodd lokal operatör, example.test-kunder och stabil clientRequestId för retries. Gemensamt dagstak för den lokala MCP-kanalen.",
            inputSchema: allowWorkspace
              ? safeToolSchema(mcpWorkspaceBookingSchema)
              : mcpBookingToolSchema,
          },
          async (v: z.output<typeof mcpWorkspaceBookingSchema>) =>
            reply(async () => {
              const booking = await createBooking(
                v,
                v.clientRequestId,
                MCP_BOOKING_CLIENT,
                allowWorkspace ? LOCAL_WORKSPACE_ACTOR : undefined,
              );
              assertCardReplayChannel(booking, MCP_BOOKING_CLIENT);
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
  }
  server.server.onclose = () => {
    void db.$disconnect().catch(() => {
      console.error("MCP_DISCONNECT_FAILED");
    });
  };
  return server;
});
