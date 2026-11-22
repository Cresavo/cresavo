import { textWaitlistAboutGaps, textWaitlistAboutSlot } from "../../booking/waitlist-offer";
import { freeGaps, isFree } from "../../data/slots";
import type { Booking, DateKey, DemoState } from "../../data/types";
import { t, tc } from "../../i18n";
import { cardVisible } from "../../modules/registry";
import { dispatchWithLog } from "../../store";
import { showUndoToast } from "../log/undo-toast";
import { waitlistCount, waitlistNotice } from "./waitlist-notice";

// The owner's offers to the waiting list from the Inbox and from Today. The
// text is staged with the inbox note that records it, so it is sent only when
// that note is saved. Each offer is re-checked against the latest saved state,
// and note, text and toast are built from it: another tab may have moved the
// visit, booked the free time, changed the waiting list or switched it off.

interface Clock { today: DateKey; minutes: number }

/** The slot the owner saw: an offer for it is refused once the visit is no longer there. */
export type ShownSlot = Pick<Booking, "id" | "date" | "start" | "staffId" | "resourceId">;

const sameSlot = (booking: Booking | undefined, shown: ShownSlot): booking is Booking =>
  !!booking && booking.date === shown.date && booking.start === shown.start && booking.staffId === shown.staffId && booking.resourceId === shown.resourceId;

/** Whether the time the visit held is still free in the latest schedule: nobody else booked or holds it. */
const stillFree = (state: DemoState, booking: Booking) =>
  isFree(state, booking.staffId, booking.date, booking.start, booking, booking.id);

/** Offers the slot a cancelled booking freed to the waiting list. False when nothing was saved or sent. */
export function offerSlotToWaitlist(shown: ShownSlot, clock: Clock): boolean {
  let count = 0;
  const latest = (current: DemoState) => current.bookings.find((booking) => booking.id === shown.id)!;
  const logId = dispatchWithLog(
    (current) => {
      count = waitlistCount(current, latest(current));
      return { type: "inbox/add", item: waitlistNotice(latest(current), count, clock) };
    },
    undefined,
    (current) => {
      const booking = latest(current);
      return sameSlot(booking, shown) && stillFree(current, booking) && waitlistCount(current, booking) > 0;
    },
    { send: (current) => textWaitlistAboutSlot(current, latest(current)) },
  );
  return showUndoToast(tc("suggest.gaps.toast", count), logId);
}

/** Today's free stretches of at least half an hour, as the Today card shows them. */
export function todayGaps(state: DemoState, clock: Clock) {
  return state.staff.flatMap((person) => freeGaps(state, person.id, clock.today, { after: clock.minutes, min: 30 }));
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
    (current) => cardVisible(current.modules, "gaps") && todayGaps(current, clock).length > 0 && waiting(current) > 0,
    { send: (current) => textWaitlistAboutGaps(current, clock.today) },
  );
  return showUndoToast(tc("suggest.gaps.toast", count), logId);
}
