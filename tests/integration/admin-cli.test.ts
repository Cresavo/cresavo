import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { mcpEnvironment } from "../../src/mcp/environment";
import { verifyAdminCredentials } from "../../src/lib/admin-accounts";
const marker = `cli-${randomUUID()}`;
const email = `${marker}@example.test`;
const password = "synthetic-cli-password-2026";
function run(args: string[], input = "") {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/admin.mts", ...args],
    {
      input,
      env: { ...mcpEnvironment(), NODE_ENV: "test" },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  expect(result.stdout + result.stderr).not.toMatch(
    /\$argon2|postgresql:|CANARY_SECRET|synthetic-cli-password/,
  );
  return result;
}
afterEach(async () => {
  const users = await db.adminUser.findMany({
    where: { email: { startsWith: marker } },
    select: { id: true },
  });
  await db.adminSession.deleteMany({
    where: { userId: { in: users.map((u) => u.id) } },
  });
  await db.adminUser.deleteMany({ where: { email: { startsWith: marker } } });
  await db.$disconnect();
});

it("creates, resets, and disables accounts via stdin without exposing secrets in arguments or output", async () => {
  expect(run(["create", email], `${password}\n${password}\n`).status).toBe(0);
  expect(await verifyAdminCredentials({ email, password })).not.toBeNull();
  const next = `${password}-next`;
  expect(run(["reset-password", email], `${next}\n${next}\n`).status).toBe(0);
  expect(await verifyAdminCredentials({ email, password })).toBeNull();
  expect(
    await verifyAdminCredentials({ email, password: next }),
  ).not.toBeNull();
  expect(run(["disable", email]).status).toBe(0);
  expect(await verifyAdminCredentials({ email, password: next })).toBeNull();
});

it("rejects extra arguments, short passwords, mismatches, and EOF without creating an account", async () => {
  for (const result of [
    run(["create", email, "CANARY_SECRET"]),
    run(["create", email], "short\nshort\n"),
    run(["create", email], `${password}\ndifferent\n`),
    run(["create", email]),
    run(["create", email], `${password}\n`),
  ])
    expect(result.status).toBe(1);
  expect(await db.adminUser.count({ where: { email } })).toBe(0);
});

it("prints a fixed reason for duplicate or missing accounts", () => {
  expect(run(["create", email], `${password}\n${password}\n`).status).toBe(0);
  const duplicate = run(["create", email], `${password}\n${password}\n`);
  expect(duplicate.status).toBe(1);
  expect(duplicate.stderr.trim()).toBe("ADMIN_ACCOUNT_EXISTS");
  const missing = run(["disable", `${marker}-missing@example.test`]);
  expect(missing.status).toBe(1);
  expect(missing.stderr.trim()).toBe("ADMIN_ACCOUNT_NOT_FOUND");
});
