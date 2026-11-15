import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mcpEnvironment } from "../../src/mcp/environment";
it("rejects invalid capacity-only startup flags before serving any tools", () => {
  for (const flags of [
    ["--capacity-only"],
    ["--capacity-only", "--admin", "--allow-bookings"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/mcp/server.ts", ...flags],
      {
        env: { ...mcpEnvironment(), NODE_ENV: "test" },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MCP_CAPACITY_CONFIG_INVALID");
  }
  const env = {
    ...mcpEnvironment(),
    SESSION_SECRET: "too-short",
    NODE_ENV: "test" as const,
  };
  const invalidSecret = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "src/mcp/server.ts",
      "--capacity-only",
      "--admin",
      "--allow-workspace",
    ],
    { env, encoding: "utf8", timeout: 10000 },
  );
  expect(invalidSecret.status).toBe(1);
  expect(invalidSecret.stderr).toContain("MCP_WORKSPACE_CONFIG_INVALID");
}, 30000);
