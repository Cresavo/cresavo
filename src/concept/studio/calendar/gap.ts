import type { Interval } from "../../data/types";

/** A clicked minute rounds down to a quarter of an hour, as everywhere on the calendar. */
export const snapMinutes = (minutes: number) => Math.floor(minutes / 15) * 15;

/** The start a click `offset` pixels down a processing gap opens, kept inside the gap. */
export function minuteInGap(gap: Interval, offset: number, pxPerMin: number): number {
  return Math.min(Math.max(snapMinutes(gap.start + offset / pxPerMin), gap.start), gap.end - 1);
}
