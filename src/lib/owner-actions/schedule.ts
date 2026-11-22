import { z } from "zod";
import { date, id, idList, list, minutes, required, staffId } from "./primitives";

// Opening hours, closed days, staff schedules and resources.

const MAX_DATES = 366;
const weekday = z.string().regex(/^[0-6]$/);
const span = z.strictObject({ start: minutes, end: minutes });

export const scheduleSchemas = {
  "salon/hours": z.strictObject({
    type: z.literal("salon/hours"),
    hours: z.record(weekday, z.strictObject({ open: minutes, close: minutes }).nullable()),
    lunch: span.nullable(),
  }),
  "salon/close": z.strictObject({ type: z.literal("salon/close"), date, name: required() }),
  "salon/reopen": z.strictObject({ type: z.literal("salon/reopen"), id }),
  "staff/block": z.strictObject({
    type: z.literal("staff/block"), staffId, date, start: minutes, end: minutes, reason: z.enum(["break", "training", "admin"]),
  }),
  "staff/week": z.strictObject({ type: z.literal("staff/week"), staffId, week: z.record(weekday, span.nullable()) }),
  "staff/off": z.strictObject({
    type: z.literal("staff/off"), staffId, dates: list(date, MAX_DATES), reason: z.enum(["vacation", "sick", "other"]),
  }),
  "staff/shift": z.strictObject({ type: z.literal("staff/shift"), staffId, date, start: minutes, end: minutes }),
  "staff/exception-remove": z.strictObject({ type: z.literal("staff/exception-remove"), id }),
  "resource/add": z.strictObject({ type: z.literal("resource/add"), name: required(), kind: z.enum(["room", "chair", "equipment"]) }),
  "resource/rename": z.strictObject({ type: z.literal("resource/rename"), id, name: required() }),
  "resource/remove": z.strictObject({ type: z.literal("resource/remove"), id }),
  "service/resources": z.strictObject({ type: z.literal("service/resources"), id, resourceIds: idList() }),
};
