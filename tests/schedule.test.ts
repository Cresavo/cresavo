import { expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  weeklySchema,
  exceptionsSchema,
  scheduledSlots,
  localClock,
  scheduleContains,
} from "../src/lib/schedule";
import { ZONE } from "../src/lib/time";

const allWeek = weeklySchema.parse(
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    periods: [{ start: "09:00", end: "17:00" }],
    breaks: [{ start: "12:00", end: "13:00" }],
  })),
);
const now = DateTime.fromISO("2027-03-01T00:00:00", { zone: ZONE });
it("använder veckodag, paus, varaktighet och ersättande datumundantag", () => {
  const slots = scheduledSlots(allWeek, [], "2027-03-02", 60, now).map((s) =>
    DateTime.fromISO(s).setZone(ZONE).toFormat("HH:mm"),
  );
  expect(slots).toContain("09:00");
  expect(slots).not.toContain("11:30");
  expect(slots).not.toContain("12:00");
  expect(slots).toContain("16:00");
  expect(slots).not.toContain("16:30");
  expect(
    scheduledSlots(
      allWeek,
      exceptionsSchema.parse([{ date: "2027-03-02", periods: [] }]),
      "2027-03-02",
      30,
      now,
    ),
  ).toEqual([]);
  expect(scheduledSlots(allWeek, [], "2027-05-20", 30, now)).toEqual([]);
});
it("skapar inga fiktiva eller tvetydiga lokala starttider vid DST", () => {
  const weekly = weeklySchema.parse([
    { weekday: 7, periods: [{ start: "01:00", end: "05:00" }] },
  ]);
  for (const day of ["2027-03-28", "2027-10-31"]) {
    expect(localClock(day, "02:30")).toBeNull();
    const before = DateTime.fromISO(day, { zone: ZONE }).minus({ days: 1 });
    const slots = scheduledSlots(weekly, [], day, 30, before);
    expect(slots.length).toBeGreaterThan(0);
    expect(
      slots.map((s) => DateTime.fromISO(s).setZone(ZONE).toFormat("HH:mm")),
    ).not.toContain("02:30");
    for (const slot of slots) expect(DateTime.fromISO(slot).isValid).toBe(true);
  }
  expect(localClock("2027-03-29", "09:00")!.toUTC().toISO()).toBe(
    "2027-03-29T07:00:00.000Z",
  );
  expect(localClock("2027-11-01", "09:00")!.toUTC().toISO()).toBe(
    "2027-11-01T08:00:00.000Z",
  );
});
it("tillåter ett slut vid midnatt men inte ett skift över nästa dygn", () => {
  const weekly = weeklySchema.parse([
    { weekday: 2, periods: [{ start: "22:00", end: "24:00" }] },
  ]);
  const start = DateTime.fromISO("2027-03-02T23:00", { zone: ZONE });
  expect(
    scheduleContains(
      weekly,
      [],
      start.toJSDate(),
      start.plus({ hours: 1 }).toJSDate(),
    ),
  ).toBe(true);
  expect(
    scheduleContains(
      weekly,
      [],
      start.toJSDate(),
      start.plus({ hours: 2 }).toJSDate(),
    ),
  ).toBe(false);
});
it("nekar överlappande/reverserade perioder, paus utanför arbetstid och duplicerade datum", () => {
  expect(() =>
    weeklySchema.parse([
      { weekday: 1, periods: [{ start: "12:00", end: "09:00" }] },
    ]),
  ).toThrow();
  expect(() =>
    weeklySchema.parse([
      {
        weekday: 1,
        periods: [
          { start: "09:00", end: "12:00" },
          { start: "11:00", end: "13:00" },
        ],
      },
    ]),
  ).toThrow();
  expect(() =>
    weeklySchema.parse([
      {
        weekday: 1,
        periods: [{ start: "09:00", end: "12:00" }],
        breaks: [{ start: "13:00", end: "14:00" }],
      },
    ]),
  ).toThrow();
  expect(() =>
    exceptionsSchema.parse([
      { date: "2027-03-02", periods: [] },
      { date: "2027-03-02", periods: [] },
    ]),
  ).toThrow();
});
