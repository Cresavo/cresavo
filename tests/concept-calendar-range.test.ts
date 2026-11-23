import { expect, it } from "vitest";
import { calendarRange } from "@/concept/studio/calendar/time-axis";

// The calendar grid takes in the preparation and clean-up of the visits it draws. Fictional minutes only.

const visit = (start: number, duration: number, bufferBefore?: number, bufferAfter?: number) => ({ start, duration, bufferBefore, bufferAfter });

it("keeps the opening hours when every visit and its buffers fit inside them", () => {
  expect(calendarRange(540, 1020, [visit(600, 60, 10, 15), visit(900, 60)])).toEqual({ from: 540, to: 1020 });
  expect(calendarRange(540, 1020, [])).toEqual({ from: 540, to: 1020 });
});

it("widens the grid to hold the clean-up after the day's last visit and the preparation before its first", () => {
  expect(calendarRange(540, 1020, [visit(960, 60, 0, 30)])).toEqual({ from: 540, to: 1050 });
  expect(calendarRange(540, 1020, [visit(540, 60, 20, 0)])).toEqual({ from: 520, to: 1020 });
});
