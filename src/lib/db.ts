import type { PrismaClient } from "@prisma/client";
import { createDatabaseClient } from "../../scripts/database.mjs";
const globalDb = globalThis as unknown as { bookingDb?: PrismaClient };
export const db = globalDb.bookingDb ?? createDatabaseClient();
if (process.env.NODE_ENV !== "production") globalDb.bookingDb = db;
