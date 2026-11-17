import { addDays } from "../data/dates";
import { freeGaps, openingFor } from "../data/slots";
import type { DateKey, DemoState, Service, StaffId } from "../data/types";

const LOOKAHEAD_DAYS = 7;
/** Four free hours or more on one person's day counts as quiet. */
const QUIET_MINUTES = 240;

export interface QuietDay {
  date: DateKey;
  freeMinutes: number;
  /** A treatment the quiet person offers. */
  service: Service;
}

/** The emptiest open day in the coming week for one staff member, if it is quiet enough for an offer. */
export function quietDay(state: DemoState, today: DateKey): QuietDay | null {
  let best: { date: DateKey; staffId: StaffId; freeMinutes: number } | null = null;
  for (let offset = 1; offset <= LOOKAHEAD_DAYS; offset++) {
    const date = addDays(today, offset);
    if (!openingFor(state.salon, date)) continue;
    for (const staff of state.staff) {
      const freeMinutes = freeGaps(state, staff.id, date, { min: 30 }).reduce((sum, gap) => sum + gap.end - gap.start, 0);
      if (freeMinutes >= QUIET_MINUTES && (!best || freeMinutes > best.freeMinutes)) best = { date, staffId: staff.id, freeMinutes };
    }
  }
  const service = best && state.services.find((s) => s.staffIds.includes(best.staffId));
  return best && service ? { date: best.date, freeMinutes: best.freeMinutes, service } : null;
}
