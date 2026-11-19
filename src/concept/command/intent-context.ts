import { DateTime } from "luxon";
import type { DateKey, DemoState } from "../data/types";
import { fixtureServiceAliases } from "../i18n/salon-eko-copy";
import type { IntentContext } from "../intent";
import { fullName } from "../selectors";

/** The interpreter reads dates in the salon's time zone, not the browser's. */
const TIMEZONE = "Europe/Stockholm";

function instant(date: DateKey, minutes: number): string {
  return DateTime.fromISO(date, { zone: TIMEZONE }).set({ hour: Math.floor(minutes / 60), minute: minutes % 60 }).toISO()!;
}

/**
 * Maps the demo state to the small context the interpreter needs. Only
 * upcoming bookings are included: those are the ones a command can move or cancel.
 */
export function buildIntentContext(state: DemoState, today: DateKey, minutes: number): IntentContext {
  return {
    customers: state.customers.map((c) => ({ id: c.id, name: fullName(c) })),
    services: state.services.map((s) => ({
      id: s.id, name: s.name, durationMin: s.duration, priceSek: s.price,
      aliases: state.industry ? undefined : fixtureServiceAliases(s).filter((name) => name !== s.name),
    })),
    staff: state.staff.map((s) => ({ id: s.id, name: s.firstName })),
    bookings: state.bookings
      .filter((b) => b.status === "booked" && b.date >= today)
      .map((b) => ({ id: b.id, customerId: b.customerId, staffId: b.staffId, serviceId: b.serviceId, start: instant(b.date, b.start) })),
    now: instant(today, minutes),
    timezone: TIMEZONE,
  };
}
