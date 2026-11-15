import { afterEach, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import * as http from "node:http";
import { createMockPartnerProvider } from "../src/lib/agent-api/provider/mock-partner";
import { startMockPartnerServer, partnerService, partnerResource } from "../src/lib/agent-api/provider/mock-partner-server";
import { ProviderUnsupportedError } from "../src/lib/agent-api/provider/types";
import { AgentApiError, agentApiErrors, type AgentApiErrorCode } from "../src/lib/agent-api/errors";
import { assertMandatedBooking, type StoredMandate } from "../src/lib/agent-api/mandate-policy";

vi.mock("node:http", async importOriginal => {
  const actual = await importOriginal<typeof import("node:http")>();
  return { ...actual, request: vi.fn(actual.request) };
});

const servers: Awaited<ReturnType<typeof startMockPartnerServer>>[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(servers.splice(0).map(s => s.close())); });
async function setup(latencyMs = 0) {
  const server = await startMockPartnerServer({ port: 0, latencyMs }); servers.push(server);
  const provider = createMockPartnerProvider({ baseUrl: server.baseUrl });
  const { services, resources } = await provider.listServices();
  const input = { serviceId: services[0].id, serviceVersion: services[0].version, staffId: resources[0].id, start: "2026-11-16T09:00:00-05:00", customerName: "Synthetic Person", customerEmail: "synthetic@example.test" };
  return { server, provider, services, resources, input };
}
async function fixedError(action: Promise<unknown>, code: AgentApiErrorCode) {
  await expect(action).rejects.toBeInstanceOf(AgentApiError);
  await expect(action).rejects.toMatchObject({ code, message: agentApiErrors[code].message });
}
it("maps catalog identities and resource service links", async () => {
  const { services, resources, provider, server } = await setup();
  expect(new URL(server.baseUrl).hostname).toBe("127.0.0.1");
  expect(services[0].id).not.toBe(partnerService.sku);
  expect(resources[0].id).not.toBe(partnerResource.worker);
  expect(resources[0].serviceIds).toContain(services[0].id);
  expect(provider.capabilities).toEqual({ holdSlot: false, cancelBooking: true, staffSelection: true, idempotency: true, timeZone: "America/New_York" });
});
it("returns offset instants and compares mandates on absolute time", async () => {
  const { provider, input } = await setup();
  const availability = await provider.getAvailability(input.serviceId, "2026-11-16", input.staffId);
  expect(availability.timeZone).toBe("America/New_York");
  expect(availability.starts[0]).toBe("2026-11-16T09:00:00.000-05:00");
  const start = new Date(availability.starts[0]);
  expect(start.getTime()).toBe(new Date("2026-11-16T15:00:00+01:00").getTime());
  const scope = { businessId: "demo", clientId: "synthetic-client", serviceId: input.serviceId, staffId: input.staffId!, locationId: "synthetic-place", scheduleId: "synthetic-schedule" };
  const mandate: StoredMandate = { ...scope, validFrom: new Date("2026-11-16T15:00:00+01:00"), validUntil: new Date("2026-11-16T15:30:00+01:00"), expiresAt: new Date("2026-11-17T00:00:00Z"), revokedAt: null, maxPriceOre: 45000, currency: "SEK", origin: "synthetic-operator", originReference: "synthetic-proof" };
  const booking = { ...scope, start, duration: 30, priceOre: 45000 };
  const now = new Date("2026-11-15T00:00:00Z");
  expect(() => assertMandatedBooking(mandate, booking, now)).not.toThrow();
  expect(() => assertMandatedBooking({ ...mandate, validFrom: new Date("2026-11-16T09:00:00+01:00"), validUntil: new Date("2026-11-16T09:30:00+01:00") }, booking, now)).toThrow(agentApiErrors.mandate_denied.message);
});
it("creates, replays, retrieves and cancels through a stable internal booking id", async () => {
  const { provider, server, input } = await setup();
  const first = await provider.createBooking(input, "key", "channel");
  expect(first.id).not.toBe([...server.state.bookings.keys()][0]);
  expect(await provider.createBooking(input, "key", "channel")).toEqual(first);
  expect(await provider.getBooking(first.id)).toEqual(first);
  await fixedError(provider.createBooking({ ...input, customerName: "Other Synthetic Person" }, "key", "channel"), "idempotency_conflict");
  expect((await provider.cancelBooking(first.id, "synthetic-actor")).row.status).toBe("cancelled");
  expect((await provider.cancelBooking(first.id, "synthetic-actor")).already).toBe(true);
  expect(server.state.bookings.size).toBe(1);
});
it("permits only one of two simultaneous overlapping bookings", async () => {
  const { provider, server, input } = await setup();
  const results = await Promise.allSettled([provider.createBooking(input, "one", "channel"), provider.createBooking(input, "two", "channel")]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const failed = results.find(r => r.status === "rejected") as PromiseRejectedResult;
  expect(failed.reason).toMatchObject({ code: "slot_unavailable", message: agentApiErrors.slot_unavailable.message });
  expect(server.state.bookings.size).toBe(1);
});
it("rejects unknown internal ids with fixed agent errors", async () => {
  const { provider, input } = await setup();
  await fixedError(provider.createBooking({ ...input, serviceId: "unknown" }, "one", "channel"), "service_not_found");
  await fixedError(provider.getAvailability(input.serviceId, "2026-11-16", "unknown"), "staff_not_found");
  await fixedError(provider.getBooking("unknown"), "booking_not_found");
  await fixedError(provider.cancelBooking("unknown", "actor"), "booking_not_found");
});
it.each([
  ["POS_SKU_UNKNOWN", "service_not_found"], ["POS_WORKER_UNKNOWN", "staff_not_found"],
  ["POS_TICKET_UNKNOWN", "booking_not_found"], ["POS_REVISION", "stale_service"],
  ["POS_BUSY", "rate_limited"], ["POS_UNEXPECTED_PRIVATE_CODE", "internal_error"],
] as const)("sanitizes partner fault %s", async (fault, code) => {
  const { provider, server, input } = await setup();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  server.state.fault = fault;
  await fixedError(provider.getAvailability(input.serviceId, "2026-11-16"), code);
  if (code === "internal_error") expect(log).toHaveBeenCalledWith("MOCK_PARTNER_INTERNAL_ERROR");
  else expect(log).not.toHaveBeenCalled();
});
it("translates actual stale versions", async () => {
  const { provider, input, server } = await setup();
  await fixedError(provider.createBooking({ ...input, serviceVersion: 999 }, "stale", "channel"), "stale_service");
  expect(server.state.bookings.size).toBe(0);
});
it("isolates identical external ids between sources and keeps type namespaces separate", async () => {
  const a = await setup(), b = await setup();
  expect(a.services[0].id).not.toBe(b.services[0].id);
  expect(a.resources[0].id).not.toBe(b.resources[0].id);
  const first = await a.provider.createBooking(a.input, "same", "channel");
  const second = await b.provider.createBooking(b.input, "same", "channel");
  expect([...a.server.state.bookings.keys()]).toEqual([...b.server.state.bookings.keys()]);
  expect(first.id).not.toBe(second.id);
  await fixedError(b.provider.getBooking(first.id), "booking_not_found");
  const another = createMockPartnerProvider({ baseUrl: a.server.baseUrl });
  expect((await another.listServices()).services[0].id).not.toBe(a.services[0].id);
  expect((await a.provider.getBooking(first.id)).id).toBe(first.id);
});
it("applies a small configured delay", async () => {
  const { provider, input } = await setup(30);
  const before = performance.now();
  await provider.getAvailability(input.serviceId, "2026-11-16");
  const elapsed = performance.now() - before;
  expect(elapsed).toBeGreaterThanOrEqual(28);
  expect(elapsed).toBeLessThan(500);
});
it("rejects non-loopback and unsafe base URLs before any HTTP or DNS", () => {
  const network = vi.mocked(http.request);
  network.mockClear();
  for (const baseUrl of ["http://example.test", "http://8.8.8.8", "https://127.0.0.1", "http://127.0.0.1@invalid.test", "http://127.0.0.1:3219", "http://127.0.0.1:3220", "invalid"]) {
    expect(() => createMockPartnerProvider({ baseUrl })).toThrow(agentApiErrors.invalid_request.message);
  }
  expect(network).not.toHaveBeenCalled();
});
it("pins localhost to loopback and rejects holds", async () => {
  const { server } = await setup();
  const provider = createMockPartnerProvider({ baseUrl: server.baseUrl.replace("127.0.0.1", "localhost") });
  expect((await provider.listServices()).services).toHaveLength(1);
  await expect(provider.holdSlot({ serviceId: "s", start: "2026-11-16T09:00:00-05:00" })).rejects.toBeInstanceOf(ProviderUnsupportedError);
});
it("retains New York offsets across summer and winter", async () => {
  const { provider, input } = await setup();
  for (const [day, offset] of [["2026-07-15", -240], ["2026-11-16", -300]] as const) {
    const { starts } = await provider.getAvailability(input.serviceId, day);
    expect(DateTime.fromISO(starts[0], { setZone: true }).offset).toBe(offset);
  }
});
it("sanitizes transport failure", async () => {
  const { server, provider, input } = await setup();
  await server.close(); servers.splice(servers.indexOf(server), 1);
  vi.spyOn(console, "error").mockImplementation(() => {});
  await fixedError(provider.getAvailability(input.serviceId, "2026-11-16"), "internal_error");
});
