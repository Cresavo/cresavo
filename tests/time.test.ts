import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { parseDay, slotsForDay } from "../src/lib/time";
describe("Stockholm och öppettider", () => {
  it("tolkar samma klockslag med rätt sommar- och vinteroffset", () => {
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
  it("respekterar längd, veckoslut och bokningshorisont", () => {
    const now = DateTime.fromISO("2027-03-25T08:00", {
      zone: "Europe/Stockholm",
    });
    expect(slotsForDay("2027-03-29", 60, now)).toHaveLength(15);
    expect(slotsForDay("2027-03-29", 30, now)).toHaveLength(16);
    expect(slotsForDay("2027-03-28", 30, now)).toHaveLength(0);
  });
  it("avvisar ogiltiga datum och längder", () => {
    expect(() => parseDay("2027-02-30")).toThrow();
    expect(() => slotsForDay("2027-03-29", 0)).toThrow();
  });
});
