import { sendDemoMessage } from "../connections/demo";
import { formatTime } from "../data/dates";
import type { Booking, DateKey, DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayLong } from "../i18n/format";

// An offer to the waiting list is always the owner's explicit choice. It goes through the SMS port
// (simulated in the demo) and the caller logs it in the inbox, where it shows under Sent.

/** Texts the waiting list about the slot a cancelled booking frees up. False when the port refused it. */
export function textWaitlistAboutSlot(state: DemoState, booking: Booking): boolean {
  const body = t("cancel.offerSms", { salon: state.salon.name, day: formatDayLong(booking.date), time: formatTime(booking.start) });
  return sendDemoMessage({ channel: "sms", to: { segment: "waitlist" }, body, reference: `waitlist-${booking.id}-${booking.date}-${booking.start}` }) !== null;
}

/** Texts the waiting list about today's free slots. False when the port refused it. */
export function textWaitlistAboutGaps(state: DemoState, today: DateKey): boolean {
  const body = t("suggest.gaps.sms", { salon: state.salon.name });
  return sendDemoMessage({ channel: "sms", to: { segment: "waitlist" }, body, reference: `waitlist-gaps-${today}` }) !== null;
}
