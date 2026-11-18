import { DateTime } from "luxon";
export const ZONE = "Europe/Stockholm";
export function parseDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid date");
  const d = DateTime.fromISO(day, { zone: ZONE });
  if (!d.isValid || d.toISODate() !== day) throw new Error("Invalid date");
  return d.startOf("day");
}
export function slotsForDay(
  day: string,
  duration: number,
  now: DateTime = DateTime.now(),
) {
  const d = parseDay(day);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 480)
    throw new Error("Invalid duration");
  if (
    d.weekday > 5 ||
    d < now.setZone(ZONE).startOf("day") ||
    d > now.setZone(ZONE).startOf("day").plus({ days: 60 })
  )
    return [];
  const result: Date[] = [];
  for (let m = 9 * 60; m + duration <= 17 * 60; m += 30) {
    const t = d.plus({ minutes: m });
    if (t > now) result.push(t.toUTC().toJSDate());
  }
  return result;
}
export function localDay(d: Date) {
  return DateTime.fromJSDate(d, { zone: ZONE }).toISODate()!;
}
