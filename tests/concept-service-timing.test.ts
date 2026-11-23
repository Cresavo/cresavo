import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { weekday } from "@/concept/data/dates";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import { freeStarts, isFree, needOf, processingGap, staffIntervals, workMinutes } from "@/concept/data/slots";
import { applyAction } from "@/concept/log/capture";
import { undoBlockReason, undoEntry } from "@/concept/log/undo";
import { openSlots } from "@/concept/booking/suggest";
import { minuteInGap } from "@/concept/studio/calendar/gap";
import { liveSlot } from "@/concept/studio/inbox/live-slot";
import { utilisation } from "@/concept/selectors";
import { restoreEntry } from "@/concept/trash/trash";
import type { DemoState, Service, StaffId } from "@/concept/data/types";
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
const book = (state: DemoState, serviceId: string, start: number, customer = 0, staffId: StaffId = "anna") =>
  reduce(state, { type: "booking/create", customerId: state.customers[customer].id, serviceId, staffId, date: day, start, source: "phone" });

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

describe("timing is kept on the booking", () => {
  const meta = { actor: "owner", source: "button", at: 0 } as const;
  const draftOf = (s: Service): ServiceDraft => ({ name: s.name, category: s.category, duration: s.duration, price: s.price, description: s.description, staffIds: s.staffIds });

  it("is not changed by editing the treatment, or by undoing that edit", () => {
    const state = book(book(empty([colour, trim]), "colour", hm(10)), "trim", hm(10, 30), 1);
    const before = freeStarts(state, "anna", day, needOf(trim));
    const edited = applyAction(state, { type: "service/update", id: "colour", service: { ...draftOf(colour), bufferAfter: 30 } }, meta);
    expect(edited.services[0].bufferAfter).toBe(30);
    expect(freeStarts(edited, "anna", day, needOf(trim))).toEqual(before);
    const removed = applyAction(state, { type: "service/update", id: "colour", service: draftOf(colour) }, meta);
    expect(freeStarts(removed, "anna", day, needOf(trim))).toEqual(before);
    expect(freeStarts(undoEntry(removed, removed.log[0].id), "anna", day, needOf(trim))).toEqual(before);
    expect(removed.bookings[0].processing).toEqual(colour.processing);
  });

  it("survives deleting the treatment and restoring the customer from the trash", () => {
    const state = book(empty([padded, trim, cut45]), "padded", hm(10));
    const customerId = state.bookings[0].customerId;
    const deleted = reduce(reduce(state, { type: "customer/delete", id: customerId }), { type: "service/delete", id: "padded" });
    expect(isFree(deleted, "anna", day, hm(11), needOf(trim))).toBe(true);
    const restored = restoreEntry(deleted, deleted.trash[0].id);
    expect(restored.bookings[0]).toMatchObject({ serviceId: "padded", bufferAfter: 15 });
    expect(isFree(restored, "anna", day, hm(11), needOf(trim))).toBe(false);
    expect(isFree(restored, "anna", day, hm(11, 15), needOf(trim))).toBe(true);
  });

  it("is kept by a live checkout hold, and by the booking it becomes", () => {
    const priced: Service = { ...colour, price: 500 };
    const start = { ...empty([priced, trim, cut45]), cancellationPolicy: { ...DEFAULT_POLICY, deposits: { colour: 20000 } } };
    const held = reduce(start, {
      type: "online/hold", serviceId: "colour", staffId: "anna", date: day, start: hm(10),
      guest: { name: "Fictional Guest", phone: "0700009911", at: { date: "2026-11-17", time: 540 } },
      notice: { title: "Demo request", body: "Demo appointment" },
    });
    expect(held.checkoutHolds[0].processing).toEqual(colour.processing);
    const retired = reduce(held, { type: "service/delete", id: "colour" });
    expect(isFree(retired, "anna", day, hm(10, 30), needOf(trim))).toBe(true);
    expect(isFree(retired, "anna", day, hm(10, 15), needOf(trim))).toBe(false);
    const paid = reduce(held, { type: "online/pay", id: held.checkoutHolds[0].id, method: "card" });
    expect(paid.bookings[0].processing).toEqual(colour.processing);
  });
});

describe("limits of a day and of a request", () => {
  const night = (services: Service[]): DemoState => {
    const state = empty(services);
    const week = { start: 0, end: 24 * 60 };
    return {
      ...state,
      salon: { ...state.salon, closures: [], hours: { ...state.salon.hours, [weekday(day)]: { open: 0, close: 24 * 60 } } },
      staff: state.staff.map((p) => ({ ...p, week: { ...p.week, [weekday(day)]: week } })),
    };
  };

  it("refuses buffers that would reach into another day", () => {
    const late = service("late", 30, { bufferAfter: 30 });
    const early = service("early", 30, { bufferBefore: 30 });
    const state = night([late, early, trim]);
    expect(isFree(state, "anna", day, hm(23, 30), needOf(trim))).toBe(true);
    expect(isFree(state, "anna", day, hm(23, 30), needOf(late))).toBe(false);
    expect(isFree(state, "anna", day, 0, needOf(early))).toBe(false);
    expect(freeStarts(state, "anna", day, needOf(late))).not.toContain(hm(23, 30));
    expect(freeStarts(state, "anna", day, needOf(early))).not.toContain(0);
    expect(freeStarts(state, "anna", day, needOf(early))).toContain(hm(0, 30));
  });

  it("refuses a booking without a usable start or length", () => {
    const state = empty([trim]);
    expect(isFree(state, "anna", day, undefined as unknown as number, needOf(trim))).toBe(false);
    expect(isFree(state, "anna", day, hm(10), { serviceId: "trim", duration: 0 })).toBe(false);
    const withoutStart = { type: "booking/create", customerId: state.customers[0].id, serviceId: "trim", staffId: "anna", date: day, source: "phone" } as unknown as Parameters<typeof reduce>[1];
    expect(reduce(state, withoutStart)).toBe(state);
  });
});

describe("occupancy", () => {
  it("counts work in a processing gap once, and buffers as busy time", () => {
    const withTrim = book(book(empty([colour, trim, padded]), "colour", hm(10)), "trim", hm(10, 30), 1);
    const open = utilisation(empty([]), day, 1, "anna");
    expect(open).toBe(0);
    const hours = workMinutes(withTrim, "anna", day);
    expect(utilisation(withTrim, day, 1, "anna") * hours).toBeCloseTo(90);
    expect(utilisation(book(empty([padded]), "padded", hm(10)), day, 1, "anna") * hours).toBeCloseTo(85);
  });
});

describe("review fixes", () => {
  const meta = { actor: "owner", source: "button", at: 0 } as const;
  const clock = { today: "2026-11-16", minutes: 9 * 60 };
  const pad30 = service("pad30", 30, { bufferAfter: 30 });

  it("stores only the timing that passed the check when an inbox reply books a slot", () => {
    const state = empty([trim]);
    const item = { id: "i-1", kind: "request" as const, customerId: state.customers[0].id, date: "2026-11-16", time: 540, title: "Demo request", body: "Demo", read: false, handled: false };
    const slot = { staffId: "anna" as const, serviceId: "trim", date: day, start: hm(10), processing: { after: 0, duration: 30 }, bufferBefore: 20 };
    const booked = reduce({ ...state, inbox: [item] }, { type: "inbox/reply", id: "i-1", reply: "See you", slot });
    expect(booked.bookings).toHaveLength(1);
    expect(booked.bookings[0].processing).toBeUndefined();
    expect(booked.bookings[0].bufferBefore).toBeUndefined();
  });

  it("suggests moves with the booking's own timing, not the catalogue's", () => {
    const booked = book(book(empty([pad30, trim]), "pad30", hm(10)), "trim", hm(11, 30), 1);
    const state = { ...booked, services: booked.services.map((s) => (s.id === "pad30" ? { ...s, bufferAfter: undefined } : s)) };
    const id = state.bookings[0].id;
    expect(openSlots(state, "pad30", day, clock, { ignoreId: id }).map((slot) => slot.start)).not.toContain(hm(11));
    expect(liveSlot(state, { staffId: "anna", serviceId: "pad30", date: day, start: hm(11) }, clock.today, clock.minutes, id)?.start).not.toBe(hm(11));
    expect(reduce(state, { type: "booking/move", id, date: day, start: hm(11) })).toBe(state);
  });

  it("opens the clicked time in a processing gap, kept inside the gap", () => {
    const gap = { start: hm(10, 30), end: hm(11, 30) };
    expect(minuteInGap(gap, 0, 1.25)).toBe(hm(10, 30));
    expect(minuteInGap(gap, 37.5, 1.25)).toBe(hm(11));
    expect(minuteInGap(gap, 44, 1.25)).toBe(hm(11));
    expect(minuteInGap(gap, 500, 1.25)).toBe(hm(11, 29));
    expect(minuteInGap({ start: hm(10, 35), end: hm(11, 30) }, 0, 1.25)).toBe(hm(10, 35));
  });

  it("does not count work during lunch as occupancy", () => {
    const state = book(empty([pad30]), "pad30", hm(11));
    const later = { ...state, salon: { ...state.salon, lunch: { start: hm(11, 30), end: hm(12) } } };
    expect(utilisation(later, day, 1, "anna") * workMinutes(later, "anna", day)).toBeCloseTo(30);
  });

  it("keeps a deleted treatment's room requirement for a customer in the trash", () => {
    const roomy = service("roomy", 30, { resourceIds: ["room-1"] });
    const other = service("other", 30, { staffIds: ["erik"], resourceIds: ["room-1"] });
    const state = book(empty([roomy, other, trim], 1), "roomy", hm(10));
    const customerId = state.bookings[0].customerId;
    const deleted = reduce(reduce(state, { type: "customer/delete", id: customerId }), { type: "service/delete", id: "roomy" });
    expect(deleted.retiredServices.map((s) => s.id)).toContain("roomy");
    const taken = book(deleted, "other", hm(10), 1, "erik");
    const restored = restoreEntry(taken, taken.trash[0].id);
    expect(restored.bookings.find((b) => b.serviceId === "roomy")?.status).toBe("cancelled");
  });

  describe("completed visits are never rechecked on restore or undo", () => {
    const completeAll = (state: DemoState) => state.bookings.reduce((next, b) => reduce(next, { type: "booking/complete", id: b.id }), state);

    it("keeps a completed visit after the staff member's hours changed", () => {
      const booked = completeAll(book(empty([padded]), "padded", hm(10)));
      const shifted = { ...booked, staff: booked.staff.map((p) => (p.id === "anna" ? { ...p, week: { ...p.week, [weekday(day)]: { start: hm(11), end: hm(17) } } } : p)) };
      const customerId = shifted.bookings[0].customerId;
      const deleted = reduce(shifted, { type: "customer/delete", id: customerId });
      expect(restoreEntry(deleted, deleted.trash[0].id).bookings[0]).toEqual(shifted.bookings[0]);
      const logged = applyAction(shifted, { type: "customer/delete", id: customerId }, meta);
      expect(undoBlockReason(logged, logged.log[0])).toBeUndefined();
    });

    it("holds no clean-up time after a completed visit, so a restore cannot overlap a visit booked in the meantime", () => {
      // 10:00-11:00 with 15 minutes of clean-up, completed; its customer is deleted and a visit is booked at 11:05.
      const completed = completeAll(book(empty([padded, trim]), "padded", hm(10), 0));
      const customerId = completed.bookings[0].customerId;
      const deleted = reduce(completed, { type: "customer/delete", id: customerId });
      const taken = book(deleted, "trim", hm(11, 5), 1);
      expect(taken.bookings).toHaveLength(1);
      const restored = restoreEntry(taken, taken.trash[0].id);
      const [back, newer] = restored.bookings.map((b) => ({ status: b.status, start: b.start })).sort((a, b) => a.start - b.start);
      expect([back, newer]).toEqual([{ status: "completed", start: hm(10) }, { status: "booked", start: hm(11, 5) }]);
      // A visit that is still booked holds its clean-up as before.
      const booked = book(empty([padded, trim]), "padded", hm(10), 0);
      expect(isFree(booked, "anna", day, hm(11, 5), needOf(trim))).toBe(false);
      expect(isFree(completeAll(booked), "anna", day, hm(11, 5), needOf(trim))).toBe(true);
      expect(isFree(completeAll(booked), "anna", day, hm(10, 30), needOf(trim))).toBe(false);
    });

    it("keeps the recorded rooms of completed visits in the same bundle", () => {
      const roomA = service("room-a", 30, { resourceIds: ["room-1", "room-2"] });
      const roomB = service("room-b", 30, { staffIds: ["erik"], resourceIds: ["room-1"] });
      const booked = book(book(empty([roomA, roomB, trim]), "room-b", hm(10), 0, "erik"), "room-a", hm(10));
      const state = completeAll({ ...booked, bookings: [...booked.bookings].reverse() });
      expect(state.bookings.map((b) => b.resourceId)).toEqual(["room-2", "room-1"]);
      const deleted = reduce(state, { type: "customer/delete", id: state.bookings[0].customerId });
      const restored = restoreEntry(deleted, deleted.trash[0].id);
      expect(restored.bookings.map((b) => [b.status, b.resourceId])).toEqual([["completed", "room-2"], ["completed", "room-1"]]);
    });

    describe("when keeping the recorded rooms would strand a visit", () => {
      // Visit A recorded room 2 and B room 3 (valid together). Room 3 is then taken by a third stylist.
      // Keeping A in room 2 leaves B with no room; placing both afresh gives A room 1 and B room 2.
      const setup = () => {
        const a = service("room-a", 30, { resourceIds: ["room-1", "room-2", "room-3"] });
        const b = service("room-b", 30, { staffIds: ["erik"], resourceIds: ["room-2", "room-3"] });
        const c = service("room-c", 30, { staffIds: ["staff-3"], resourceIds: ["room-3"] });
        const base = empty([a, b, c, trim]);
        const third = { ...base.staff[1], id: "staff-3" as const, firstName: "Third" };
        const rooms = [...base.resources.slice(0, 2), { id: "room-3", name: "Room 3", kind: "room" as const }];
        const booked = book(book({ ...base, staff: [...base.staff, third], resources: rooms }, "room-a", hm(10)), "room-b", hm(10), 0, "erik");
        const recorded = { ...booked, bookings: booked.bookings.map((x) => ({ ...x, resourceId: x.serviceId === "room-a" ? "room-2" : "room-3" })) };
        return { recorded, customerId: recorded.bookings[0].customerId };
      };
      const rooms = (state: DemoState) => state.bookings.filter((x) => x.serviceId !== "room-c").map((x) => [x.status, x.resourceId]);

      it("places the customer's visits again without them on restore", () => {
        const { recorded, customerId } = setup();
        const deleted = reduce(recorded, { type: "customer/delete", id: customerId });
        const taken = book(deleted, "room-c", hm(10), 1, "staff-3");
        expect(taken.bookings[0].resourceId).toBe("room-3");
        expect(rooms(restoreEntry(taken, taken.trash[0].id))).toEqual([["booked", "room-1"], ["booked", "room-2"]]);
      });

      it("places the visits again without them on undo", () => {
        const { recorded, customerId } = setup();
        const logged = applyAction(recorded, { type: "customer/delete", id: customerId }, meta);
        const taken = book(logged, "room-c", hm(10), 1, "staff-3");
        expect(rooms(undoEntry(taken, taken.log[0].id))).toEqual([["booked", "room-1"], ["booked", "room-2"]]);
      });
    });

    it("keeps the recorded rooms of upcoming visits in the same bundle", () => {
      const roomA = service("room-a", 30, { resourceIds: ["room-1", "room-2"] });
      const roomB = service("room-b", 30, { staffIds: ["erik"], resourceIds: ["room-1"] });
      const booked = book(book(empty([roomA, roomB, trim]), "room-b", hm(10), 0, "erik"), "room-a", hm(10));
      const state = { ...booked, bookings: [...booked.bookings].reverse() };
      const deleted = reduce(state, { type: "customer/delete", id: state.bookings[0].customerId });
      const restored = restoreEntry(deleted, deleted.trash[0].id);
      expect(restored.bookings.map((b) => [b.status, b.resourceId]).sort()).toEqual([["booked", "room-1"], ["booked", "room-2"]]);
    });

    it("does not let a gift card cancel a completed visit it never paid for", () => {
      const state = empty([trim]);
      const done = completeAll(book(state, "trim", hm(10)));
      const cards = [{ id: "g-1", code: "EKO-TEST-0001", amount: 100, recipient: "Fictional", message: "", soldOn: "2026-11-01", redemptions: [
        { bookingId: "x-1", amount: 60, date: day }, { bookingId: "y-1", amount: 70, date: day },
      ] }];
      const withCancelled = reduce(reduce({ ...done, giftCards: cards }, { type: "booking/create", id: "x-1", customerId: done.bookings[0].customerId, serviceId: "trim", staffId: "anna", date: day, start: hm(14), source: "phone" }), { type: "booking/cancel", id: "x-1" });
      const customerId = withCancelled.bookings[0].customerId;
      const deleted = reduce(withCancelled, { type: "customer/delete", id: customerId });
      const restored = restoreEntry(deleted, deleted.trash[0].id);
      expect(restored.bookings.map((b) => b.status).sort()).toEqual(["cancelled", "completed"]);
    });
  });
});
