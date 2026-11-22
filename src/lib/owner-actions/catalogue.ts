import { z } from "zod";
import { DURATION_STEP, MAX_DESCRIPTION, MAX_DURATION, MAX_NAME as MAX_SERVICE_NAME, MIN_DURATION, validServicePrice } from "@/concept/services/edit";
import { MAX_INTERVAL_WEEKS, MIN_INTERVAL_WEEKS } from "@/concept/customers/return-visits";
import { direction, id, idList, list, required, staffId, text } from "./primitives";

// The price list: treatments and their headings.

const price = z.number().refine(validServicePrice, "Not a valid price");

const draft = z.strictObject({
  name: required(MAX_SERVICE_NAME),
  category: id,
  duration: z.number().int().min(MIN_DURATION).max(MAX_DURATION).multipleOf(DURATION_STEP),
  price,
  description: text(MAX_DESCRIPTION),
  staffIds: list(staffId, 50),
});

export const catalogueSchemas = {
  "service/add": z.strictObject({ type: z.literal("service/add"), service: draft }),
  "service/update": z.strictObject({ type: z.literal("service/update"), id, service: draft }),
  "service/visibility": z.strictObject({ type: z.literal("service/visibility"), id, hidden: z.boolean() }),
  "service/duplicate": z.strictObject({ type: z.literal("service/duplicate"), id, name: required() }),
  "service/delete": z.strictObject({ type: z.literal("service/delete"), id }),
  "service/move": z.strictObject({ type: z.literal("service/move"), id, direction }),
  "service/reorder": z.strictObject({ type: z.literal("service/reorder"), category: id, ids: idList() }),
  "service/price": z.strictObject({ type: z.literal("service/price"), id, price }),
  "service/recall": z.strictObject({
    type: z.literal("service/recall"), id, weeks: z.number().int().min(MIN_INTERVAL_WEEKS).max(MAX_INTERVAL_WEEKS),
  }),
  "category/add": z.strictObject({ type: z.literal("category/add"), name: required(MAX_SERVICE_NAME) }),
  "category/rename": z.strictObject({ type: z.literal("category/rename"), id, name: required(MAX_SERVICE_NAME) }),
  "category/remove": z.strictObject({ type: z.literal("category/remove"), id }),
  "category/move": z.strictObject({ type: z.literal("category/move"), id, direction }),
  "category/reorder": z.strictObject({ type: z.literal("category/reorder"), ids: idList() }),
};
