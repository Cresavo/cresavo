// "Book for someone else": the person a visit is for, when it is not the
// customer who booked. The customer stays the contact for confirmations and
// reminders; only this name is kept about the guest.

export const VISIT_FOR_MAX = 80;

/** The guest's name as it is stored: trimmed, with single spaces. */
export function visitForName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isVisitForValid(value: string): boolean {
  const name = visitForName(value);
  return name.length >= 2 && name.length <= VISIT_FOR_MAX;
}
