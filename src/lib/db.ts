import type { PrismaClient } from "@prisma/client";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { assertWritable, isPublicReadonly } from "./public-readonly";
const globalDb = globalThis as unknown as { bookingDb?: PrismaClient };
// In preview, never construct a client, even if a URL or cached client exists.
const client = isPublicReadonly() ? {} as PrismaClient
  : globalDb.bookingDb ?? createDatabaseClient();
if (!isPublicReadonly() && process.env.NODE_ENV !== "production") globalDb.bookingDb = client;
export const db = new Proxy(client, {
  get(target, property) {
    assertWritable();
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
