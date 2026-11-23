import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** @param {import("pg").ClientBase} client @param {"ordinary" | "sandbox"} [mode] */
export async function assertDatabaseMode(client, mode = "ordinary") {
  const { rows: [row] } = await client.query(
    "SELECT to_regclass('cresavo_sandbox.installation') IS NOT NULL AS marked",
  );
  if (row?.marked !== (mode === "sandbox")) throw new Error("BOOKING_DATABASE_MODE_MISMATCH");
}

/**
 * @param {string | undefined} [connectionString]
 * @param {number} [max]
 * @param {"ordinary" | "sandbox"} [mode]
 */
export function createDatabaseClient(
  connectionString = process.env.DATABASE_URL,
  max = 5,
  mode = "ordinary",
) {
  if (process.env.PUBLIC_READONLY === "1") throw new Error("PUBLIC_READONLY_DATABASE_DISABLED");
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
    max,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    onConnect: client => assertDatabaseMode(client, mode),
  });
  return new PrismaClient({ adapter });
}
