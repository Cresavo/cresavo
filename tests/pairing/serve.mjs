// Fail before Next prepares the dev build if the socket is occupied or unavailable.
// Tests also wait for the real server's own listen callback after this probe.
import { createServer } from "node:net";
import { once } from "node:events";
import { assertTestDatabase } from "../../scripts/test-db-guard.mjs";

assertTestDatabase(process.env.DATABASE_URL);
if (process.env.PAIRING_DATABASE_URL !== process.env.DATABASE_URL)
  throw new Error("TEST_DATABASE_REFUSED: pairing and runner databases must match");

const probe = createServer();
probe.listen(Number(process.env.PORT), "127.0.0.1");
await once(probe, "listening");
await new Promise((resolve, reject) => probe.close(err => err ? reject(err) : resolve()));
await import("../../scripts/server.mjs");
