import { expect, it } from "vitest";
import { mcpCall, safeCall, safeNote } from "../scripts/agentprov/codex-events.mjs";
import { spawnSync } from "node:child_process";

it("ignores model prose and incomplete calls", () => {
  expect(mcpCall({ type: "item.completed", item: { type: "agent_message", text: "private" } })).toBeNull();
  expect(mcpCall({ type: "item.started", item: { type: "mcp_tool_call" } })).toBeNull();
});
it("retains the in-memory approval link but excludes it and arguments from saved evidence", () => {
  const call = mcpCall({ type: "item.completed", item: { type: "mcp_tool_call", server: "bookingproof",
    tool: "create_proposal", arguments: { private: "sensitive" }, result: { content: [{ type: "text",
      text: JSON.stringify({ proposal: { id: "synthetic" }, approvalUrl: "http://127.0.0.1/consent/synthetic#secret" }) }] } } })!;
  expect(call.result.approvalUrl).toContain("#secret");
  expect(safeCall(call)).toEqual({ tool: "create_proposal", failed: false, proposalId: "synthetic" });
  expect(JSON.stringify(safeCall(call))).not.toMatch(/secret|sensitive|approvalUrl|arguments/);
});
it("refuses a tool from a different server", () => {
  expect(() => mcpCall({ type: "item.completed", item: { type: "mcp_tool_call", server: "other" } })).toThrow("NATIVE_UNEXPECTED_SERVER");
});
it("records failure without persisting its error contents", () => {
  const call = mcpCall({ type: "item.completed", item: { type: "mcp_tool_call", server: "bookingproof",
    tool: "create_booking", error: { message: "private detail" } } })!;
  expect(safeCall(call)).toEqual({ tool: "create_booking", failed: true });
});
it("refuses the real-account proof in CI before connecting or invoking a client", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/integration/run.mts", "--native-codex"], {
    encoding: "utf8", timeout: 15000,
    env: { NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
      DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/unit_test", CI: "1" },
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("NATIVE_CLIENT_CI_REFUSED");
  expect(result.stdout).not.toContain("PAIR salon=");
});
it("redacts credentials, approval links and opaque material before saving model notes", () => {
  const secret = "synthetic-key";
  const result = safeNote(`No booking ${secret} http://127.0.0.1/consent/x#token ${"A".repeat(43)}`, secret);
  expect(result).not.toMatch(/synthetic-key|http:|#token|AAAA/);
  expect(result).toContain("No booking");
});
