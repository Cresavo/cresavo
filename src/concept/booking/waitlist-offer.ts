import { customerText } from "../i18n/customer-text";
import { sendDemoMessage } from "../connections/demo";
import type { Booking, DateKey, DemoState } from "../data/types";
import { formatDayLong, formatTime } from "../i18n/format";

// An offer to the waiting list is always the owner's explicit choice. It goes through the SMS port
// (simulated in the demo) and the caller logs it in the inbox, where it shows under Sent.

/** Texts the waiting list about the slot a cancelled booking frees up. False when the port refused it. */
export function textWaitlistAboutSlot(state: DemoState, booking: Booking): boolean {
  const body = customerText(state, "cancel.offerSms", { salon: state.salon.name, day: formatDayLong(booking.date, state.localization.language), time: formatTime(booking.start, state.localization.language) });
  return sendDemoMessage({ channel: "sms", to: { segment: "waitlist" }, body, reference: `waitlist-${booking.id}-${booking.date}-${booking.start}` }) !== null;
}

/** Texts the waiting list about today's free slots. False when the port refused it. */
export function textWaitlistAboutGaps(state: DemoState, today: DateKey): boolean {
  const body = customerText(state, "suggest.gaps.sms", { salon: state.salon.name });
  return sendDemoMessage({ channel: "sms", to: { segment: "waitlist" }, body, reference: `waitlist-gaps-${today}` }) !== null;
}
