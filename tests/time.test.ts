import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { parseDay, slotsForDay } from "../src/lib/time";
describe("Stockholm time and opening hours", () => {
  it("interprets the same clock time with the correct summer and winter offsets", () => {
    expect(parseDay("2027-03-26").plus({ hours: 9 }).toUTC().toISO()).toContain(
      "08:00",
    );
    expect(parseDay("2027-03-29").plus({ hours: 9 }).toUTC().toISO()).toContain(
      "07:00",
    );
    expect(parseDay("2027-11-01").plus({ hours: 9 }).toUTC().toISO()).toContain(
      "08:00",
    );
  });
  it("respects duration, weekends, and the booking horizon", () => {
    const now = DateTime.fromISO("2027-03-25T08:00", {
      zone: "Europe/Stockholm",
    });
    expect(slotsForDay("2027-03-29", 60, now)).toHaveLength(15);
    expect(slotsForDay("2027-03-29", 30, now)).toHaveLength(16);
    expect(slotsForDay("2027-03-28", 30, now)).toHaveLength(0);
  });
  it("rejects invalid dates and durations", () => {
    expect(() => parseDay("2027-02-30")).toThrow();
    expect(() => slotsForDay("2027-03-29", 0)).toThrow();
  });
});
