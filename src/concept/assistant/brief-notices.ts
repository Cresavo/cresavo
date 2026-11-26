import { diffDays } from "../data/dates";
import type { DemoState, InboxEvent } from "../data/types";
import type { Clock } from "../finance/types";
import { t, tc, type MessageKey } from "../i18n";
import { formatDayLong, formatTime } from "../i18n/format";
import { findCustomer, findService, inboxItemVisible } from "../selectors";
import type { BriefItem } from "./briefs";

// What customers did on the booking page since the studio last looked: the unread
// inbox items for an online booking, cancellation or move. First name, service, day
// and time only; never a last name, contact details, a journal or what was paid.

const SHOWN = 2;
const PRIORITY = 5;

const SENTENCE: Record<InboxEvent, MessageKey> = {
  booked: "brief.notice.booked",
  cancelled: "brief.notice.cancelled",
  moved: "brief.notice.moved",
};

function dayText(date: string, today: string) {
  const diff = diffDays(date, today);
  return diff === 0 ? t("brief.notice.today") : diff === 1 ? t("brief.notice.tomorrow") : formatDayLong(date);
}

/** A brief item for one booking-page event, with the booking it is about. */
export interface NoticeItem extends BriefItem {
  event?: InboxEvent;
  bookingId?: string;
}

/** Brief items for unread booking-page events, newest first; past the first two, one line counts the rest. */
export function noticeItems(state: DemoState, clock: Clock, omitBookingIds?: ReadonlySet<string>): NoticeItem[] {
  const notices = state.inbox.flatMap((item): NoticeItem[] => {
    if (!item.event || item.read || !item.bookingId || !inboxItemVisible(state, item)) return [];
    // Only the cancellation is omitted: an earlier booking or move for the same visit still belongs in the list.
    if (item.event === "cancelled" && omitBookingIds?.has(item.bookingId)) return [];
    const booking = state.bookings.find((b) => b.id === item.bookingId);
    if (!booking) return [];
    const text = t(SENTENCE[item.event], {
      name: findCustomer(state, booking.customerId)?.firstName ?? "",
      service: findService(state, booking.serviceId)?.name ?? "",
      day: dayText(item.visitDate ?? booking.date, clock.today),
      time: formatTime(item.visitStart ?? booking.start),
    });
    return [{ id: `notice-${item.id}`, text, priority: PRIORITY, href: `/studio/calendar?booking=${encodeURIComponent(booking.id)}`, event: item.event, bookingId: booking.id }];
  });
  // Three items stay three items: collapsing to "1 more" would use the same number of lines.
  if (notices.length <= SHOWN + 1) return notices;
  const rest = notices.length - SHOWN;
  return [...notices.slice(0, SHOWN), { id: "notice-more", text: tc("brief.notice.more", rest), priority: PRIORITY, href: "/studio/inbox" }];
}
