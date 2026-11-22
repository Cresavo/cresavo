import { z } from "zod";
import { dateSchema } from "@/lib/validation";
import type { StaffId } from "@/concept/data/types";

// Building blocks shared by the owner action schemas. Every string and number
// has an upper bound, so no field can carry more than the studio ever sends.

export const MAX_NAME = 120;
export const MAX_TEXT = 2000;
const MAX_ID = 80;
const MAX_LIST = 200;
const MAX_MONEY = 1_000_000;

/** PostgreSQL cannot store NUL characters or lone surrogates in jsonb. */
const storable = (value: string) => !value.includes("\0") && value.isWellFormed();

/** A name, label or required text; never empty. */
export const required = (max = MAX_NAME) => z.string().min(1).max(max).refine(storable, "Not storable text");

/** Free text such as a note or a message; may be empty. */
export const text = (max = MAX_TEXT) => z.string().max(max).refine(storable, "Not storable text");

/** Ids a caller assigns itself must be UUIDs, so they can never collide with the studio's own `b-12` and `k-7` ids. */
export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

/** The ids the studio makes (`b-12`, `staff-3`, UUIDs, `stock-x-2026-11-22`). */
export const id = z.string().min(1).max(MAX_ID).regex(/^[A-Za-z0-9_.:-]+$/);

export const staffId = z.union([
  z.enum(["anna", "erik"]),
  z.string().regex(/^staff-\d{1,9}$/).pipe(z.custom<`staff-${number}`>()),
]) satisfies z.ZodType<StaffId>;

/** A real calendar day, "YYYY-MM-DD". */
export const date = dateSchema;

/** Minutes from midnight; 1440 is the end of the day. */
export const minutes = z.number().int().min(0).max(1440);

/** Whole currency units. */
export const money = z.number().int().min(0).max(MAX_MONEY);

/** An amount of stock, possibly fractional (a fifth of a tube). */
export const quantity = z.number().min(0).max(100_000);

export const percent = z.number().int().min(0).max(100);

/** A moment as epoch milliseconds. */
export const epochMs = z.number().int().min(0).max(8.64e15);

export const list = <T extends z.ZodType>(item: T, max = MAX_LIST) => z.array(item).max(max);

export const idList = (max = MAX_LIST) => list(id, max);

export const direction = z.enum(["up", "down"]);

/** "YYYY-MM-DD HH:MM": a real day and a time from 00:00 to 23:59. */
export const daySlot = z.string().regex(/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/).refine((value) => date.safeParse(value.slice(0, 10)).success, "Not a real day");
