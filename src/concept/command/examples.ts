import { t } from "../i18n";
import type { DateKey, DemoState } from "../data/types";
import { fullName } from "../selectors";

/** Three prompts the interpreter understands, using a real upcoming booking from the data. */
export function commandExamples(state: DemoState, today: DateKey): string[] {
  const upcoming = state.bookings.filter((b) => b.status === "booked" && b.date > today);
  const names = new Map<string, number>();
  for (const c of state.customers) names.set(fullName(c), (names.get(fullName(c)) ?? 0) + 1);
  const bookingCount = new Map<string, number>();
  for (const b of upcoming) bookingCount.set(b.customerId, (bookingCount.get(b.customerId) ?? 0) + 1);
  const customer = state.customers.find((c) => c.isRegular && bookingCount.get(c.id) === 1 && names.get(fullName(c)) === 1);
  const holiday = [...state.holidays].filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  return [
    ...(customer ? [`Move ${fullName(customer)} to Friday at 10:00`] : []),
    "What have I earned this month?",
    ...(holiday ? [t("command.holidayExample", { name: holiday.name })] : ["Which customers haven't been here since summer?"]),
  ];
}
