import { afterAll, afterEach, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { db } from "../../src/lib/db";
import { mcpEnvironment } from "../../src/mcp/environment";

const keys = new Set<string>(),
  services = new Set<string>(),
  staff = new Set<string>();
async function run(answers: readonly ("ja" | "nej" | null)[]) {
  return new Promise<{
    code: number | null;
    output: string;
    errors: string;
    prompts: number;
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--env-file-if-exists=.env",
        "--import",
        "tsx",
        "src/mcp/client.ts",
        "--admin",
        "--workspace",
      ],
      {
        env: { ...mcpEnvironment({ workspace: true }), NODE_ENV: "test" },
        stdio: "pipe",
      },
    );
    let output = "",
      errors = "",
      prompts = 0;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("MCP_WORKSPACE_CLIENT_TEST_TIMEOUT"));
    }, 25000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      for (const match of output.matchAll(/Åtgärdsnyckel: ([a-f0-9-]{36})/g))
        keys.add(match[1]);
      for (const match of output.matchAll(
        /\n(save_service|save_staff) (\{[^\n]+\})/g,
      )) {
        const value = JSON.parse(match[2]) as { id: string };
        (match[1] === "save_service" ? services : staff).add(value.id);
      }
      const count = [
        ...output.matchAll(
          /Bekräfta (?:save_service|save_staff|create_booking|move_booking|cancel_booking) genom att skriva ja:/g,
        ),
      ].length;
      while (prompts < count) {
        const answer = answers[prompts] ?? null;
        prompts++;
        if (answer === null) child.stdin.end();
        else child.stdin.write(`${answer}\n`);
      }
    });
    child.stderr.on("data", (chunk) => {
      errors += String(chunk);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, errors, prompts });
    });
  });
}
afterEach(async () => {
  await db.booking.deleteMany({
    where: { idempotencyKey: { in: [...keys] }, businessId: "demo" },
  });
  await db.workspaceRequest.deleteMany({
    where: {
      businessId: "demo",
      key: {
        in: [...keys].map((key) =>
          createHash("sha256")
            .update(`local-mcp:local-workspace-channel:v1:${key}`)
            .digest("hex"),
        ),
      },
    },
  });
  await db.staff.deleteMany({ where: { id: { in: [...staff] } } });
  await db.service.deleteMany({ where: { id: { in: [...services] } } });
  keys.clear();
  services.clear();
  staff.clear();
});
afterAll(async () => {
  await db.$disconnect();
});

it("nekar arbetsyteklienten utan admin och tillsammans med det äldre bokningsläget", () => {
  for (const flags of [["--workspace"], ["--admin", "--workspace", "--book"]]) {
    const result = spawnSync(
      process.execPath,
      ["--env-file-if-exists=.env", "--import", "tsx", "src/mcp/client.ts", ...flags],
      {
        env: { ...mcpEnvironment({ workspace: true }), NODE_ENV: "test" },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MCP_CLIENT_FAILED");
  }
}, 30000);

it("arbetsyteklienten skriver ingenting om operatören nekar första åtgärden", async () => {
  const before = {
    services: await db.service.count(),
    staff: await db.staff.count(),
    bookings: await db.booking.count(),
  };
  const result = await run(["nej"]);
  expect(result.code).toBe(0);
  expect(result.prompts).toBe(1);
  expect(result.output).toContain("Ingen ytterligare ändring görs");
  expect({
    services: await db.service.count(),
    staff: await db.staff.count(),
    bookings: await db.booking.count(),
  }).toEqual(before);
}, 30000);

it("kräver sju separata bekräftelser och lämnar spårbar syntetisk historik", async () => {
  const result = await run(Array.from({ length: 7 }, () => "ja" as const));
  expect(result.code).toBe(0);
  expect(result.prompts).toBe(7);
  expect(result.output).toContain("Arbetsytedemo klar");
  expect(result.output + result.errors).not.toMatch(
    /customerName|customerEmail|SESSION_SECRET|@example\.test|Prisma|stack/,
  );
  expect(services.size).toBe(1);
  expect(staff.size).toBe(1);
  const rows = await db.booking.findMany({
    where: { idempotencyKey: { in: [...keys] }, businessId: "demo" },
    include: { events: true },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ status: "cancelled", version: 3 });
  expect(rows[0].events.map((event) => event.action).sort()).toEqual([
    "cancel",
    "create",
    "move",
  ]);
  expect(
    await db.service.findUniqueOrThrow({ where: { id: [...services][0] } }),
  ).toMatchObject({ active: false, version: 2 });
  expect(
    await db.staff.findUniqueOrThrow({ where: { id: [...staff][0] } }),
  ).toMatchObject({ active: false, version: 2 });
}, 30000);

it.each([
  { answers: [null], serviceCount: 0, prompts: 1 },
  { answers: ["ja", null], serviceCount: 1, prompts: 2 },
  { answers: ["ja", "nej"], serviceCount: 1, prompts: 2 },
] as const)(
  "stoppar vid EOF/nej och bevarar endast tidigare bekräftade ändringar: $answers",
  async ({ answers, serviceCount, prompts }) => {
    const before = {
      services: await db.service.count(),
      staff: await db.staff.count(),
      bookings: await db.booking.count(),
    };
    const result = await run(answers);
    expect(result.code).toBe(0);
    expect(result.prompts).toBe(prompts);
    expect(result.output).toContain(
      "Tidigare bekräftade ändringar ligger kvar",
    );
    expect(await db.service.count()).toBe(before.services + serviceCount);
    expect(await db.staff.count()).toBe(before.staff);
    expect(await db.booking.count()).toBe(before.bookings);
    expect(services.size).toBe(serviceCount);
  },
  30000,
);
