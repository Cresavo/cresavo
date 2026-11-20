import { textWaitlistAboutGaps, textWaitlistAboutSlot } from "../../booking/waitlist-offer";
import type { Booking, DateKey, DemoState } from "../../data/types";
import { t, tc } from "../../i18n";
import { cardVisible } from "../../modules/registry";
import { dispatchWithLog } from "../../store";
import { showUndoToast } from "../log/undo-toast";
import { waitlistCount, waitlistNotice } from "./waitlist-notice";

// The owner's offers to the waiting list from the Inbox and from Today. The
// text is staged with the inbox note that records it, so it is sent only when
// that note is saved. Note, text and toast are all built from the latest saved
// state: another tab may have changed the waiting list or switched it off.

interface Clock { today: DateKey; minutes: number }

/** Offers the slot a cancelled booking freed to the waiting list. False when nothing was saved or sent. */
export function offerSlotToWaitlist(bookingId: string, clock: Clock): boolean {
  let count = 0;
  const latest = (current: DemoState): Booking | undefined => current.bookings.find((booking) => booking.id === bookingId);
  const logId = dispatchWithLog(
    (current) => {
      count = waitlistCount(current, latest(current)!);
      return { type: "inbox/add", item: waitlistNotice(latest(current)!, count, clock) };
    },
    undefined,
    (current) => {
      const booking = latest(current);
      return !!booking && waitlistCount(current, booking) > 0;
    },
    { send: (current) => textWaitlistAboutSlot(current, latest(current)!) },
  );
  return showUndoToast(tc("suggest.gaps.toast", count), logId);
}

/** Customers a text about today's free times reaches. */
const waiting = (state: DemoState) => state.customers.filter((customer) => customer.waitlist).length;

/** Texts the waiting list about today's free times, with the inbox note that records it. */
export function offerGapsToWaitlist(clock: Clock): boolean {
  let count = 0;
  const logId = dispatchWithLog(
    (current) => {
      count = waiting(current);
      return {
        type: "inbox/add",
        item: { kind: "system", waitlistOffer: true, date: clock.today, time: clock.minutes, title: t("suggest.gaps.sentTitle"), body: tc("suggest.gaps.sentBody", count), read: false, handled: true },
      };
    },
    undefined,
    (current) => cardVisible(current.modules, "gaps"),
    { send: (current) => textWaitlistAboutGaps(current, clock.today) },
  );
  return showUndoToast(tc("suggest.gaps.toast", count), logId);
}
