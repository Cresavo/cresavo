import { z } from "zod";
import { date, daySlot, id, list, minutes, required, staffId, text } from "./primitives";

// The assistant's memory and routines, and the texts it drafts.

const MAX_MEMORY = 500;
const MAX_TEXTS = 500;

const routine = z.strictObject({
  id: z.enum(["monday-reminders", "friday-stock"]),
  name: required(),
  description: text(),
  when: z.strictObject({ weekdays: list(z.number().int().min(0).max(6), 7), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  steps: list(text(500), 20),
  tools: list(required(60), 20),
  enabled: z.boolean(),
  createdOn: date,
  lastRun: daySlot,
});

export const assistantSchemas = {
  "memory/add": z.strictObject({
    type: z.literal("memory/add"),
    item: z.strictObject({
      text: required(MAX_MEMORY),
      kind: z.enum(["fact", "preference", "thread"]),
      customerId: id.optional(),
      staffId: staffId.optional(),
      savedOn: date,
      source: z.enum(["owner", "assistant"]),
    }),
  }),
  "memory/edit": z.strictObject({ type: z.literal("memory/edit"), id, text: required(MAX_MEMORY) }),
  "memory/forget": z.strictObject({ type: z.literal("memory/forget"), id }),
  "routine/add": z.strictObject({ type: z.literal("routine/add"), routine }),
  "routine/toggle": z.strictObject({ type: z.literal("routine/toggle"), id, at: daySlot }),
  "routine/ran": z.strictObject({ type: z.literal("routine/ran"), id, at: daySlot }),
  "customers/message": z.strictObject({
    type: z.literal("customers/message"),
    texts: list(z.strictObject({ customerId: id, title: required(), body: text(), recallServiceId: id.optional() }), MAX_TEXTS),
    at: z.strictObject({ date, time: minutes }),
  }),
};
