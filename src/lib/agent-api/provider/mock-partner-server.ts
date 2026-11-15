import { createServer } from "node:http";
import { DateTime } from "luxon";

export const PARTNER_ZONE = "America/New_York";
export const partnerService = { sku: "pos-treatment-71", label: "Synthetic trim", minutes: 30, padding: 0, cents: 45000, revision: 1 };
export const partnerResource = { worker: "pos-worker-92", label: "Synthetic stylist" };
export type PartnerBooking = { reference: string; sku: string; worker: string; localStart: string; localEnd: string; status: string; revision: number; created: string };
// Lab-only JSON RPC: POST /rpc { operation, ...arguments }; responses are
// { data } or { fault, detail }. Local wall times are in PARTNER_ZONE.
export async function startMockPartnerServer(options: { port?: number; latencyMs?: number } = {}) {
  const port = options.port ?? 0;
  const latency = options.latencyMs ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535 || port === 3219 || port === 3220 || !Number.isFinite(latency) || latency < 0 || latency > 1000)
    throw new Error("Invalid mock partner options.");
  const state = { bookings: new Map<string, PartnerBooking>(), replays: new Map<string, { body: string; reference: string }>(), fault: null as string | null };
  const server = createServer(async (req, res) => {
    const reply = async (status: number, value: unknown) => {
      if (latency) await new Promise(resolve => setTimeout(resolve, latency));
      res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value));
    };
    const fail = (fault: string) => reply(fault === "POS_BUSY" ? 429 : 409, { fault, detail: "Verbose private POS diagnostic: " + fault });
    try {
      if (req.method !== "POST" || req.url !== "/rpc") { await fail("POS_ROUTE"); return; }
      let body = "";
      for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) { await fail("POS_BODY"); return; } }
      const input = JSON.parse(body);
      if (state.fault) { await fail(state.fault); return; }
      const op = input.operation;
      if (op === "catalog") { await reply(200, { data: { services: [partnerService], workers: [partnerResource] } }); return; }
      if (op === "availability" || op === "create") {
        if (input.sku !== partnerService.sku) { await fail("POS_SKU_UNKNOWN"); return; }
        if (input.worker !== partnerResource.worker) { await fail("POS_WORKER_UNKNOWN"); return; }
      }
      const occupied = (start: number, end: number) => [...state.bookings.values()].some(b => b.status !== "cancelled" && start < DateTime.fromISO(b.localEnd, { zone: PARTNER_ZONE }).toMillis() && end > DateTime.fromISO(b.localStart, { zone: PARTNER_ZONE }).toMillis());
      if (op === "availability") {
        const day = DateTime.fromISO(input.day, { zone: PARTNER_ZONE });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day) || !day.isValid) { await fail("POS_BODY"); return; }
        const starts = [9, 10, 11].map(hour => day.set({ hour })).filter(t => !occupied(t.toMillis(), t.plus({ minutes: 30 }).toMillis())).map(t => t.toFormat("yyyy-MM-dd'T'HH:mm:ss"));
        await reply(200, { data: starts }); return;
      }
      if (op === "create") {
        const prior = state.replays.get(input.key);
        if (prior) { if (prior.body !== body) await fail("POS_REPLAY_MISMATCH"); else await reply(200, { data: state.bookings.get(prior.reference) }); return; }
        if (input.revision !== partnerService.revision) { await fail("POS_REVISION"); return; }
        const start = DateTime.fromISO(input.localStart, { zone: PARTNER_ZONE });
        if (!start.isValid || ![9, 10, 11].includes(start.hour) || start.minute || start.second || start.millisecond || !input.email?.endsWith("@example.test")) { await fail("POS_BODY"); return; }
        const end = start.plus({ minutes: 30 });
        if (occupied(start.toMillis(), end.toMillis())) { await fail("POS_COLLISION"); return; }
        const reference = `pos-ticket-${state.bookings.size + 1}`;
        const row: PartnerBooking = { reference, sku: input.sku, worker: input.worker, localStart: start.toFormat("yyyy-MM-dd'T'HH:mm:ss"), localEnd: end.toFormat("yyyy-MM-dd'T'HH:mm:ss"), status: "confirmed", revision: 1, created: new Date().toISOString() };
        state.bookings.set(reference, row); state.replays.set(input.key, { body, reference });
        await reply(200, { data: row }); return;
      }
      const row = state.bookings.get(input.reference);
      if (!row) { await fail("POS_TICKET_UNKNOWN"); return; }
      if (op === "get") { await reply(200, { data: row }); return; }
      if (op === "cancel") { const already = row.status === "cancelled"; if (!already) { row.status = "cancelled"; row.revision++; } await reply(200, { data: { row, already } }); return; }
      await fail("POS_ROUTE");
    } catch { await fail("POS_BODY"); }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock partner failed to bind.");
  return { baseUrl: `http://127.0.0.1:${address.port}`, port: address.port, state,
    close: () => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}
