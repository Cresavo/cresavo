import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { bookingDb?: PrismaClient };
export const db = globalDb.bookingDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.bookingDb = db;
