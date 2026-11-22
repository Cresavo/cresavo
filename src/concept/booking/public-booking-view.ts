import type { Booking, DateKey, DemoState } from "../data/types";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { findService } from "../selectors";
import { freeCancellationDeadline, freeChangeCutoff, freeChangeOpen } from "./policy";

/** What the holder of a booking link may see of their booking: no customer, notes, price or anyone else's visit. */
export interface PublicBookingView {
  /** The ids the booking page already shows for treatments and team members, so a new time can be found for the same visit. */
  serviceId: string;
  staffId: string;
  treatment: string;
  staffFirstName: string;
  date: DateKey;
  start: number;
  duration: number;
  status: Booking["status"];
  salon: { phone: string; email: string; address: string };
  /** The last minute of free cancellation, in the salon's time; only while it is still ahead. */
  freeUntil?: { date: DateKey; time: number };
  /** The last instant (epoch ms) of free change, for a page that is open when it passes; present with `freeUntil`. */
  closesAt?: number;
}

export function publicBookingView(state: DemoState, booking: Booking, now = Date.now()): PublicBookingView {
  const service = findService(state, booking.serviceId);
  const open = booking.protection && freeChangeOpen(booking, now);
  return {
    serviceId: booking.serviceId, staffId: booking.staffId,
    treatment: service ? serviceCopy(service, state.localization.language).name : "",
    staffFirstName: state.staff.find((s) => s.id === booking.staffId)?.firstName ?? "",
    date: booking.date, start: booking.start, duration: booking.duration, status: booking.status,
    salon: { phone: state.salon.phone, email: state.salon.email, address: [state.salon.address, state.salon.area].filter(Boolean).join(", ") },
    ...(open ? { freeUntil: freeCancellationDeadline(booking), closesAt: freeChangeCutoff(booking) } : {}),
  };
}
