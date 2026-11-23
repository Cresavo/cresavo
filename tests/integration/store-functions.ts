import { readFileSync } from "node:fs";
import pg from "pg";

// The store's SECURITY DEFINER functions (migration store_rls_policies, between
// its STORE FUNCTIONS markers) installed into a test's private schema, bound to
// that schema's cloned tables. Tests that clone the store tables call this after
// creating them, so the outbox and the sweeps work on the clones.
const migration = readFileSync(new URL("../../prisma/migrations/20261122160000_store_rls_policies/migration.sql", import.meta.url), "utf8");
const block = migration.slice(migration.indexOf("-- STORE FUNCTIONS BEGIN"), migration.indexOf("-- STORE FUNCTIONS END"));

export async function installStoreFunctions(schema: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) throw new Error("schema name");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`SET search_path = ${schema}, pg_temp; ${block.replaceAll("SET search_path = public, pg_temp", `SET search_path = ${schema}, pg_temp`)}`);
  } finally {
    await client.end();
  }
}
