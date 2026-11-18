import { isPublicReadonly } from "../lib/public-readonly";
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
  if (workdayCard && !isPublicReadonly()) {
    registerOwnerCard(server);
    server.server.onclose = () => {
      if (isPublicReadonly()) return;
      void db.$disconnect().catch(() => console.error("MCP_DISCONNECT_FAILED"));
    };
    return server;
  }
  server.registerTool(
    "list_services",
    {
      description: "List the demo salon’s treatments",
      inputSchema: z.object({}),
    },
    async () => reply(() => listServices()),
  );
  server.registerTool(
    "get_availability",
    {
      description:
        "List available times for a treatment on a local date (YYYY-MM-DD)",
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
  if (admin && !isPublicReadonly()) {
    if (capacityOnly) {
      registerCapacityTools(server, allowWorkspace);
    } else {
      registerWorkspaceTools(server, allowWorkspace);
      if (allowBookings || allowWorkspace) {
        server.registerTool(
          "create_booking",
          {
            description:
              "Create a confirmed fictional test booking. Requires a trusted local operator, an example.test customer address and a stable clientRequestId for retries. The local MCP channel shares a daily limit.",
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
            "List limited booking details for a date range. Trusted local administrators only.",
          inputSchema: bookingListSchema,
        },
        async (v) => reply(() => listBookingsForMcp(v)),
      );
      server.registerTool(
        "create_campaign_draft",
        {
          description:
            "Create an unpublished offer. Enter dates as YYYY-MM-DD. Publish it manually in the admin workspace.",
          inputSchema: campaignSchema,
        },
        async (v) => reply(() => createCampaign(v)),
      );
    }
  }
  server.server.onclose = () => {
    if (isPublicReadonly()) return;
    void db.$disconnect().catch(() => {
      console.error("MCP_DISCONNECT_FAILED");
    });
  };
  return server;
});
