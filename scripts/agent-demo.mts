// Demo client for the agent API v1 (synthetic data only). Exercises book,
// safe retry, conflict, status and cancel so /live has something real to show.
// Use a key created with --kind demo-script so /live labels it honestly.
//   AGENT_API_KEY=blk_... node --import tsx scripts/agent-demo.mts [baseUrl] [--keep]
import { randomUUID } from "node:crypto";

const base = (process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const keep = process.argv.includes("--keep");
const key = process.env.AGENT_API_KEY;
if (!key) {
  console.error("AGENT_API_KEY_MISSING");
  process.exit(1);
}
const h = { authorization: `Bearer ${key}`, "content-type": "application/json" };
async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, { method, headers: { ...h, ...extra }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  console.log(`${method} ${path} -> ${res.status}${json.error ? ` ${json.error.code}` : ""}`);
  return { status: res.status, json };
}

const { json: svc } = await call("GET", "/api/v1/services?business=demo");
const service = svc.services[0];
let slot: { start: string; staff: { id: string } } | undefined;
for (let d = 1; d <= 14 && !slot; d++) {
  const day = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const { json } = await call("GET", `/api/v1/availability?business=demo&service=${service.id}&date=${day}`);
  slot = json.slots?.[0];
}
if (!slot) throw new Error("NO_SLOT");
const booking = {
  business: "demo", serviceId: service.id, serviceVersion: service.version, staffId: slot.staff.id,
  start: slot.start, customer: { name: "Synthetic Demo Person", email: "agent-demo@example.test" }, confirmed: true,
};
const idem = randomUUID().replaceAll("-", "");
const first = await call("POST", "/api/v1/bookings", booking, { "idempotency-key": idem });
await call("POST", "/api/v1/bookings", booking, { "idempotency-key": idem }); // safe retry
await call("POST", "/api/v1/bookings", { ...booking, customer: { name: "Another Synthetic", email: "agent-demo-2@example.test" } }, { "idempotency-key": `${idem}x` }); // conflict
const id = first.json.booking?.id;
if (id) {
  await call("GET", `/api/v1/bookings/${id}`);
  if (!keep) await call("POST", `/api/v1/bookings/${id}/cancel`);
}
