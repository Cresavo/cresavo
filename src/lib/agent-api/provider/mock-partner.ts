import { randomUUID } from "node:crypto";
import { request } from "node:http";
import { DateTime } from "luxon";
import { z } from "zod";
import { AgentApiError, type AgentApiErrorCode } from "../errors";
import { ProviderUnsupportedError, type BookingProvider } from "./types";

const ZONE = "America/New_York";
const serviceSchema = z.object({ sku: z.string(), label: z.string(), minutes: z.number().int().positive(), padding: z.number().int().nonnegative(), cents: z.number().int().nonnegative(), revision: z.number().int().positive() });
const catalogSchema = z.object({ services: z.array(serviceSchema), workers: z.array(z.object({ worker: z.string(), label: z.string() })) });
const bookingSchema = z.object({ reference: z.string(), sku: z.string(), worker: z.string(), localStart: z.string(), localEnd: z.string(), status: z.enum(["confirmed", "cancelled"]), revision: z.number().int().positive(), created: z.iso.datetime() });
const faults: Record<string, AgentApiErrorCode> = { POS_SKU_UNKNOWN: "service_not_found", POS_WORKER_UNKNOWN: "staff_not_found", POS_TICKET_UNKNOWN: "booking_not_found", POS_COLLISION: "slot_unavailable", POS_REVISION: "stale_service", POS_REPLAY_MISMATCH: "idempotency_conflict", POS_BUSY: "rate_limited", POS_BODY: "invalid_request" };

export function createMockPartnerProvider(options: { baseUrl: string }): BookingProvider {
  let base: URL;
  try {
    base = new URL(options.baseUrl);
    if (base.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(base.hostname) || base.username || base.password || base.pathname !== "/" || base.search || base.hash || ["3219", "3220"].includes(base.port)) throw new Error();
  } catch { throw new AgentApiError("invalid_request"); }
  // Pin localhost to IPv4 loopback: no DNS, redirects, proxies or ambient credentials.
  const port = Number(base.port || 80);
  const source = randomUUID();
  const forward = new Map<string, string>(), reverse = new Map<string, string>();
  const internal = (kind: string, external: string) => {
    const key = JSON.stringify(["mock-partner", source, kind, external]);
    let id = forward.get(key);
    if (!id) { id = randomUUID(); forward.set(key, id); reverse.set(JSON.stringify([kind, id]), external); }
    return id;
  };
  const external = (kind: string, id: string, code: AgentApiErrorCode) => {
    const value = reverse.get(JSON.stringify([kind, id]));
    if (!value) throw new AgentApiError(code);
    return value;
  };
  const safe = async <T>(run: () => Promise<T>): Promise<T> => {
    try { return await run(); } catch (error) {
      if (error instanceof AgentApiError) throw error;
      console.error("MOCK_PARTNER_INTERNAL_ERROR"); throw new AgentApiError("internal_error");
    }
  };
  const rpc = (operation: string, args: object = {}) => safe(async () => {
    const body = JSON.stringify({ operation, ...args });
    const result = await new Promise<unknown>((resolve, reject) => {
      const req = request({ hostname: "127.0.0.1", port, path: "/rpc", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }, agent: false }, res => {
        let data = "";
        res.on("data", chunk => { data += chunk; if (Buffer.byteLength(data) > 65536) res.destroy(new Error()); });
        res.on("error", reject);
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch { reject(new Error()); } });
      });
      req.setTimeout(1500, () => req.destroy(new Error())); req.on("error", reject); req.end(body);
    });
    const envelope = z.object({ fault: z.string().optional(), data: z.unknown().optional() }).parse(result);
    if (envelope.fault) {
      const code = faults[envelope.fault] ?? "internal_error";
      if (code === "internal_error") console.error("MOCK_PARTNER_INTERNAL_ERROR");
      throw new AgentApiError(code);
    }
    return envelope.data;
  });
  const instant = (value: string) => {
    const parsed = DateTime.fromISO(value, { zone: ZONE });
    if (!parsed.isValid) throw new AgentApiError("internal_error");
    return parsed;
  };
  let catalog: z.infer<typeof catalogSchema> | undefined;
  const load = async () => catalog ??= catalogSchema.parse(await rpc("catalog"));
  const booking = async (value: unknown) => {
    const row = bookingSchema.parse(value), cat = await load();
    const service = cat.services.find(s => s.sku === row.sku);
    if (!service || !cat.workers.some(w => w.worker === row.worker)) throw new AgentApiError("internal_error");
    return { id: internal("booking", row.reference), serviceId: internal("service", row.sku), staffId: internal("resource", row.worker), serviceName: service.label, duration: service.minutes, startsAt: instant(row.localStart).toJSDate(), endsAt: instant(row.localEnd).toJSDate(), status: row.status, version: row.revision, createdAt: new Date(row.created) };
  };
  return {
    id: "mock-partner",
    capabilities: Object.freeze({ holdSlot: false, cancelBooking: true, staffSelection: true, idempotency: true, timeZone: ZONE }),
    listServices: () => safe(async () => {
      const cat = await load();
      return { services: cat.services.map(s => ({ id: internal("service", s.sku), name: s.label, duration: s.minutes, buffer: s.padding, priceOre: s.cents, version: s.revision })), resources: cat.workers.map(w => ({ id: internal("resource", w.worker), name: w.label, serviceIds: cat.services.map(s => internal("service", s.sku)) })) };
    }),
    getAvailability: (serviceId, day, resourceId) => safe(async () => {
      const cat = await load();
      const starts = z.array(z.string()).parse(await rpc("availability", { sku: external("service", serviceId, "service_not_found"), worker: resourceId ? external("resource", resourceId, "staff_not_found") : cat.workers[0]?.worker, day }));
      return { starts: starts.map(s => instant(s).toISO()!), timeZone: ZONE };
    }),
    async holdSlot() { throw new ProviderUnsupportedError("mock-partner", "holdSlot"); },
    createBooking: (input, key, channel) => safe(async () => {
      if (!/(@example\.test)$/.test(input.customerEmail)) throw new AgentApiError("synthetic_contact_required");
      if (!/(Z|[+-]\d{2}:\d{2})$/.test(input.start)) throw new AgentApiError("invalid_request");
      const start = DateTime.fromISO(input.start, { setZone: true });
      if (!start.isValid || start.second || start.millisecond) throw new AgentApiError("invalid_request");
      const cat = await load();
      return booking(await rpc("create", { sku: external("service", input.serviceId, "service_not_found"), worker: input.staffId ? external("resource", input.staffId, "staff_not_found") : cat.workers[0]?.worker, revision: input.serviceVersion, localStart: start.setZone(ZONE).toFormat("yyyy-MM-dd'T'HH:mm:ss"), email: input.customerEmail, name: input.customerName, key: JSON.stringify([channel, key]) }));
    }),
    getBooking: id => safe(async () => booking(await rpc("get", { reference: external("booking", id, "booking_not_found") }))),
    cancelBooking: id => safe(async () => {
      const result = z.object({ row: bookingSchema, already: z.boolean() }).parse(await rpc("cancel", { reference: external("booking", id, "booking_not_found") }));
      return { row: await booking(result.row), already: result.already };
    }),
  };
}
