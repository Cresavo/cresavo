import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { TimePicker } from "@/concept/booking/time-picker";
import { isDateKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { setLocale } from "@/concept/i18n";
import { swipeDirection } from "@/concept/studio/calendar/month-reveal";
import { monthCells, shiftMonth } from "@/concept/ui/month-grid";

const today = "2026-11-16";
const state = createDemoState(today);

afterEach(() => setLocale("en"));

describe("month grid", () => {
  it("lays out a month in Monday-first weeks", () => {
    // 1 November 2026 is a Sunday: six blanks before it.
    const cells = monthCells("2026-11");
    expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(cells.filter(Boolean)).toHaveLength(30);
    expect(monthCells("2026-06")[0]).toBe("2026-06-01");
  });

  it("moves across a year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-11", 14)).toBe("2028-01");
  });

  it("accepts only real days as a calendar link", () => {
    expect(isDateKey("2026-12-03")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("tomorrow")).toBe(false);
  });
});

describe("calendar month swipe", () => {
  it("opens on a swipe up, closes on a swipe down and ignores scrolls and sideways moves", () => {
    expect(swipeDirection(4, -60, false)).toBe(-1);
    expect(swipeDirection(-4, 60, false)).toBe(1);
    expect(swipeDirection(0, -20, false)).toBe(0);
    expect(swipeDirection(80, -50, false)).toBe(0);
    expect(swipeDirection(0, -80, true)).toBe(0);
  });
});

describe("booking time picker", () => {
  it("shows a month to pick from with the chosen day's times beside it", () => {
    const serviceId = state.services[0].id;
    const html = renderToStaticMarkup(createElement(TimePicker, { state, serviceId, clock: { today, minutes: 480 }, onPick: () => {}, onWaitlist: () => {} }));
    expect(html).toContain('role="group" aria-label="Choose a day"');
    expect(html).toContain("November 2026");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-current="date"');
    // Days before today cannot be chosen.
    expect(html).toMatch(/data-date="2026-11-10" disabled=""/);
    expect(html).toContain("ui-day-time-layout");
  });
});
