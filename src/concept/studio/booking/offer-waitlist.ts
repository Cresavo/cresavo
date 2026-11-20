import { textWaitlistAboutGaps, textWaitlistAboutSlot } from "../../booking/waitlist-offer";
import type { Booking, DateKey, DemoState } from "../../data/types";
import { tc } from "../../i18n";
import { cardVisible } from "../../modules/registry";
import { dispatchWithUndoToast } from "../log/undo-toast";
import { waitlistCount, waitlistNotice } from "./waitlist-notice";

// The owner's offers to the waiting list from the Inbox and from Today. The
// text is staged with the inbox note that records it, so it is sent only when
// that note is saved, and the save is re-checked against the latest state:
// another tab may have switched the waiting list off meanwhile.

interface Clock { today: DateKey; minutes: number }

/** Offers the slot a cancelled booking freed to the waiting list. False when nothing was saved or sent. */
export function offerSlotToWaitlist(state: DemoState, booking: Booking, clock: Clock): boolean {
  const waitlist = waitlistCount(state, booking);
  return dispatchWithUndoToast(
    { type: "inbox/add", item: waitlistNotice(booking, waitlist, clock) },
    tc("suggest.gaps.toast", waitlist),
    undefined,
    (current) => waitlistCount(current, booking) > 0,
    { send: (current) => textWaitlistAboutSlot(current, booking) },
  );
}

/** Texts the waiting list about today's free times, with the inbox note that records it. */
export function offerGapsToWaitlist(clock: Clock, copy: { title: string; body: string; toast: string }): boolean {
  return dispatchWithUndoToast(
    { type: "inbox/add", item: { kind: "system", waitlistOffer: true, date: clock.today, time: clock.minutes, title: copy.title, body: copy.body, read: false, handled: true } },
    copy.toast,
    undefined,
    (current) => cardVisible(current.modules, "gaps"),
    { send: (current) => textWaitlistAboutGaps(current, clock.today) },
  );
}
