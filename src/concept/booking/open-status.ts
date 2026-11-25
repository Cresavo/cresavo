import { lunchFor, openingFor } from "../data/slots";
import type { DateKey, Salon } from "../data/types";

/** In the last hour of the day the page says "Closing soon". It names the salon's own closing time, never a count of minutes. */
export const CLOSING_SOON_MINUTES = 60;

export type OpenStatus =
  | { kind: "open"; until: number }
  | { kind: "closingSoon"; until: number }
  | { kind: "lunch"; until: number }
  | { kind: "closed" };

/** Whether the salon is open right now, from its own opening hours, lunch break and closed days only. */
export function openStatus(salon: Salon, date: DateKey, minutes: number): OpenStatus {
  const hours = openingFor(salon, date);
  if (!hours || minutes < hours.open || minutes >= hours.close) return { kind: "closed" };
  const lunch = lunchFor(salon, date);
  if (lunch && minutes >= lunch.start && minutes < lunch.end) return { kind: "lunch", until: lunch.end };
  return { kind: hours.close - minutes <= CLOSING_SOON_MINUTES ? "closingSoon" : "open", until: hours.close };
}
