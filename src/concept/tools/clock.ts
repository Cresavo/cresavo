import { DateTime } from "luxon";
import type { Clock } from "../finance/types";

/** The salon's own time zone. */
export const SALON_TIMEZONE = "Europe/Stockholm";

/** Today and the minute of the day in the salon. */
export function salonClock(now: Date = new Date()): Clock {
  const local = DateTime.fromJSDate(now, { zone: SALON_TIMEZONE });
  return { today: local.toISODate()!, minutes: local.hour * 60 + local.minute };
}
