import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { createDatabaseClient } from "../scripts/database.mjs";

it("kräver uttrycklig databas utan att autoläsa projektets .env", () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { createDatabaseClient } from './scripts/database.mjs';
       try { createDatabaseClient(); process.exitCode = 1; }
       catch (error) { console.log(error.message); }`,
    ],
    { env, encoding: "utf8", timeout: 10000 },
  );
  expect(child.status).toBe(0);
  expect(child.stdout.trim()).toBe("DATABASE_CONFIG_INVALID");
  expect(child.stderr).toBe("");
});

it("kan konstruera och stänga klient utan databasanslutning", async () => {
  const client = createDatabaseClient(
    "postgresql://synthetic@127.0.0.1:1/unreachable_test",
  );
  await expect(client.$disconnect()).resolves.toBeUndefined();
});

it.each(["not-a-url", "https://synthetic.invalid/database"])(
  "avvisar ogiltig databas-URL utan att spegla indata: %s",
  (url) => {
    expect(() => createDatabaseClient(url)).toThrow("DATABASE_CONFIG_INVALID");
  },
);
