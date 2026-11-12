import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** @param {string | undefined} [connectionString] */
export function createDatabaseClient(
  connectionString = process.env.DATABASE_URL,
) {
  if (!connectionString) throw new Error("DATABASE_CONFIG_INVALID");
  let url;
  try {
    url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error("DATABASE_CONFIG_INVALID");
  }
  // adapter-pg serialises Date parameters as UTC wall time without an offset.
  // Set the session timezone even when the server/operator defaults differ.
  const options = url.searchParams.get("options") ?? "";
  url.searchParams.set("options", `${options} -c timezone=UTC`.trim());
  const adapter = new PrismaPg({
    connectionString: url.href,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  return new PrismaClient({ adapter });
}
