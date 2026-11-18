import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { createDatabaseClient } from "../scripts/database.mjs";

it("requires an explicit database URL without automatically loading the project .env file", () => {
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

it("can create and close the client without a database connection", async () => {
  const client = createDatabaseClient(
    "postgresql://synthetic@127.0.0.1:1/unreachable_test",
  );
  await expect(client.$disconnect()).resolves.toBeUndefined();
});

it.each(["not-a-url", "https://synthetic.invalid/database"])(
  "rejects an invalid database URL without echoing it (%s)",
  (url) => {
    expect(() => createDatabaseClient(url)).toThrow("DATABASE_CONFIG_INVALID");
  },
);
