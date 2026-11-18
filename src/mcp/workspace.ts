import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  bookingListSchema,
  campaignSchema,
  createCampaign,
  listServices,
} from "../lib/domain";
import { listCalendar, calendarSchema } from "../lib/calendar";
import {
  getBooking,
  getMoveAvailability,
  moveBooking,
  cancelBooking,
  moveBookingSchema,
  cancelBookingSchema,
} from "../lib/booking-mutations";
import {
  listStaff,
  getStaff,
  saveService,
  saveStaff,
  serviceEditSchema,
  staffEditSchema,
} from "../lib/workspace-config";
import {
  LOCAL_WORKSPACE_ACTOR as actor,
  workspaceWrite,
} from "../lib/workspace-write";
import { dateSchema, idempotencyKeySchema } from "../lib/validation";
import { safeToolSchema, reply } from "./reply";
import {
  capacityListSchema,
  capacitySourceSchema,
  capacityDraftSchema,
  listCapacity,
  inspectCapacity,
  decideCapacity,
} from "../lib/capacity";

const id = z.string().min(1).max(128);
const writeFields = {
  clientRequestId: idempotencyKeySchema,
  confirmed: z.literal(true),
};
export const mcpMoveSchema = moveBookingSchema.extend(writeFields).strict();
export const mcpCancelSchema = cancelBookingSchema.extend(writeFields).strict();
export const mcpServiceSchema = serviceEditSchema.safeExtend(writeFields);
export const mcpStaffSchema = staffEditSchema.safeExtend(writeFields);
export const staffScheduleSchema = z
  .object({ staffId: id, from: dateSchema, to: dateSchema })
  .strict()
  .refine(
    (v) => bookingListSchema.safeParse({ from: v.from, to: v.to }).success,
  );
export function workspaceModeAllowed(
  args: string[],
  secret: string | undefined,
) {
  const enabled = args.includes("--allow-workspace");
  if (enabled && (!args.includes("--admin") || !secret || secret.length < 32))
    throw new Error("MCP_WORKSPACE_CONFIG_INVALID");
  return enabled;
}

function mutationInput(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => key !== "confirmed" && key !== "clientRequestId",
    ),
  );
}

// Called only in trusted local --admin mode. It never opens a network listener.
export function registerCapacityTools(server: McpServer, allowWrites: boolean) {
  server.registerTool(
    "list_capacity_suggestions",
    {
      description:
        "List cancellations within up to seven local days, current availability and saved decisions. Up to 20 per page without customer details. Use nextCursor as cursor with the same date range. Local administrators only.",
      inputSchema: safeToolSchema(capacityListSchema),
    },
    async (v) => reply(() => listCapacity(v, actor)),
  );
  server.registerTool(
    "inspect_capacity_suggestion",
    {
      description:
        "Check whether a suggestion is still current before opening the calendar. This does not reserve a time.",
      inputSchema: safeToolSchema(capacitySourceSchema),
    },
    async (v) => reply(() => inspectCapacity(v, actor)),
  );
  if (allowWrites) {
    const dismissSchema = capacitySourceSchema.extend(writeFields).strict();
    const draftSchema = capacityDraftSchema.extend(writeFields).strict();
    server.registerTool(
      "dismiss_capacity_suggestion",
      {
        description:
          "Permanently dismiss a current suggestion. Requires trusted local --admin --allow-workspace. The confirmed flag records the client’s assertion of approval.",
        inputSchema: safeToolSchema(dismissSchema),
      },
      async (v) =>
        reply(() =>
          decideCapacity(mutationInput(v), v.clientRequestId, actor, "dismiss"),
        ),
    );
    server.registerTool(
      "create_capacity_campaign_draft",
      {
        description:
          "Save up to one campaign draft per suggestion. Requires explicit terms and a discount. Applies to the service across all staff and times in the date range. This does not reserve a time, publish or send anything. Requires trusted local --admin --allow-workspace. The confirmed flag alone does not establish human approval.",
        inputSchema: safeToolSchema(draftSchema),
      },
      async (v) =>
        reply(() =>
          decideCapacity(mutationInput(v), v.clientRequestId, actor, "draft"),
        ),
    );
  }
}

export function registerWorkspaceTools(
  server: McpServer,
  allowWrites: boolean,
) {
  registerCapacityTools(server, allowWrites);
  server.registerTool(
    "list_workspace_services",
    {
      description:
        "List up to 50 services, including inactive services and their edit versions. Local administrators only.",
      inputSchema: safeToolSchema(z.object({}).strict()),
    },
    async () =>
      reply(async () =>
        (await listServices(true)).map(
          ({ id, name, priceOre, duration, buffer, active, version }) => ({
            id,
            name,
            priceOre,
            duration,
            buffer,
            active,
            version,
          }),
        ),
      ),
  );
  server.registerTool(
    "list_staff",
    {
      description:
        "List up to 20 team members with service assignments, active status and version. Customer details and full schedules are excluded.",
      inputSchema: safeToolSchema(z.object({}).strict()),
    },
    async () =>
      reply(async () =>
        (await listStaff(undefined, true)).map(
          ({ id, name, serviceIds, active, version }) => ({
            id,
            name,
            serviceIds,
            active,
            version,
          }),
        ),
      ),
  );
  server.registerTool(
    "get_staff_schedule",
    {
      description:
        "Show a team member’s weekly schedule and date exceptions for up to 31 days in Stockholm.",
      inputSchema: safeToolSchema(staffScheduleSchema),
    },
    async (v) =>
      reply(async () => {
        const staff = await getStaff(v.staffId);
        return {
          id: staff.id,
          version: staff.version,
          active: staff.active,
          weekly: staff.weekly,
          exceptions: staff.exceptions.filter(
            (day) => day.date >= v.from && day.date <= v.to,
          ),
        };
      }),
  );
  server.registerTool(
    "get_staff_configuration",
    {
      description:
        "Read a team member’s full edit data, including version, service assignments, up to seven weekdays and 60 date exceptions. Use this before replacing exceptions. get_staff_schedule shows only a date range.",
      inputSchema: safeToolSchema(z.object({ staffId: id }).strict()),
    },
    async (v) =>
      reply(async () => {
        const { id, name, active, version, serviceIds, weekly, exceptions } =
          await getStaff(v.staffId);
        return { id, name, active, version, serviceIds, weekly, exceptions };
      }),
  );
  server.registerTool(
    "list_workspace_bookings",
    {
      description:
        "Read limited calendar details with status and version. Up to 31 days and 100 bookings per page. Customer names and emails are excluded.",
      inputSchema: safeToolSchema(calendarSchema),
    },
    async (v) =>
      reply(async () => {
        const result = await listCalendar(v);
        return {
          bookings: result.bookings.map(
            ({
              id,
              serviceId,
              staffId,
              startsAt,
              endsAt,
              status,
              version,
            }) => ({
              id,
              serviceId,
              staffId,
              startsAt,
              endsAt,
              status,
              version,
            }),
          ),
          nextCursor: result.nextCursor,
        };
      }),
  );
  server.registerTool(
    "get_booking",
    {
      description:
        "Read the saved treatment, time, status, version and last 20 events for a booking. Customer names and emails are excluded.",
      inputSchema: safeToolSchema(z.object({ id }).strict()),
    },
    async (v) => reply(() => getBooking(v.id)),
  );
  server.registerTool(
    "get_move_availability",
    {
      description:
        "List availability for the saved duration and buffer of an existing booking, for one team member and a date in Stockholm.",
      inputSchema: safeToolSchema(
        z.object({ id, staffId: id, date: dateSchema }).strict(),
      ),
    },
    async (v) => reply(() => getMoveAvailability(v.id, v.date, v.staffId)),
  );
  if (!allowWrites) return;
  server.registerTool(
    "create_campaign_draft",
    {
      description:
        "Save an unpublished offer after explicit approval. Requires --admin --allow-workspace, confirmed=true and a stable clientRequestId for safe retries. Enter dates as YYYY-MM-DD. Publish it manually in the admin workspace.",
      inputSchema: safeToolSchema(campaignSchema.safeExtend(writeFields)),
    },
    async (v) =>
      reply(() => {
        const input = mutationInput(v);
        return workspaceWrite(
          "create_campaign_draft",
          input,
          v.clientRequestId,
          actor,
          false,
          (tx) => createCampaign(input, tx),
        );
      }),
  );
  server.registerTool(
    "move_booking",
    {
      description:
        "Reschedule a fictional booking atomically. Requires the current version, a stable clientRequestId, confirmed=true and explicit local write mode.",
      inputSchema: safeToolSchema(mcpMoveSchema),
    },
    async (v) =>
      reply(() => moveBooking(mutationInput(v), v.clientRequestId, actor)),
  );
  server.registerTool(
    "cancel_booking",
    {
      description:
        "Cancel a booking, release its slot and retain its history. Requires the current version and a stable clientRequestId. The confirmed flag alone does not establish human consent.",
      inputSchema: safeToolSchema(mcpCancelSchema),
    },
    async (v) =>
      reply(() => cancelBooking(mutationInput(v), v.clientRequestId, actor)),
  );
  server.registerTool(
    "save_service",
    {
      description:
        "Create, edit or deactivate a service. Existing services require id and expectedVersion. Prices are in öre. Existing bookings are retained. Requires a stable clientRequestId and confirmed=true.",
      inputSchema: safeToolSchema(mcpServiceSchema),
    },
    async (v) =>
      reply(() => saveService(mutationInput(v), v.clientRequestId, actor)),
  );
  server.registerTool(
    "save_staff",
    {
      description:
        "Create, edit or deactivate fictional staff and replace their weekly schedule. Date exceptions are replaced only when provided. Exclude medical reasons. Requires the current version and a stable clientRequestId.",
      inputSchema: safeToolSchema(mcpStaffSchema),
    },
    async (v) =>
      reply(() => saveStaff(mutationInput(v), v.clientRequestId, actor)),
  );
}
