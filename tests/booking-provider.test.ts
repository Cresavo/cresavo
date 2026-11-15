import { beforeEach, expect, it, vi } from "vitest";
import type { BookingProvider } from "../src/lib/agent-api/provider";
const mocks = vi.hoisted(() => ({
  list: vi.fn(), availability: vi.fn(), create: vi.fn(), staff: vi.fn(),
  find: vi.fn(), raw: vi.fn(), update: vi.fn(), event: vi.fn(), lock: vi.fn(),
}));
vi.mock("../src/lib/domain", () => ({ listServices: mocks.list, getAvailability: mocks.availability, createBooking: mocks.create }));
vi.mock("../src/lib/workspace-write", () => ({ lockConfiguration: mocks.lock }));
vi.mock("../src/lib/db", () => {
  const tx = { $queryRaw: mocks.raw, booking: { update: mocks.update }, bookingEvent: { create: mocks.event } };
  return { db: { ...tx, staff: { findMany: mocks.staff }, booking: { findFirst: mocks.find },
    $transaction: async (run: (value: typeof tx) => unknown) => run(tx) } };
});
import { getBookingProvider, ProviderUnsupportedError } from "../src/lib/agent-api/provider";
const provider = getBookingProvider();
beforeEach(() => vi.resetAllMocks());
it("selects native with the complete typed contract and capabilities", () => {
  const contract: BookingProvider = provider;
  expect(contract.id).toBe("native");
  expect(getBookingProvider()).toBe(provider);
  expect(contract.capabilities).toEqual({ holdSlot: false, cancelBooking: true, staffSelection: true, idempotency: true, timeZone: "Europe/Stockholm" });
  for (const method of [contract.listServices, contract.getAvailability, contract.holdSlot, contract.createBooking, contract.getBooking, contract.cancelBooking]) expect(method).toBeTypeOf("function");
});
it("rejects holds with a typed unsupported error", async () => {
  await expect(provider.holdSlot({ serviceId: "s", start: "2026-11-16T09:00:00+01:00" })).rejects.toBeInstanceOf(ProviderUnsupportedError);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("wraps the catalog and existing resource selection", async () => {
  mocks.list.mockResolvedValue([{ id: "s" }]); mocks.staff.mockResolvedValue([{ id: "r", serviceIds: ["s"] }]);
  expect(await provider.listServices()).toEqual({ services: [{ id: "s" }], resources: [{ id: "r", serviceIds: ["s"] }] });
  expect(mocks.staff).toHaveBeenCalledWith({ where: { businessId: "demo", active: true }, select: { id: true, name: true, serviceIds: true }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 100 });
});
it("delegates availability with resource and zone", async () => {
  mocks.availability.mockResolvedValue(["2026-11-16T08:00:00Z"]);
  expect(await provider.getAvailability("s", "2026-11-16", "r")).toEqual({ starts: ["2026-11-16T08:00:00Z"], timeZone: "Europe/Stockholm" });
  expect(mocks.availability).toHaveBeenCalledWith("s", "2026-11-16", expect.anything(), "r");
});
it("passes the scoped key, channel and exact transaction hooks to the engine", async () => {
  const input = { serviceId: "s", staffId: "r", start: "2026-11-16T09:00:00+01:00", customerName: "Test Person", customerEmail: "test@example.test" };
  const hooks = { authorize: vi.fn(), beforeInsert: vi.fn(), booked: vi.fn() };
  const row = { id: "b" }; mocks.create.mockResolvedValue(row);
  expect(await provider.createBooking(input, "scoped-key", "agent-api:key:client", hooks)).toBe(row);
  expect(mocks.create).toHaveBeenCalledWith(input, "scoped-key", "agent-api:key:client", undefined, hooks);
});
it("gets a booking and preserves the missing-booking error", async () => {
  mocks.find.mockResolvedValueOnce({ id: "b" }).mockResolvedValueOnce(null);
  expect(await provider.getBooking("b")).toEqual({ id: "b" });
  await expect(provider.getBooking("missing")).rejects.toMatchObject({ code: "booking_not_found" });
});
it("cancels under configuration and credential locks and preserves replay", async () => {
  const current = { id: "b", status: "confirmed", startsAt: new Date(), endsAt: new Date(), staffId: "r" };
  const cancelled = { ...current, status: "cancelled", version: 2 };
  mocks.raw.mockResolvedValueOnce([current]).mockResolvedValueOnce([cancelled]); mocks.update.mockResolvedValue(cancelled);
  const authorize = vi.fn();
  expect(await provider.cancelBooking("b", "client", authorize)).toEqual({ row: cancelled, already: false });
  expect(authorize).toHaveBeenCalledOnce();
  expect(mocks.lock).toHaveBeenCalledOnce();
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "b" }, data: { status: "cancelled", version: { increment: 1 } } });
  expect(mocks.event).toHaveBeenCalledWith({ data: { bookingId: "b", action: "cancel", actorKind: "agent-api", actorId: "client", previousStart: current.startsAt, previousEnd: current.endsAt, previousStaffId: "r" } });
  expect(await provider.cancelBooking("b", "client", authorize)).toEqual({ row: cancelled, already: true });
  expect(mocks.update).toHaveBeenCalledOnce(); expect(mocks.event).toHaveBeenCalledOnce();
});
