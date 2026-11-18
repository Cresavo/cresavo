import { expect, it } from "vitest";
import {
  mcpMoveSchema,
  mcpCancelSchema,
  mcpServiceSchema,
  mcpStaffSchema,
  staffScheduleSchema,
  workspaceModeAllowed,
} from "../src/mcp/workspace";
import { mcpEnvironment } from "../src/mcp/environment";

const confirmed = { confirmed: true, clientRequestId: "synthetic-request" };
it("requires separate workspace opt-in, admin mode, and a quota secret", () => {
  const secret = "synthetic-secret-at-least-32-characters";
  expect(workspaceModeAllowed(["--admin", "--allow-bookings"], secret)).toBe(
    false,
  );
  expect(workspaceModeAllowed(["--admin", "--allow-workspace"], secret)).toBe(
    true,
  );
  for (const [args, value] of [
    [["--allow-workspace"], secret],
    [["--admin", "--allow-workspace"], "short"],
  ] as const)
    expect(() => workspaceModeAllowed([...args], value)).toThrow(
      "MCP_WORKSPACE_CONFIG_INVALID",
    );
  expect(mcpEnvironment().SESSION_SECRET).toBeUndefined();
  expect(mcpEnvironment({ workspace: true }).SESSION_SECRET).toBe(
    process.env.SESSION_SECRET,
  );
});
it("requires a version and a stable key and rejects unknown actor or business fields", () => {
  const input = {
    ...confirmed,
    id: "synthetic-booking",
    expectedVersion: 1,
    staffId: "staff-demo",
    start: "2026-11-16T09:00:00+01:00",
  };
  expect(mcpMoveSchema.parse(input)).toEqual(input);
  for (const patch of [
    { expectedVersion: undefined },
    { clientRequestId: undefined },
    { clientRequestId: "x".repeat(65) },
    { confirmed: false },
    { actor: "admin" },
    { businessId: "other" },
  ])
    expect(mcpMoveSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  expect(
    mcpCancelSchema.safeParse({
      ...confirmed,
      id: "synthetic-booking",
      expectedVersion: 1,
    }).success,
  ).toBe(true);
});
it("reuses configuration validation and scopes schedule reads", () => {
  const service = {
    ...confirmed,
    name: "Syntetisk",
    priceOre: 50000,
    duration: 30,
  };
  expect(mcpServiceSchema.safeParse(service).success).toBe(true);
  expect(mcpServiceSchema.safeParse({ ...service, id: "x" }).success).toBe(
    false,
  );
  expect(
    mcpStaffSchema.safeParse({
      ...confirmed,
      name: "Syntetisk",
      weekly: [],
      serviceIds: ["massage"],
    }).success,
  ).toBe(true);
  for (const value of [
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-11-16", to: "2026-11-15" },
    { from: "2026-11-16", to: "2027-01-01" },
  ])
    expect(
      staffScheduleSchema.safeParse({ staffId: "staff-demo", ...value })
        .success,
    ).toBe(false);
});
