import { z } from "zod";
import { MAX_TICKET_QUESTION } from "@/concept/support/tickets";
import { MAX_SMS_PRICE_ORE } from "@/concept/booking/reminders";
import { validPolicy } from "@/concept/booking/protection";
import { SALON_DETAIL_MAX_LENGTH } from "@/concept/ops/salon-details";
import { epochMs, id, idList, list, required, text } from "./primitives";

// Settings, support access, help requests, the trash and undo.

const MAX_PATH = 500;
const MAX_DEPOSITS = 200;
const policyNumber = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const policy = z.strictObject({
  version: policyNumber,
  freeHours: policyNumber,
  latePercent: policyNumber,
  noShowPercent: policyNumber,
  payAtSalonDefault: z.boolean(),
  payAtSalon: z.record(id, z.boolean()).refine((choices) => Object.keys(choices).length <= MAX_DEPOSITS, "Too many treatments"),
  deposits: z.record(id, policyNumber).refine((deposits) => Object.keys(deposits).length <= MAX_DEPOSITS, "Too many deposits"),
  newCustomersOnly: z.boolean(),
  exemptServices: idList(),
}).refine(validPolicy, "Not a valid cancellation policy");

const details = z.strictObject({
  name: text(SALON_DETAIL_MAX_LENGTH.name).optional(),
  phone: text(SALON_DETAIL_MAX_LENGTH.phone).optional(),
  email: text(SALON_DETAIL_MAX_LENGTH.email).optional(),
  address: text(SALON_DETAIL_MAX_LENGTH.address).optional(),
  area: text(SALON_DETAIL_MAX_LENGTH.area).optional(),
});

const ticket = z.strictObject({
  createdAt: epochMs,
  question: required(MAX_TICKET_QUESTION),
  path: text(MAX_PATH),
  requestId: id,
  screen: list(text(200), 100),
  activity: list(z.strictObject({ at: epochMs, actor: z.enum(["owner", "staff", "ai", "customer", "integration"]), summary: text(500) }), 20),
});

const moduleKey = z.enum(["journal", "stock", "campaigns", "finance", "reviews", "waitlist", "assistant", "giftcards", "packages", "domain"]);

export const settingsSchemas = {
  "salon/language": z.strictObject({ type: z.literal("salon/language"), language: z.enum(["en", "sv"]), bilingual: z.boolean() }),
  "salon/policy": z.strictObject({ type: z.literal("salon/policy"), policy }),
  "salon/details": z.strictObject({ type: z.literal("salon/details"), details }),
  "reminder/settings": z.strictObject({
    type: z.literal("reminder/settings"),
    settings: z.strictObject({ channel: z.enum(["sms", "email"]).optional(), smsPriceOre: z.number().int().min(0).max(MAX_SMS_PRICE_ORE).optional() }),
  }),
  "privacy/journal-retention": z.strictObject({ type: z.literal("privacy/journal-retention"), years: z.number().int().min(1).max(30).nullable() }),
  "module/toggle": z.strictObject({ type: z.literal("module/toggle"), key: moduleKey }),
  "module/preset": z.strictObject({ type: z.literal("module/preset"), preset: z.enum(["essentials", "everything"]) }),
  "card/dismiss": z.strictObject({ type: z.literal("card/dismiss"), id }),
  "support/grant": z.strictObject({ type: z.literal("support/grant"), hours: z.union([z.literal(1), z.literal(24)]), at: epochMs }),
  "support/revoke": z.strictObject({ type: z.literal("support/revoke"), at: epochMs }),
  "ticket/create": z.strictObject({ type: z.literal("ticket/create"), ticket }),
  "trash/restore": z.strictObject({ type: z.literal("trash/restore"), id }),
  "log/undo": z.strictObject({ type: z.literal("log/undo"), id }),
};
