import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { openSlots } from "@/concept/booking/suggest";
import { buildIntentContext } from "@/concept/command/intent-context";
import { commandExamples } from "@/concept/command/examples";
import { proposalFor, type Proposal } from "@/concept/command/proposal";
import { addDays, formatTime } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { exceptionFor, freeGaps, freeStarts, isFree, lunchFor, needOf, openingFor, workWindow } from "@/concept/data/slots";
import type { Booking, DemoState } from "@/concept/data/types";
import { interpretCommand } from "@/concept/intent";
import { applyAction } from "@/concept/log/capture";
import { undoEntry } from "@/concept/log/undo";
import { canCommand, canOpen } from "@/concept/ops/access";
import { closureSuggestions } from "@/concept/ops/holidays";
import { needsMoving } from "@/concept/ops/needs-moving";
import { getAvailability } from "@/concept/tools/read";
import type { ToolContext } from "@/concept/tools/define";

// Monday 16 November 2026, 09:00. Friday is the 20th, Saturday the 21st.
const today = "2026-11-16";
const friday = "2026-11-20";
const saturday = "2026-11-21";
const clock = { today, minutes: 9 * 60 };
const base = createDemoState(today);
const annaService = base.services.find((s) => s.staffIds.includes("anna") && s.duration === 60)!;
const erikService = base.services.find((s) => s.staffIds.includes("erik") && s.duration === 60)!;
const meta = { actor: "owner", source: "button", at: 0 } as const;

const act = (state: DemoState, action: Parameters<typeof reduce>[1]) => reduce(state, action);
const annaOff = (state: DemoState, date = friday) => act(state, { type: "staff/off", staffId: "anna", dates: [date], reason: "sick" });

function propose(text: string, state = base, role: "owner" | "staff" = "owner"): Proposal {
  return proposalFor(state, interpretCommand(text, buildIntentContext(state, today, clock.minutes)), text, clock, commandExamples(state, today), role);
}

describe("availability", () => {
  it("follows the weekly template and the salon's hours", () => {
    expect(workWindow(base, "anna", friday)).toEqual({ start: 9 * 60, end: 17 * 60 });
    expect(workWindow(base, "anna", saturday)).toBeNull();
    expect(workWindow(base, "erik", saturday)).toEqual({ start: 10 * 60, end: 15 * 60 });
    expect(freeStarts(base, "anna", saturday, needOf(annaService))).toEqual([]);
  });

  it("closes the whole day for a closure and opens it again", () => {
    const closed = act(base, { type: "salon/close", date: friday, name: "Training day" });
    expect(openingFor(closed.salon, friday)).toBeNull();
    expect(freeStarts(closed, "anna", friday, needOf(annaService))).toEqual([]);
    expect(freeGaps(closed, "erik", friday)).toEqual([]);
    const reopened = act(closed, { type: "salon/reopen", id: closed.salon.closures[0].id });
    expect(freeStarts(reopened, "anna", friday, needOf(annaService)).length).toBeGreaterThan(0);
  });

  it("applies days off and shifts from exceptions", () => {
    const off = annaOff(base);
    expect(workWindow(off, "anna", friday)).toBeNull();
    expect(freeStarts(off, "anna", friday, needOf(annaService))).toEqual([]);
    expect(exceptionFor(off.exceptions, "anna", friday)).toMatchObject({ kind: "off", reason: "sick" });

    const quietSaturday = "2026-12-19";
    const shifted = act(base, { type: "staff/shift", staffId: "erik", date: quietSaturday, start: 10 * 60, end: 14 * 60 });
    const starts = freeStarts(shifted, "erik", quietSaturday, needOf(erikService));
    expect(starts.length).toBeGreaterThan(0);
    expect(Math.max(...starts) + 60).toBeLessThanOrEqual(14 * 60);

    const extra = act(base, { type: "staff/shift", staffId: "anna", date: saturday, start: 10 * 60, end: 13 * 60 });
    expect(workWindow(extra, "anna", saturday)).toEqual({ start: 10 * 60, end: 13 * 60 });
  });

  it("keeps a shift inside the salon's opening hours", () => {
    const wide = act(base, { type: "staff/shift", staffId: "erik", date: saturday, start: 8 * 60, end: 20 * 60 });
    expect(workWindow(wide, "erik", saturday)).toEqual({ start: 10 * 60, end: 15 * 60 });
  });

  it("replaces an earlier exception for the same day", () => {
    const next = act(annaOff(base), { type: "staff/shift", staffId: "anna", date: friday, start: 12 * 60, end: 16 * 60 });
    expect(next.exceptions.filter((e) => e.staffId === "anna" && e.date === friday)).toHaveLength(1);
    expect(workWindow(next, "anna", friday)).toEqual({ start: 12 * 60, end: 16 * 60 });
  });

  it("uses the lunch break, and no break when it is switched off", () => {
    expect(lunchFor(base.salon, friday)).toEqual({ start: 12 * 60, end: 13 * 60 });
    const noLunch = act(base, { type: "salon/hours", hours: base.salon.hours, lunch: null });
    expect(lunchFor(noLunch.salon, friday)).toBeNull();
    const empty = { ...base, bookings: [] };
    const day = "2026-11-24";
    expect(freeStarts(empty, "anna", day, needOf(annaService))).not.toContain(12 * 60);
    expect(freeStarts({ ...empty, salon: noLunch.salon }, "anna", day, needOf(annaService))).toContain(12 * 60);
  });

  it("changes opening hours and ignores invalid ones", () => {
    const longer = act(base, { type: "salon/hours", hours: { ...base.salon.hours, 1: { open: 8 * 60, close: 20 * 60 } }, lunch: base.salon.lunch });
    expect(openingFor(longer.salon, "2026-11-23")).toEqual({ open: 8 * 60, close: 20 * 60 });
    expect(act(base, { type: "salon/hours", hours: { ...base.salon.hours, 1: { open: 18 * 60, close: 9 * 60 } }, lunch: base.salon.lunch })).toBe(base);
    expect(act(base, { type: "salon/hours", hours: base.salon.hours, lunch: { start: 13 * 60, end: 12 * 60 } })).toBe(base);
    expect(act(base, { type: "salon/close", date: "not a day", name: "x" })).toBe(base);
    expect(act(base, { type: "staff/shift", staffId: "erik", date: saturday, start: 14 * 60, end: 10 * 60 })).toBe(base);
  });
});

describe("one source of free times", () => {
  const annaOnly = base.services.find((s) => s.staffIds.length === 1 && s.staffIds[0] === "anna")!;
  const off = annaOff(base);

  it("removes Anna's times from the customer page, the phone sheet, the command box and the tools", () => {
    expect(openSlots(base, annaOnly.id, friday, clock).length).toBeGreaterThan(0);
    expect(openSlots(off, annaOnly.id, friday, clock)).toEqual([]);
    expect(freeGaps(off, "anna", friday)).toEqual([]);

    const context: ToolContext = { state: off, clock };
    const result = getAvailability.run(context, { serviceId: annaOnly.id, date: friday }) as { staff: { id: string; starts: string[] }[] };
    expect(result.staff.find((s) => s.id === "anna")!.starts).toEqual([]);

    const customer = base.customers[0];
    const text = `Book ${customer.firstName} ${customer.lastName} for ${annaOnly.name} on ${friday} at 10:00`;
    const answer = propose(text, off);
    expect(answer.kind).toBe("message");
  });
});

describe("rooms", () => {
  const oneRoom = (state: DemoState): DemoState => {
    let next = act(state, { type: "resource/remove", id: "room-2" });
    next = { ...next, bookings: next.bookings.filter((b) => b.date !== friday) };
    return next;
  };
  const book = (state: DemoState, staffId: "anna" | "erik", serviceId: string, start: number) =>
    act(state, { type: "booking/create", customerId: state.customers[0].id, serviceId, staffId, date: friday, start, source: "phone" });

  it("generated data never double-books a room", () => {
    const seen = new Map<string, Booking>();
    for (const b of base.bookings.filter((x) => x.status !== "cancelled")) {
      if (!b.resourceId) continue;
      const key = `${b.date}|${b.resourceId}`;
      const clashing = base.bookings.filter((o) => o !== b && o.status !== "cancelled" && `${o.date}|${o.resourceId}` === key && o.start < b.start + b.duration && b.start < o.start + o.duration);
      expect(clashing).toEqual([]);
      seen.set(b.id, b);
    }
    expect(seen.size).toBeGreaterThan(100);
  });

  it("gives each booking a room and keeps two bookings apart when there is one room", () => {
    const state = oneRoom(base);
    const first = book(state, "anna", annaService.id, 10 * 60);
    expect(first.bookings.at(-1)?.resourceId).toBe("room-1");
    expect(isFree(first, "erik", friday, 10 * 60, needOf(erikService))).toBe(false);
    expect(book(first, "erik", erikService.id, 10 * 60)).toBe(first);
    const later = book(first, "erik", erikService.id, 11 * 60);
    expect(later.bookings).toHaveLength(first.bookings.length + 1);
  });

  it("uses a second room when there is one and frees the room on cancel", () => {
    const state = { ...base, bookings: base.bookings.filter((b) => b.date !== friday) };
    const first = book(state, "anna", annaService.id, 10 * 60);
    const second = book(first, "erik", erikService.id, 10 * 60);
    expect(second.bookings.at(-1)?.resourceId).toBe("room-2");

    const crowded = oneRoom(base);
    const booked = book(crowded, "anna", annaService.id, 10 * 60);
    const cancelled = act(booked, { type: "booking/cancel", id: booked.bookings.at(-1)!.id });
    expect(isFree(cancelled, "erik", friday, 10 * 60, needOf(erikService))).toBe(true);
  });

  it("treatments without a room are not limited", () => {
    const state = act(oneRoom(base), { type: "service/resources", id: erikService.id, resourceIds: [] });
    const first = book(state, "anna", annaService.id, 10 * 60);
    expect(isFree(first, "erik", friday, 10 * 60, needOf(erikService))).toBe(true);
  });

  it("moving a booking checks the room too", () => {
    const state = oneRoom(base);
    const first = book(book(state, "anna", annaService.id, 10 * 60), "erik", erikService.id, 11 * 60);
    const erikBooking = first.bookings.at(-1)!;
    expect(act(first, { type: "booking/move", id: erikBooking.id, date: friday, start: 10 * 60 })).toBe(first);
    expect(act(first, { type: "booking/move", id: erikBooking.id, date: friday, start: 14 * 60 }).bookings.find((b) => b.id === erikBooking.id)?.start).toBe(14 * 60);
  });

  it("adds, renames and removes rooms", () => {
    let next = act(base, { type: "resource/add", name: " Stone room ", kind: "room" });
    const added = next.resources.at(-1)!;
    expect(added.name).toBe("Stone room");
    next = act(next, { type: "resource/rename", id: added.id, name: "Hot-stone room" });
    next = act(next, { type: "service/resources", id: annaService.id, resourceIds: [added.id, "missing"] });
    expect(next.services.find((s) => s.id === annaService.id)?.resourceIds).toEqual([added.id]);
    next = act(next, { type: "resource/remove", id: added.id });
    expect(next.services.find((s) => s.id === annaService.id)?.resourceIds).toEqual([]);
    expect(act(base, { type: "resource/add", name: "  ", kind: "room" })).toBe(base);
  });
});

describe("needs moving", () => {
  const annaBookings = base.bookings.filter((b) => b.date === friday && b.staffId === "anna" && b.status === "booked");

  it("is empty before anything changes", () => {
    expect(needsMoving(base, today, clock.minutes)).toEqual([]);
  });

  it("lists Anna's bookings on the day she is off, and drops them once moved", () => {
    expect(annaBookings.length).toBeGreaterThan(0);
    const off = annaOff(base);
    const list = needsMoving(off, today, clock.minutes);
    expect(list.map((n) => n.booking.id).sort()).toEqual(annaBookings.map((b) => b.id).sort());
    expect(new Set(list.map((n) => n.reason))).toEqual(new Set(["off"]));

    const first = list[0].booking;
    let target = addDays(friday, 3);
    while (!freeStarts(off, "anna", target, first, { ignoreId: first.id }).length) target = addDays(target, 1);
    const [start] = freeStarts(off, "anna", target, first, { ignoreId: first.id });
    const moved = act(off, { type: "booking/move", id: first.id, date: target, start });
    expect(needsMoving(moved, today, clock.minutes)).toHaveLength(list.length - 1);
  });

  it("lists every booking on a closed day and those outside a shortened shift", () => {
    const closed = act(base, { type: "salon/close", date: friday, name: "Training" });
    const all = needsMoving(closed, today, clock.minutes);
    expect(all.every((n) => n.reason === "closed" && n.booking.date === friday)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(annaBookings.length);

    const short = act(base, { type: "staff/shift", staffId: "anna", date: friday, start: 9 * 60, end: 11 * 60 });
    const outside = needsMoving(short, today, clock.minutes);
    expect(outside.length).toBeGreaterThan(0);
    expect(outside.every((n) => n.reason === "hours" && n.booking.staffId === "anna")).toBe(true);
  });

  it("ignores cancelled bookings and the past", () => {
    const off = annaOff(base, "2026-11-13");
    expect(needsMoving(off, today, clock.minutes)).toEqual([]);
  });
});

describe("log and undo", () => {
  it("records a day off and takes it back", () => {
    const applied = applyAction(base, { type: "staff/off", staffId: "anna", dates: [friday], reason: "vacation" }, meta);
    expect(applied.log[0]).toMatchObject({ type: "staff/off", summary: "Marked Anna as off" });
    expect(applied.exceptions).toHaveLength(1);
    const undone = undoEntry(applied, applied.log[0].id);
    expect(undone.exceptions).toEqual([]);
  });

  it("undoes closing a day and editing the hours", () => {
    const closed = applyAction(base, { type: "salon/close", date: friday, name: "Training" }, meta);
    expect(undoEntry(closed, closed.log[0].id).salon.closures).toEqual([]);
    const edited = applyAction(base, { type: "staff/week", staffId: "erik", week: { ...base.staff[1].week, 6: null } }, meta);
    expect(workWindow(edited, "erik", saturday)).toBeNull();
    expect(workWindow(undoEntry(edited, edited.log[0].id), "erik", saturday)).not.toBeNull();
  });
});

describe("holiday suggestions", () => {
  it("offers Swedish holidays that fall on open days", () => {
    const names = closureSuggestions(base.salon, today, 40).map((h) => `${h.date} ${h.name}`);
    expect(names).toContain("2026-12-24 holiday.christmasEve");
    expect(names).toContain("2027-03-26 holiday.goodFriday");
    expect(names).toContain("2027-06-25 holiday.midsummerEve");
    expect(names.some((n) => n.includes("easterSunday"))).toBe(false);
  });
});

describe("roles", () => {
  it("lets staff open their own pages only", () => {
    for (const path of ["/studio", "/studio/calendar", "/studio/customers", "/studio/customers/k001"]) expect(canOpen("staff", path)).toBe(true);
    for (const path of ["/studio/more", "/studio/more/finance", "/studio/more/settings", "/studio/more/features", "/studio/more/stock", "/studio/inbox", "/studio/customers/import", "/studio/customers/due-back", "/studio/customers/waitlist"]) {
      expect(canOpen("staff", path)).toBe(false);
      expect(canOpen("owner", path)).toBe(true);
    }
  });

  it("limits the command box to bookings for staff", () => {
    for (const action of ["book", "move", "cancel", "question"] as const) expect(canCommand("staff", action)).toBe(true);
    for (const action of ["revenue", "change-price", "campaign", "order-stock", "staff-off", "close-salon", "staff-shift", "inactive-customers"] as const) {
      expect(canCommand("staff", action)).toBe(false);
      expect(canCommand("owner", action)).toBe(true);
    }
    expect(propose("What have I earned this month?", base, "staff")).toMatchObject({ kind: "message" });
    expect(propose("Anna is off on Friday", base, "staff")).toMatchObject({ kind: "message" });
    expect(propose("Anna is off on Friday", base, "owner")).toMatchObject({ kind: "change" });
  });
});

describe("command box: schedule proposals", () => {
  it("understands 'Anna is off on Friday'", () => {
    const intent = interpretCommand("Anna is off on Friday", buildIntentContext(base, today, clock.minutes));
    expect(intent).toMatchObject({ action: "staff-off", params: { staffId: "anna", date: friday, reason: "other" } });
    const proposal = propose("Anna is off on Friday");
    expect(proposal).toMatchObject({ kind: "change", action: { type: "staff/off", staffId: "anna", dates: [friday] } });
    const rows = (proposal as Extract<Proposal, { kind: "change" }>).rows;
    expect(rows[1].after).toMatch(/\d+ bookings? need/);
    expect(propose("Anna is sick on Friday")).toMatchObject({ action: { reason: "sick" } });
    expect(propose("Erik is on holiday tomorrow")).toMatchObject({ action: { staffId: "erik", reason: "vacation", dates: ["2026-11-17"] } });
  });

  it("asks which day or person, and refuses a day she is already off", () => {
    expect(interpretCommand("Anna is off", buildIntentContext(base, today, clock.minutes))).toMatchObject({ action: "question", question: expect.stringContaining("Which day") });
    expect(propose("Anna is off on Saturday")).toMatchObject({ kind: "message" });
    expect(propose("Anna is off on Friday", annaOff(base))).toMatchObject({ kind: "message" });
  });

  it("understands 'close the salon on 24 December'", () => {
    const intent = interpretCommand("close the salon on 24 December", buildIntentContext(base, today, clock.minutes));
    expect(intent).toMatchObject({ action: "close-salon", params: { date: "2026-12-24" } });
    expect(propose("close the salon on 24 December")).toMatchObject({
      kind: "change",
      action: { type: "salon/close", date: "2026-12-24", name: "Christmas Eve" },
      destructive: true,
    });
    expect(propose("close the salon on December 24th")).toMatchObject({ action: { date: "2026-12-24" } });
    expect(propose("close the salon on 2026-12-01")).toMatchObject({ action: { type: "salon/close", name: "Closed" } });
    expect(propose("close the salon on 22 November")).toMatchObject({ kind: "message" });
  });

  it("rolls a past calendar date over to next year", () => {
    expect(interpretCommand("close the salon on 2 november", buildIntentContext(base, today, clock.minutes)).params.date).toBe("2027-11-02");
  });

  it("understands 'Erik works Saturday 10–14'", () => {
    const intent = interpretCommand("Erik works Saturday 10–14", buildIntentContext(base, today, clock.minutes));
    expect(intent).toMatchObject({ action: "staff-shift", params: { staffId: "erik", date: saturday, time: "10:00", endTime: "14:00" } });
    const proposal = propose("Erik works Saturday 10–14") as Extract<Proposal, { kind: "change" }>;
    expect(proposal.action).toEqual({ type: "staff/shift", staffId: "erik", date: saturday, start: 600, end: 840 });
    expect(proposal.rows[0]).toMatchObject({ before: "10:00–15:00", after: "10:00–14:00" });
    expect(propose("Erik works Saturday 9am to 12pm")).toMatchObject({ kind: "message", text: expect.stringContaining("10:00") });
    expect(interpretCommand("Erik works Saturday", buildIntentContext(base, today, clock.minutes))).toMatchObject({ action: "question" });
    expect(propose("Anna works Sunday 10-14")).toMatchObject({ kind: "message" });
  });

  it("applies an approved proposal and the free times follow", () => {
    const proposal = propose("Anna is off on Friday") as Extract<Proposal, { kind: "change" }>;
    const next = reduce(base, proposal.action);
    expect(freeStarts(next, "anna", friday, needOf(annaService))).toEqual([]);
    expect(formatTime(freeStarts(base, "anna", friday, needOf(annaService))[0])).toMatch(/^\d\d:\d\d$/);
  });

  it("leaves other commands alone", () => {
    expect(interpretCommand("Move Anna Berg to Friday at 10:00", buildIntentContext(base, today, clock.minutes)).action).not.toBe("staff-off");
    expect(interpretCommand("10% off deep tissue massage", buildIntentContext(base, today, clock.minutes)).action).toBe("campaign");
  });
});
