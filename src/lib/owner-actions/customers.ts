import { z } from "zod";
import { FIELD_LIMIT, MAX_IMPORT_ROWS } from "@/concept/customers/csv";
import { date, id, list, required, staffId, text } from "./primitives";

// Customers, their notes and journal entries.

const MAX_PHOTO = 500;

const customer = z.strictObject({
  firstName: required(FIELD_LIMIT.firstName),
  lastName: text(FIELD_LIMIT.lastName),
  phone: text(FIELD_LIMIT.phone),
  email: text(FIELD_LIMIT.email),
  category: required(80),
  preferredStaff: staffId,
  since: date,
  birthday: date.optional(),
  isRegular: z.boolean(),
  note: text(FIELD_LIMIT.note).optional(),
  tags: list(required(40), 20),
  waitlist: z.boolean(),
  example: z.literal(true).optional(),
});

const journalContent = z.strictObject({
  treatment: text(),
  observations: text(),
  advice: text(),
  nextVisit: text().optional(),
  photos: z.strictObject({ before: text(MAX_PHOTO).optional(), after: text(MAX_PHOTO).optional() }).optional(),
});

export const customerSchemas = {
  "customer/delete": z.strictObject({ type: z.literal("customer/delete"), id }),
  "customer/note": z.strictObject({ type: z.literal("customer/note"), id, note: text() }),
  "customers/import": z.strictObject({ type: z.literal("customers/import"), customers: list(customer, MAX_IMPORT_ROWS) }),
  "journal/add": z.strictObject({
    type: z.literal("journal/add"),
    entry: journalContent.extend({ customerId: id, bookingId: id.optional(), date, staffId }),
  }),
  "journal/edit": z.strictObject({ type: z.literal("journal/edit"), id, content: journalContent, on: date }),
};
