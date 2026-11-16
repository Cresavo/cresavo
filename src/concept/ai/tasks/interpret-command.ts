import { z } from "zod";
import { interpretCommand } from "../../intent";
import { defineTask, textField } from "../task";

const person = z.object({ id: textField, name: textField });
export const intentContextSchema = z.object({
  customers: z.array(person).max(1000), staff: z.array(person).max(100),
  services: z.array(person.extend({ durationMin: z.number().positive(), priceSek: z.number().nonnegative() })).max(200),
  bookings: z.array(z.object({ id: textField, customerId: textField, staffId: textField, serviceId: textField, start: z.iso.datetime({ offset: true }) })).max(5000),
  now: z.iso.datetime({ offset: true }), timezone: z.string().optional(),
});
const params = z.object({
  customerId: z.string().optional(), serviceId: z.string().optional(), staffId: z.string().optional(), bookingId: z.string().optional(),
  date: z.iso.date().optional(), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  period: z.enum(["morning", "afternoon"]).optional(), start: z.iso.date().optional(), end: z.iso.date().optional(), since: z.iso.date().optional(),
  percentOff: z.number().min(0).max(100).optional(), priceSek: z.number().nonnegative().optional(), offerWaitingList: z.boolean().optional(), product: z.string().optional(), occasion: z.string().optional(),
}).strict();
const common = { params, summary: textField, confidence: z.number().min(0).max(1) };
export const intentOutputSchema = z.union([
  z.object({ ...common, action: z.enum(["book", "move", "cancel", "campaign", "revenue", "inactive-customers", "order-stock", "make-poster", "change-price"]) }).strict(),
  z.object({ ...common, action: z.literal("question"), question: textField }).strict(),
]);
export const interpretCommandTask = defineTask({
  id: "interpret-command", version: 1, tier: "fast",
  prompt: "Interpret an English salon command as a proposal. Use only IDs in context. Never execute changes. Ask a question when a customer, appointment or required parameter is unclear. Dates use the salon timezone; end dates are exclusive. Return JSON matching the schema.",
  input: z.object({ text: textField, context: intentContextSchema }).strict(), output: intentOutputSchema,
  fallback: ({ text, context }) => interpretCommand(text, context),
});
