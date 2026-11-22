import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, isFree, needOf, processingGap, staffIntervals } from "@/concept/data/slots";
import type { DemoState, Service } from "@/concept/data/types";
import { serviceIssues, type ServiceDraft } from "@/concept/services/edit";

// Tuesday 24 November 2026: the demo salon is open, and Anna works 09:00-17:00.
const day = "2026-11-24";
const hm = (hours: number, minutes = 0) => hours * 60 + minutes;
const proto = createDemoState("2026-11-16").services.find((s) => s.staffIds.includes("anna"))!;
const service = (id: string, duration: number, extra: Partial<Service> = {}): Service => ({ ...proto, id, name: id, duration, staffIds: ["anna"], resourceIds: [], ...extra });

const colour = service("colour", 90, { processing: { after: 30, duration: 30 } });
const trim = service("trim", 30);
const cut45 = service("cut45", 45);
const padded = service("padded", 60, { bufferBefore: 10, bufferAfter: 15 });

const empty = (services: Service[], rooms = 2): DemoState => {
  const base = createDemoState("2026-11-16");
  return { ...base, services, bookings: [], checkoutHolds: [], resources: base.resources.slice(0, rooms) };
};
const book = (state: DemoState, serviceId: string, start: number, customer = 0) =>
  reduce(state, { type: "booking/create", customerId: state.customers[customer].id, serviceId, staffId: "anna", date: day, start, source: "phone" });

describe("staff busy time", () => {
  it("adds buffers around the visit and leaves out the processing gap", () => {
    expect(staffIntervals(padded, hm(10), 60)).toEqual([{ start: hm(9, 50), end: hm(11, 15) }]);
    expect(staffIntervals(colour, hm(10), 90)).toEqual([{ start: hm(10), end: hm(10, 30) }, { start: hm(11), end: hm(11, 30) }]);
    expect(staffIntervals(undefined, hm(10), 60)).toEqual([{ start: hm(10), end: hm(11) }]);
    expect(processingGap(colour, hm(10), 90)).toEqual({ start: hm(10, 30), end: hm(11) });
  });

  it("keeps a processing gap inside the visit when the treatment was shortened", () => {
    expect(processingGap(colour, hm(10), 45)).toEqual({ start: hm(10, 30), end: hm(10, 45) });
    expect(processingGap(colour, hm(10), 30)).toBeNull();
  });
});

describe("slots with buffers", () => {
  it("keeps the buffers of an existing booking free of other bookings", () => {
    const state = book(empty([padded, trim]), "padded", hm(10));
    const starts = freeStarts(state, "anna", day, needOf(trim));
    expect(starts).toContain(hm(9, 15));
    expect(starts).not.toContain(hm(9, 30));
    expect(starts).not.toContain(hm(11));
    expect(starts).toContain(hm(11, 15));
  });

  it("does not need the buffers to fit inside the opening hours", () => {
    expect(isFree(empty([padded]), "anna", day, hm(9), needOf(padded))).toBe(true);
  });

  it("rejects a booking whose own buffer would reach another booking", () => {
    const state = book(empty([padded, trim]), "trim", hm(11, 10));
    expect(isFree(state, "anna", day, hm(10), needOf(padded))).toBe(false);
    expect(book(state, "padded", hm(10))).toBe(state);
  });

  it("rejects a move that would overlap a buffer", () => {
    const state = book(book(empty([padded, trim]), "padded", hm(9)), "trim", hm(11));
    const trimId = state.bookings.at(-1)!.id;
    expect(reduce(state, { type: "booking/move", id: trimId, date: day, start: hm(10) })).toBe(state);
    expect(reduce(state, { type: "booking/move", id: trimId, date: day, start: hm(10, 15) }).bookings.at(-1)?.start).toBe(hm(10, 15));
  });
});

describe("processing time", () => {
  it("lets a second customer be booked into the processing gap", () => {
    const state = book(empty([colour, trim, cut45]), "colour", hm(10));
    const next = book(state, "trim", hm(10, 30), 1);
    expect(next.bookings).toHaveLength(2);
    expect(freeStarts(state, "anna", day, needOf(trim))).toContain(hm(10, 30));
  });

  it("rejects a booking that is longer than the gap", () => {
    const state = book(empty([colour, trim, cut45]), "colour", hm(10));
    expect(book(state, "cut45", hm(10, 30), 1)).toBe(state);
    expect(freeStarts(state, "anna", day, needOf(cut45))).not.toContain(hm(10, 30));
  });

  it("does not let anyone use the active parts of the colour", () => {
    const state = book(empty([colour, trim]), "colour", hm(10));
    expect(book(state, "trim", hm(10, 15), 1)).toBe(state);
    expect(book(state, "trim", hm(11), 1)).toBe(state);
  });

  it("keeps the room for the whole visit, processing included", () => {
    const withRoom = (s: Service): Service => ({ ...s, resourceIds: ["room-1"] });
    const roomTrim = service("room-trim", 30, { resourceIds: ["room-1"] });
    const state = book(empty([withRoom(colour), roomTrim, trim], 1), "colour", hm(10));
    expect(state.bookings[0].resourceId).toBe("room-1");
    expect(isFree(state, "anna", day, hm(10, 30), needOf(roomTrim))).toBe(false);
    expect(freeStarts(state, "anna", day, needOf(roomTrim))).not.toContain(hm(10, 30));
    expect(book(state, "room-trim", hm(10, 30), 1)).toBe(state);
    expect(isFree(state, "anna", day, hm(10, 30), needOf(trim))).toBe(true);
  });
});

describe("service timing validation", () => {
  const base = createDemoState("2026-11-16");
  const draft: ServiceDraft = { name: "Balayage", category: base.categories[0].id, duration: 90, price: 1200, description: "", staffIds: ["anna"], bufferAfter: 10, processing: { after: 30, duration: 30 } };

  it("accepts buffers and a processing gap inside the treatment", () => {
    expect(serviceIssues(base, draft)).toEqual([]);
    expect(serviceIssues(base, { ...draft, bufferBefore: 120, processing: { after: 0, duration: 90 } })).toEqual([]);
  });

  it("rejects negative or odd buffers and processing outside the treatment", () => {
    for (const bufferBefore of [-5, 125, 7, Number.NaN]) expect(serviceIssues(base, { ...draft, bufferBefore })).toEqual(["buffer"]);
    for (const processing of [{ after: 65, duration: 30 }, { after: -5, duration: 30 }, { after: 0, duration: 0 }, { after: 10, duration: 5.5 }]) {
      expect(serviceIssues(base, { ...draft, processing })).toEqual(["processing"]);
    }
  });

  it("saves the timing on add and update, and clears it again", () => {
    const added = reduce(base, { type: "service/add", service: draft });
    const saved = added.services.at(-1)!;
    expect(saved).toMatchObject({ bufferAfter: 10, processing: { after: 30, duration: 30 } });
    expect(saved.bufferBefore).toBeUndefined();
    expect(reduce(base, { type: "service/add", service: { ...draft, processing: { after: 60, duration: 60 } } })).toBe(base);
    const cleared = reduce(added, { type: "service/update", id: saved.id, service: { ...draft, bufferAfter: 0, processing: undefined } });
    const after = cleared.services.at(-1)!;
    expect(after.bufferAfter).toBeUndefined();
    expect(after.processing).toBeUndefined();
    expect(reduce(added, { type: "service/update", id: saved.id, service: { ...draft, bufferBefore: -5 } })).toBe(added);
  });
});
