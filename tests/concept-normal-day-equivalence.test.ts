import { expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { addDays } from "@/concept/data/dates";
import { busyIntervals, freeStarts, isActive, isFree, staffIntervals, workWindow, type Need } from "@/concept/data/slots";
import type { DateKey, DemoState, StaffId } from "@/concept/data/types";

// Days without a clock change are judged exactly as the wall-clock rules were before the elapsed clock:
// this keeps a copy of those rules and compares them with the shared functions over 100 ordinary demo days.
// 2026-11-16 to 2027-03-14 holds no Europe/Stockholm clock change. Fictional data only.

const start = "2026-11-16";
const base = createDemoState(start);
// The completed-visit rule (no clean-up after a finished visit) is a deliberate change, so the fixture has none.
const state: DemoState = {
  ...base,
  bookings: base.bookings.map((b, i) => ({
    ...b,
    status: b.status === "completed" ? "booked" : b.status,
    ...(i % 3 === 0 ? { bufferBefore: 10, bufferAfter: 15 } : {}),
    ...(i % 7 === 0 ? { processing: { after: 20, duration: 20 } } : {}),
  })),
};

const intersects = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** The wall-clock rule as it was: window, buffers, staff overlap and room overlap, every time in plain minutes. */
function before(ctx: DemoState, staffId: StaffId, date: DateKey, at: number, need: Need, ignoreId?: string) {
  if (!Number.isInteger(at) || need.duration <= 0) return false;
  const window = workWindow(ctx, staffId, date);
  if (!window) return false;
  const end = at + need.duration;
  if (at < window.start || end > window.end) return false;
  const mine = staffIntervals(need, at, need.duration);
  if (mine.some((part) => part.start < 0 || part.end > 24 * 60)) return false;
  if (busyIntervals(ctx, staffId, date, ignoreId).some((busy) => mine.some((part) => intersects(part, busy)))) return false;
  const service = ctx.services.find((s) => s.id === need.serviceId);
  const rooms = (service?.resourceIds ?? []).filter((id) => ctx.resources.some((r) => r.id === id));
  return rooms.length === 0 || rooms.some((id) => !ctx.bookings.some((b) => b.date === date && isActive(b) && b.id !== ignoreId && b.resourceId === id && at < b.start + b.duration && end > b.start));
}

it("judges ordinary days exactly as the wall-clock rules did, for isFree and freeStarts", () => {
  const needs: Need[] = [
    ...state.services.slice(0, 4).map((s) => ({ serviceId: s.id, duration: s.duration })),
    { serviceId: state.services[0].id, duration: 45, bufferBefore: 10, bufferAfter: 20 },
  ];
  let checked = 0;
  for (let day = 0; day < 100; day++) {
    const date = addDays(start, day);
    for (const person of state.staff) {
      for (const need of needs) {
        const expected: number[] = [];
        const window = workWindow(state, person.id, date);
        for (let t = Math.ceil((window?.start ?? 0) / 15) * 15; window && t + need.duration <= window.end; t += 15) if (before(state, person.id, date, t, need)) expected.push(t);
        expect(freeStarts(state, person.id, date, need)).toEqual(expected);
        for (const t of [0, 7, 540, 545, 600, 720, 1000, 1439]) {
          expect(isFree(state, person.id, date, t, need)).toBe(before(state, person.id, date, t, need));
          checked++;
        }
      }
    }
  }
  expect(checked).toBeGreaterThan(3000);
}, 120_000);
