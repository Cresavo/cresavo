import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { bookingListSchema, listServices } from "../lib/domain";
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
import { LOCAL_WORKSPACE_ACTOR as actor } from "../lib/workspace-write";
import { dateSchema, idempotencyKeySchema } from "../lib/validation";
import { safeToolSchema, reply } from "./reply";

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
export function registerWorkspaceTools(
  server: McpServer,
  allowWrites: boolean,
) {
  server.registerTool(
    "list_workspace_services",
    {
      description:
        "Högst 50 tjänster, inklusive inaktiva och deras redigeringsversion. Endast lokal administratör.",
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
        "Högst 20 medarbetare, tjänsttilldelning, aktiv status och version. Inga kunduppgifter eller fullständiga scheman.",
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
        "Veckoschema och datumundantag för högst 31 dagar i Stockholm, en medarbetare.",
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
        "Läs en medarbetares kompletta redigeringsunderlag: version, tjänsttilldelning, högst 7 veckodagar och 60 datumundantag. Använd detta före ersättning av exceptions; tidsfönstret i get_staff_schedule är inte hela konfigurationen.",
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
        "Minimerad kalender med status/version. Högst 31 dagar och 100 bokningar/sida. Inga kundnamn eller e-post.",
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
        "Bokningens lagrade behandling, tid, status/version och senaste 20 händelser. Inga kundnamn eller e-post.",
      inputSchema: safeToolSchema(z.object({ id }).strict()),
    },
    async (v) => reply(() => getBooking(v.id)),
  );
  server.registerTool(
    "get_move_availability",
    {
      description:
        "Lediga tider för en befintlig boknings lagrade längd/buffert, en utförare och ett datum i Stockholm.",
      inputSchema: safeToolSchema(
        z.object({ id, staffId: id, date: dateSchema }).strict(),
      ),
    },
    async (v) => reply(() => getMoveAvailability(v.id, v.date, v.staffId)),
  );
  if (!allowWrites) return;
  server.registerTool(
    "move_booking",
    {
      description:
        "Flytta syntetisk bokning atomärt. Kräver aktuell version, stabil clientRequestId och confirmed=true. Endast uttryckligt lokalt skrivläge.",
      inputSchema: safeToolSchema(mcpMoveSchema),
    },
    async (v) =>
      reply(() => moveBooking(mutationInput(v), v.clientRequestId, actor)),
  );
  server.registerTool(
    "cancel_booking",
    {
      description:
        "Avboka spårbart, frigör tid och behåll historik. Aktuell version och stabil clientRequestId krävs. confirmed är inte mänskligt samtycke.",
      inputSchema: safeToolSchema(mcpCancelSchema),
    },
    async (v) =>
      reply(() => cancelBooking(mutationInput(v), v.clientRequestId, actor)),
  );
  server.registerTool(
    "save_service",
    {
      description:
        "Skapa, ändra eller inaktivera tjänst. Befintlig tjänst kräver id/expectedVersion. Pris i ören; gamla bokningar bevaras. Stabil clientRequestId och confirmed=true krävs.",
      inputSchema: safeToolSchema(mcpServiceSchema),
    },
    async (v) =>
      reply(() => saveService(mutationInput(v), v.clientRequestId, actor)),
  );
  server.registerTool(
    "save_staff",
    {
      description:
        "Skapa/ändra/inaktivera syntetisk personal och ersätt veckoschema. Datumundantag ersätts bara om fältet skickas; inga medicinska skäl. Aktuell version och stabil clientRequestId krävs.",
      inputSchema: safeToolSchema(mcpStaffSchema),
    },
    async (v) =>
      reply(() => saveStaff(mutationInput(v), v.clientRequestId, actor)),
  );
}
