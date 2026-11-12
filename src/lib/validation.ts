import { z } from "zod";
import { parseDay } from "./time";

export const dateSchema = z.string().refine((value) => {
  try {
    parseDay(value);
    return true;
  } catch {
    return false;
  }
}, "Ogiltigt datum");

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);
