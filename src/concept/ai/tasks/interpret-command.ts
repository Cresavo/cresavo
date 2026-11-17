import { z } from "zod";
import { interpretCommand } from "../../intent";
import { defineTask, textField } from "../task";

const person = z.object({ id: textField, name: textField });
export const intentContextSchema = z.object({
  customers: z.array(person).max(1000), staff: z.array(person).max(100),
  services: z.array(person.extend({ durationMin: z.number().positive(), priceSek: z.number().nonnegative() })).max(200),
  bookings: z.array(z.object({ id: textField, customerId: textField, staffId: textField, serviceId: textField, start: z.iso.datetime({ offset: true }) })).max(5000),
  now: z.iso.datetime({ offset: true }), timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }).optional(),
});
const params = z.object({
  customerId: z.string().optional(), serviceId: z.string().optional(), staffId: z.string().optional(), bookingId: z.string().optional(),
  date: z.iso.date().optional(), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  period: z.enum(["morning", "afternoon"]).optional(), start: z.iso.date().optional(), end: z.iso.date().optional(), since: z.iso.date().optional(),
  percentOff: z.number().min(0).max(100).optional(), priceSek: z.number().nonnegative().optional(), offerWaitingList: z.boolean().optional(), product: z.string().optional(), quantity: z.number().int().positive().optional(), occasion: z.string().optional(),
}).strict();
const common = { params, summary: textField, confidence: z.number().min(0).max(1) };
export const intentOutputSchema = z.union([
  z.object({ ...common, action: z.literal("book"), params: z.union([
    params.required({ customerId: true, serviceId: true, date: true, time: true }),
    params.required({ customerId: true, serviceId: true, date: true, period: true }),
  ]) }).strict(),
  z.object({ ...common, action: z.literal("move"), params: params.required({ bookingId: true, date: true, time: true }) }).strict(),
  z.object({ ...common, action: z.literal("cancel"), params: params.required({ bookingId: true }) }).strict(),
  z.object({ ...common, action: z.literal("campaign"), params: params.required({ serviceId: true, percentOff: true, priceSek: true, start: true, end: true }) }).strict(),
  z.object({ ...common, action: z.literal("revenue"), params: params.required({ start: true, end: true }) }).strict(),
  z.object({ ...common, action: z.literal("inactive-customers"), params: params.required({ since: true }) }).strict(),
  z.object({ ...common, action: z.literal("order-stock"), params: params.required({ product: true }) }).strict(),
  z.object({ ...common, action: z.literal("sell-product"), params: params.required({ customerId: true, product: true }) }).strict(),
  z.object({ ...common, action: z.literal("stock-level"), params: params.required({ product: true }) }).strict(),
  z.object({ ...common, action: z.literal("make-poster"), params: params.required({ occasion: true }) }).strict(),
  z.object({ ...common, action: z.literal("change-price"), params: params.required({ serviceId: true, priceSek: true }) }).strict(),
  z.object({ ...common, action: z.literal("question"), question: textField }).strict(),
]);
export const interpretCommandTask = defineTask({
  id: "interpret-command", version: 1, tier: "fast",
  prompt: "Interpret an English salon command as a proposal. Use only IDs in context. Never execute changes. A product sale needs a customer from the context; a stock question names the product. Ask a question when a customer, appointment or required parameter is unclear. Dates use the salon timezone; end dates are exclusive. Return JSON matching the schema.",
  input: z.object({ text: textField, context: intentContextSchema }).strict(), output: intentOutputSchema,
  fallback: ({ text, context }) => intentOutputSchema.parse(interpretCommand(text, context)),
});
