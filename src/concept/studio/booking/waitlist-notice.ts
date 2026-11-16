import { formatTime } from "../../data/dates";
import type { Booking, DemoState, InboxItem } from "../../data/types";
import { t, tc } from "../../i18n";
import { formatDayLong } from "../../i18n/format";

/** Customers who would be told about the slot a cancellation frees up. */
export function waitlistCount(state: DemoState, booking: Booking): number {
  return state.customers.filter((c) => c.waitlist && c.id !== booking.customerId).length;
}

/** Inbox note recording that a freed slot was offered to the waiting list (simulated). */
export function waitlistNotice(booking: Booking, count: number, now: { today: string; minutes: number }): Omit<InboxItem, "id"> {
  return {
    kind: "system",
    date: now.today,
    time: now.minutes,
    title: t("cancel.offerTitle", { time: formatTime(booking.start) }),
    body: tc("cancel.offerBody", count, { day: formatDayLong(booking.date), time: formatTime(booking.start) }),
    read: false,
    handled: true,
  };
}
