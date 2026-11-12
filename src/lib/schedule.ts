import { DateTime } from "luxon";
import { z } from "zod";
import { dateSchema } from "./validation";
import { parseDay, ZONE } from "./time";

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);
export const clockMinutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const period = z
  .object({ start: clock, end: clock })
  .strict()
  .refine((v) => clockMinutes(v.start) < clockMinutes(v.end));
const periods = z
  .array(period)
  .max(8)
  .refine((rows) => {
    const sorted = [...rows].sort((a, b) => a.start.localeCompare(b.start));
    return sorted.every((row, i) => !i || sorted[i - 1].end <= row.start);
  });
const dayFields = { periods, breaks: periods.default([]) };
const validBreaks = (v: {
  periods: { start: string; end: string }[];
  breaks: { start: string; end: string }[];
}) =>
  v.breaks.every((pause) =>
    v.periods.some((p) => p.start <= pause.start && p.end >= pause.end),
  );
const weekday = z
  .object({ weekday: z.number().int().min(1).max(7), ...dayFields })
  .strict()
  .refine(validBreaks);
const exception = z
  .object({ date: dateSchema, ...dayFields })
  .strict()
  .refine(validBreaks);
export const weeklySchema = z
  .array(weekday)
  .max(7)
  .refine((rows) => new Set(rows.map((r) => r.weekday)).size === rows.length);
export const exceptionsSchema = z
  .array(exception)
  .max(60)
  .refine((rows) => new Set(rows.map((r) => r.date)).size === rows.length);
export type Weekly = z.output<typeof weeklySchema>;
export type Exceptions = z.output<typeof exceptionsSchema>;

export function scheduleDay(
  weekly: Weekly,
  exceptions: Exceptions,
  day: string,
) {
  const d = parseDay(day);
  return (
    exceptions.find((e) => e.date === day) ??
    weekly.find((w) => w.weekday === d.weekday) ?? { periods: [], breaks: [] }
  );
}

// Reject non-existent and ambiguous local boundaries. Never silently shift a shift.
export function localClock(day: string, value: string) {
  if (value === "24:00") return parseDay(day).plus({ days: 1 });
  const instant = DateTime.fromISO(`${day}T${value}`, { zone: ZONE });
  if (
    !instant.isValid ||
    instant.toFormat("HH:mm") !== value ||
    instant.getPossibleOffsets().length !== 1
  )
    return null;
  return instant;
}

export function scheduleContains(
  weekly: Weekly,
  exceptions: Exceptions,
  start: Date,
  end: Date,
) {
  const s = DateTime.fromJSDate(start, { zone: ZONE });
  const e = DateTime.fromJSDate(end, { zone: ZONE });
  const day = s.toISODate()!;
  const config = scheduleDay(weekly, exceptions, day);
  return (
    config.periods.some((p) => {
      const from = localClock(day, p.start),
        to = localClock(day, p.end);
      return from && to && s >= from && e <= to;
    }) &&
    !config.breaks.some((p) => {
      const from = localClock(day, p.start),
        to = localClock(day, p.end);
      return !from || !to || (s < to && e > from);
    })
  );
}

export function scheduledSlots(
  weekly: Weekly,
  exceptions: Exceptions,
  day: string,
  occupiedMinutes: number,
  now: DateTime = DateTime.now(),
) {
  const d = parseDay(day),
    today = now.setZone(ZONE).startOf("day");
  if (d < today || d > today.plus({ days: 60 })) return [];
  const result = new Set<string>();
  for (const p of scheduleDay(weekly, exceptions, day).periods) {
    for (
      let m = clockMinutes(p.start);
      m + occupiedMinutes <= clockMinutes(p.end);
      m += 30
    ) {
      const value = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const start = localClock(day, value);
      if (!start || start <= now) continue;
      const end = start.plus({ minutes: occupiedMinutes });
      if (
        scheduleContains(weekly, exceptions, start.toJSDate(), end.toJSDate())
      )
        result.add(start.toUTC().toISO()!);
    }
  }
  return [...result].sort();
}
