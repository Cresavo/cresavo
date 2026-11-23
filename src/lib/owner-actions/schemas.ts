import type { z } from "zod";
import { assistantSchemas } from "./assistant";
import { bookingSchemas } from "./bookings";
import { campaignSchemas } from "./campaigns";
import { catalogueSchemas } from "./catalogue";
import { contentSchemas } from "./content";
import { customerSchemas } from "./customers";
import { financeSchemas } from "./finance";
import { scheduleSchemas } from "./schedule";
import { settingsSchemas } from "./settings";
import type { OwnerActionType } from "./types";

/**
 * One strict schema per owner action type. A type without a schema, or a schema
 * for a type the owner may not send, fails `tsc`.
 */
export const OWNER_ACTION_SCHEMAS = {
  ...assistantSchemas,
  ...bookingSchemas,
  ...campaignSchemas,
  ...catalogueSchemas,
  ...contentSchemas,
  ...customerSchemas,
  ...financeSchemas,
  ...scheduleSchemas,
  ...settingsSchemas,
} satisfies Record<OwnerActionType, z.ZodType>;
