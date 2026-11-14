// MCP-over-HTTP smoke client for /api/v1/mcp (synthetic data only).
//   AGENT_API_KEY=blk_... node --import tsx scripts/agent-mcp-smoke.mts [baseUrl] [--keep]
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = (process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const key = process.env.AGENT_API_KEY;
if (!key) {
  console.error("AGENT_API_KEY_MISSING");
  process.exit(1);
}
const client = new Client({ name: "booking-lab-mcp-smoke", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL(`${base}/api/v1/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
  }),
);
const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));
const call = async (name: string, args: Record<string, unknown>) => {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content as { type: string; text: string }[])[0]?.text ?? "";
  const body = JSON.parse(text);
  console.log(`${name} -> ${r.isError ? `error ${body.error.code}` : "ok"}`);
  return body;
};
const services = await call("list_services", { business: "demo" });
const service = services.services.find((s: { id: string }) => s.id === "massage") ?? services.services[0];
let slot: { start: string; staff: { id: string } } | undefined;
for (let d = 1; d <= 14 && !slot; d++) {
  const day = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  slot = (await call("get_availability", { business: "demo", service: service.id, date: day })).slots?.[0];
}
if (!slot) throw new Error("NO_SLOT");
const args = {
  idempotencyKey: randomUUID().replaceAll("-", ""), business: "demo", serviceId: service.id,
  serviceVersion: service.version, staffId: slot.staff.id, start: slot.start,
  customer: { name: "Synthetic MCP Person", email: "mcp-smoke@example.test" }, confirmed: true,
};
const booked = await call("create_booking", args);
await call("create_booking", args);
await call("create_booking", { ...args, idempotencyKey: `${args.idempotencyKey}x` });
await call("get_booking", { bookingId: booked.booking.id });
await call("get_booking", { bookingId: "not-mine" });
if (!process.argv.includes("--keep")) await call("cancel_booking", { bookingId: booked.booking.id });
await call("list_services", { business: "another-salon" });
await client.close();
