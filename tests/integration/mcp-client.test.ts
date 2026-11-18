import { afterAll, afterEach, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { db } from "../../src/lib/db";
import { mcpEnvironment } from "../../src/mcp/environment";

const keys = new Set<string>();
async function runClient(book: boolean, answer: string | null = null) {
  return new Promise<{ code: number | null; output: string; errors: string }>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          "--env-file-if-exists=.env",
          "--import",
          "tsx",
          "src/mcp/client.ts",
          ...(book ? ["--admin", "--book"] : []),
        ],
        {
          env: { ...mcpEnvironment({ booking: book }), NODE_ENV: "test" },
          stdio: "pipe",
        },
      );
      let output = "",
        errors = "",
        answered = false;
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("MCP_CLIENT_TEST_TIMEOUT"));
      }, 20000);
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
        const key = output.match(/Booking key: ([a-f0-9-]{36})/)?.[1];
        if (key) keys.add(key);
        if (book && !answered && output.includes("Type ja to confirm the test booking")) {
          answered = true;
          child.stdin.end(answer === null ? undefined : `${answer}\n`);
        }
      });
      child.stderr.on("data", (chunk) => {
        errors += String(chunk);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve({ code, output, errors });
      });
      if (!book) child.stdin.end();
    },
  );
}
afterEach(async () => {
  await db.booking.deleteMany({
    where: { businessId: "demo", idempotencyKey: { in: [...keys] } },
  });
  keys.clear();
});
afterAll(async () => {
  await db.$disconnect();
});

it("the default client is read-only and receives only allowlisted environment variables", async () => {
  const before = await db.booking.count();
  const campaigns = await db.campaign.count();
  const result = await runClient(false);
  expect(result.code).toBe(0);
  expect(result.output).not.toContain("create_booking");
  expect(await db.booking.count()).toBe(before);
  expect(await db.campaign.count()).toBe(campaigns);
  expect(mcpEnvironment().SESSION_SECRET).toBeUndefined();
  expect(mcpEnvironment({ booking: true }).SESSION_SECRET).toBe(
    process.env.SESSION_SECRET,
  );
  expect(mcpEnvironment({ booking: true }).ADMIN_PASSWORD).toBeUndefined();
}, 30000);

it.each(["nej", null])(
  "the test client stops without writing for %s",
  async (answer) => {
    const before = await db.booking.count();
    const result = await runClient(true, answer);
    expect(result.code).toBe(0);
    expect(result.output).toContain("Cancelled before creating the booking.");
    expect(await db.booking.count()).toBe(before);
  },
  30000,
);

it("the test client requires confirmation after the summary and prints a minimized result", async () => {
  const result = await runClient(true, "ja");
  expect(result.code).toBe(0);
  expect(result.output).toContain("Test booking: Fotvård");
  expect(result.output).toContain("(Europe/Stockholm)");
  expect(result.output).toContain("Syntetisk MCP-testkund (example.test)");
  expect(result.output).not.toMatch(
    /mcp-demo-.*@example.test|customerEmail|SESSION_SECRET|ADMIN_PASSWORD/,
  );
  expect(result.errors).not.toContain("MCP_CLIENT_FAILED");
  expect(keys.size).toBe(1);
  const rows = await db.booking.findMany({
    where: { idempotencyKey: { in: [...keys] } },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0].customerEmail).toBe(`mcp-demo-${[...keys][0]}@example.test`);
  expect(result.output).toContain(rows[0].id);
}, 30000);
