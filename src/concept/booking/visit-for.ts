// "Book for someone else": the person a visit is for, when it is not the
// customer who booked. The customer stays the contact for confirmations and
// reminders; only this name is kept about the guest.

/** The longest name and phone number a booking form may send, as on a salon's public page (`publicBookingSchema`). */
export const GUEST_NAME_MAX = 80;
export const GUEST_PHONE_MAX = 20;
export const VISIT_FOR_MAX = GUEST_NAME_MAX;

/** As a public page's name rule: no control characters and no explicit bidi overrides or isolates. Right-to-left scripts are fine. */
const ALLOWED = /^[^\p{Cc}\u202A-\u202E\u2066-\u2069]+$/u;
/** Characters that show nothing: spaces and format characters such as directional marks and joiners. */
const UNSEEN = /[\s\p{Cf}]/gu;

/** True when a booker's name and phone fit the form's limits. What a valid name or number is stays with the callers. */
export function withinGuestLimits(guest: { name: string; phone: string }): boolean {
  return guest.name.trim().length <= GUEST_NAME_MAX && guest.phone.trim().length <= GUEST_PHONE_MAX;
}

/** The guest's name as it is stored: trimmed, with single spaces. */
export function visitForName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isVisitForValid(value: string): boolean {
  const name = visitForName(value);
  // Two letters that show: a name of directional marks alone would leave the calendar row blank.
  return name.length <= VISIT_FOR_MAX && ALLOWED.test(name) && name.replace(UNSEEN, "").length >= 2;
}
