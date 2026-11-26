import type { Booking, DateKey } from "../../data/types";

// Which actions a visit's sheet offers. One rule for the sheet itself and for the calendar's tags, so "Show me"
// only opens a visit whose sheet really has the button it is heading for.

export type VisitAction = "move" | "cancel" | "take-payment" | "mark-done";

export interface VisitFacts {
  today: DateKey;
  minutes: number;
  /** The register has a receipt for this visit. */
  paid: boolean;
  /** A package visit is paid for with the package. */
  inPackage: boolean;
  /** This salon's register can take a payment at all. */
  register: boolean;
}

export interface VisitActions {
  /** Still to come: it can be moved or cancelled. */
  upcoming: boolean;
  /** Its time is over and it is not marked done yet. */
  finished: boolean;
  takesPayment: boolean;
  actions: VisitAction[];
}

export function visitActions(booking: Pick<Booking, "status" | "date" | "start" | "duration">, facts: VisitFacts): VisitActions {
  const booked = booking.status === "booked";
  const upcoming = booked && (booking.date > facts.today || (booking.date === facts.today && booking.start + booking.duration > facts.minutes));
  const finished = booked && !upcoming;
  // The register takes payment for a visit of today or earlier; a package visit is already paid for.
  const takesPayment = booked && !facts.paid && !facts.inPackage && booking.date <= facts.today && facts.register;
  const actions: VisitAction[] = [
    ...(upcoming ? ["move", "cancel"] as const : []),
    ...(takesPayment ? ["take-payment"] as const : []),
    ...(finished ? ["mark-done"] as const : []),
  ];
  return { upcoming, finished, takesPayment, actions };
}
